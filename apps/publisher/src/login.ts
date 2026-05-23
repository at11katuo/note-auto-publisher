import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ResultAsync } from 'neverthrow'
import type { Page } from 'playwright'
import { createLogger } from '@note/logger'
import { parseEnv } from '@note/shared'
import { AUTH_DIR, saveStorageState } from './browser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const log = createLogger('publisher:login')

// Docker 内は /app/data/、ローカルは .auth/ 直下に保存する
const SCREENSHOT_PATH =
  process.env['RUNNING_IN_DOCKER'] === 'true'
    ? '/app/data/error-screenshot.png'
    : resolve(AUTH_DIR, 'error-screenshot.png')

async function captureLoginScreenshot(page: Page, context: string): Promise<void> {
  try {
    const url = page.url()
    log.error({ context, url }, 'capturing login error screenshot')
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true })
    log.error({ path: SCREENSHOT_PATH, url }, 'screenshot saved — view at /api/screenshot')
  } catch (e) {
    log.warn({ err: e }, 'failed to capture login error screenshot')
  }
}

const NOTE_ORIGIN = 'https://note.com'
const LOGIN_URL = `${NOTE_ORIGIN}/login`
const HOME_URL = `${NOTE_ORIGIN}/`

const SELECTOR_EMAIL =
  'input[type="email"], input[name="login"], input[id="email"]'
const SELECTOR_PASSWORD = 'input[type="password"]'
const SELECTOR_SUBMIT = 'button:has-text("ログイン"), button[type="submit"]'

const SELECTOR_LOGGED_IN_MARKER =
  '[data-testid="header-account-menu"], a[href*="/notes/new"], button[aria-label*="アカウント"], img[alt*="プロフィール"]'

const TIMEOUT_NAVIGATION = 30_000
const TIMEOUT_LOGIN_CHECK = 7_000
const TIMEOUT_2FA_WAIT = 120_000

export class LoginError extends Error {
  override readonly name = 'LoginError'
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto(HOME_URL, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_NAVIGATION,
    })
    const currentUrl = page.url()
    // ログインページにリダイレクトされたら未ログイン確定
    if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
      return false
    }
    // URL がホームのままならセッション有効とみなす（セレクタより信頼性が高い）
    const marker = await page.$(SELECTOR_LOGGED_IN_MARKER)
    if (marker) return true
    // セレクタが見つからなくても /login にいなければセッションは有効と判断
    return !currentUrl.includes('/login')
  } catch {
    return false
  }
}

async function performLogin(page: Page): Promise<void> {
  const env = parseEnv()

  log.info('navigating to login page')
  await page.goto(LOGIN_URL, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT_NAVIGATION,
  })

  await page.waitForSelector(SELECTOR_EMAIL, { timeout: 30_000 })

  // stealth プラグインで bot 検知を回避済みなので fill() で自動入力する
  const emailInput = page.locator(SELECTOR_EMAIL).first()
  await emailInput.fill(env.NOTE_EMAIL)
  const passwordInput = page.locator(SELECTOR_PASSWORD).first()
  await passwordInput.fill(env.NOTE_PASSWORD)

  log.info({ email: env.NOTE_EMAIL }, 'submitting credentials')
  await page.waitForSelector(`${SELECTOR_SUBMIT}:not([disabled])`, { timeout: 10_000 })
  await page.click(`${SELECTOR_SUBMIT}:not([disabled])`)

  await page.waitForTimeout(2_000)
  await captureLoginScreenshot(page, 'immediately after submit')

  log.info(
    { timeoutMs: TIMEOUT_2FA_WAIT },
    'waiting for post-login state (CAPTCHA/2FA may require manual action)',
  )
  try {
    await page.waitForSelector(SELECTOR_LOGGED_IN_MARKER, {
      timeout: TIMEOUT_2FA_WAIT,
      state: 'attached',
    })
  } catch (e) {
    await captureLoginScreenshot(page, 'post-login marker not found')
    throw e
  }

  log.info('login confirmed')
}

export function ensureLoggedIn(
  page: Page,
): ResultAsync<{ reused: boolean }, LoginError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (await isLoggedIn(page)) {
        log.info('reused stored session')
        return { reused: true }
      }

      log.warn('stored session invalid or missing — performing fresh login')
      await performLogin(page)

      const ctx = page.context()
      const saved = await saveStorageState(ctx)
      if (saved.isErr()) {
        throw saved.error
      }

      return { reused: false }
    })(),
    (e) => new LoginError('ensureLoggedIn failed', e),
  )
}

/** セッションキャッシュを完全に無視して必ず新規ログインを実行する（--login-only 専用）*/
export function forceLogin(
  page: Page,
): ResultAsync<void, LoginError> {
  return ResultAsync.fromPromise(
    (async () => {
      log.info('force-login: skipping stored session, performing fresh login')
      await performLogin(page)

      const ctx = page.context()
      const saved = await saveStorageState(ctx)
      if (saved.isErr()) {
        throw saved.error
      }

      log.info('force-login: new session saved')
    })(),
    (e) => new LoginError('forceLogin failed', e),
  )
}
