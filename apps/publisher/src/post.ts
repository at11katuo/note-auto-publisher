import { ResultAsync } from 'neverthrow'
import type { Page } from 'playwright'
import { createLogger } from '@note/logger'
import { AUTH_DIR } from './browser.js'
import { forceLogin } from './login.js'
import { resolve } from 'node:path'

const log = createLogger('publisher:post')

const NOTE_NEW_URL = 'https://note.com/notes/new'

const TIMEOUT_NAVIGATION = 30_000
const TIMEOUT_ELEMENT = 15_000
const TIMEOUT_SAVE = 30_000

const SELECTOR_TITLE =
  'textarea[placeholder*="タイトル"], input[placeholder*="タイトル"], [data-testid="editor-title"], textarea[aria-label*="タイトル"]'
const SELECTOR_BODY =
  '[contenteditable="true"][role="textbox"], div.ProseMirror[contenteditable="true"], [data-testid="editor-body"], div[contenteditable="true"][aria-label*="本文"]'
const SELECTOR_TAG_BUTTON =
  'button:has-text("ハッシュタグ"), button:has-text("タグ"), button[aria-label*="ハッシュタグ"]'
const SELECTOR_TAG_INPUT =
  'input[placeholder*="ハッシュタグ"], input[placeholder*="タグ"], input[aria-label*="ハッシュタグ"]'
const SELECTOR_SAVE_DRAFT =
  'button:has-text("下書き保存"), button[aria-label*="下書き保存"], [data-testid="save-draft-button"]'

// Eyecatch (thumbnail) upload button — note.com uses several selectors across editor versions
const SELECTORS_EYECATCH_BUTTON = [
  'button:has-text("サムネイル")',
  'button:has-text("アイキャッチ")',
  '[data-testid*="thumbnail"]',
  '[data-testid*="eyecatch"]',
  'button[aria-label*="サムネイル"]',
  'button[aria-label*="アイキャッチ"]',
  'label[aria-label*="サムネイル"]',
  'label[aria-label*="アイキャッチ"]',
]

export type DraftPayload = {
  title: string
  body: string
  tags: string[]
  eyecatchPath?: string | null
}

export type PostResult = {
  noteUrl: string
}

export class PostError extends Error {
  override readonly name = 'PostError'
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }

function parseMarkdown(body: string): Block[] {
  const lines = body.split(/\r?\n/)
  const blocks: Block[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (line.length === 0) continue
    // ## / # はプレーンテキストとして扱う（editor.note.com ではショートカットが機能しない）
    if (line.startsWith('## ')) {
      blocks.push({ kind: 'p', text: line.slice(3).trim() })
    } else if (line.startsWith('# ')) {
      blocks.push({ kind: 'p', text: line.slice(2).trim() })
    } else {
      blocks.push({ kind: 'p', text: line })
    }
  }
  return blocks
}

async function uploadEyecatch(page: Page, imagePath: string): Promise<void> {
  // Try each selector until one matches
  let triggerEl: import('playwright').ElementHandle | null = null
  for (const selector of SELECTORS_EYECATCH_BUTTON) {
    triggerEl = await page.$(selector)
    if (triggerEl) {
      log.info({ selector }, 'found eyecatch button')
      break
    }
  }

  if (!triggerEl) {
    log.warn('eyecatch button not found — skipping thumbnail upload')
    return
  }

  // Wait for the file chooser that the button triggers, then set the image file
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10_000 }),
    triggerEl.click(),
  ])
  await fileChooser.setFiles(imagePath)
  // Give note.com time to upload and process the image
  await page.waitForTimeout(3_000)
  log.info({ imagePath }, 'eyecatch image uploaded')
}

async function fillTitle(page: Page, title: string): Promise<void> {
  const el = await page.waitForSelector(SELECTOR_TITLE, {
    timeout: TIMEOUT_ELEMENT,
  })
  await el.click()
  await el.fill(title)
}

async function fillBody(page: Page, body: string): Promise<void> {
  const el = await page.waitForSelector(SELECTOR_BODY, {
    timeout: TIMEOUT_ELEMENT,
  })
  await el.click()

  const blocks = parseMarkdown(body)
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.kind === 'h2') {
      // note のエディタは Markdown ショートカット (## + space) で見出し2 に変換される
      await page.keyboard.type('## ', { delay: 10 })
      await page.keyboard.type(block.text, { delay: 5 })
    } else {
      await page.keyboard.type(block.text, { delay: 5 })
    }
    if (i < blocks.length - 1) {
      // 段落間に2行分の空白を入れる（Enter3回 = 現段落終了 + 空行2行）
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
    }
  }
}

async function fillTags(page: Page, tags: string[]): Promise<void> {
  if (tags.length === 0) return

  // タグ入力 UI が初期表示されない場合があるので、ボタンがあれば開く
  const opener = await page.$(SELECTOR_TAG_BUTTON)
  if (opener) {
    await opener.click().catch(() => undefined)
  }

  const input = await page
    .waitForSelector(SELECTOR_TAG_INPUT, { timeout: 5_000 })
    .catch(() => null)
  if (!input) {
    log.warn({ tagCount: tags.length }, 'tag input not found — skipping tags')
    return
  }

  for (const tag of tags) {
    const trimmed = tag.trim()
    if (trimmed.length === 0) continue
    await input.click()
    await input.fill(trimmed)
    await page.keyboard.press('Enter')
  }
}

async function clickSaveDraft(page: Page): Promise<void> {
  const button = await page.waitForSelector(SELECTOR_SAVE_DRAFT, {
    timeout: TIMEOUT_ELEMENT,
  })
  await button.click()
}

async function waitForSavedUrl(page: Page): Promise<string> {
  // note.com は新エディタ (editor.note.com) に移行済み。
  // 旧: note.com/notes/new → note.com/notes/<id>/edit
  // 新: editor.note.com/new → editor.note.com/<id>
  await page.waitForFunction(
    () => {
      const hostname = window.location.hostname
      const path = window.location.pathname
      if (hostname === 'editor.note.com') {
        // /new から別パスへ遷移すれば保存完了
        return path !== '/new'
      }
      // 旧エディタパターン
      if (path.endsWith('/notes/new')) return false
      return /\/notes\/[A-Za-z0-9_-]+/.test(path)
    },
    undefined,
    { timeout: TIMEOUT_SAVE },
  )
  return page.url()
}

const SCREENSHOT_PATH =
  process.env['RUNNING_IN_DOCKER'] === 'true'
    ? '/app/data/error-screenshot.png'
    : resolve(AUTH_DIR, 'error-screenshot.png')

async function captureErrorScreenshot(page: Page, context: string): Promise<void> {
  try {
    const url = page.url()
    log.error({ context, url }, 'capturing error screenshot')
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true })
    log.error({ path: SCREENSHOT_PATH, url }, 'screenshot saved — view at /api/screenshot')
  } catch (e) {
    log.warn({ err: e }, 'failed to capture error screenshot')
  }
}

export function createDraftOnNote(
  page: Page,
  draft: DraftPayload,
): ResultAsync<PostResult, PostError> {
  return ResultAsync.fromPromise(
    (async () => {
      log.info(
        { title: draft.title, charCount: draft.body.length, tags: draft.tags },
        'creating draft on note',
      )

      await page.goto(NOTE_NEW_URL, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_NAVIGATION,
      })

      // /login にリダイレクトされた場合はセッション切れ → forceLogin で再ログイン
      // ensureLoggedIn は isLoggedIn の誤検知でスキップされる恐れがあるため使わない
      if (page.url().includes('/login')) {
        log.warn({ url: page.url() }, 'redirected to /login — session expired, re-logging in')
        const loginResult = await forceLogin(page)
        if (loginResult.isErr()) {
          throw new PostError('fallback re-login failed', loginResult.error)
        }
        await page.goto(NOTE_NEW_URL, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_NAVIGATION,
        })
      }

      log.info({ url: page.url() }, 'navigated to notes/new')

      if (draft.eyecatchPath) {
        await uploadEyecatch(page, draft.eyecatchPath).catch((e: unknown) => {
          log.warn({ err: e }, 'eyecatch upload threw unexpectedly — continuing without thumbnail')
        })
      }

      await fillTitle(page, draft.title).catch(async (e: unknown) => {
        await captureErrorScreenshot(page, 'fillTitle failed')
        throw e
      })
      log.info('title filled')

      await fillBody(page, draft.body)
      log.info('body filled')

      await fillTags(page, draft.tags)
      log.info({ tagCount: draft.tags.length }, 'tags filled')

      await clickSaveDraft(page).catch(async (e: unknown) => {
        await captureErrorScreenshot(page, 'clickSaveDraft failed')
        throw e
      })
      log.info('save-draft clicked')

      // note 側の保存通信が完了する前にブラウザを閉じてしまわないよう待機する
      await page.waitForTimeout(5_000)

      const noteUrl = await waitForSavedUrl(page).catch(async (e: unknown) => {
        await captureErrorScreenshot(page, 'waitForSavedUrl failed')
        throw e
      })
      log.info({ noteUrl }, 'draft saved')

      // URL 遷移後も保存処理が継続している可能性があるため、念のため追加で待機する
      await page.waitForTimeout(5_000)

      return { noteUrl }
    })(),
    (e) => new PostError('createDraftOnNote failed', e),
  )
}
