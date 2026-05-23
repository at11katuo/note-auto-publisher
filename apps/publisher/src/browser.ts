import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ResultAsync } from 'neverthrow'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'
import { createLogger } from '@note/logger'

const log = createLogger('publisher:browser')

const __dirname = dirname(fileURLToPath(import.meta.url))

export const AUTH_DIR = resolve(__dirname, '../.auth')
export const STORAGE_STATE_PATH = resolve(AUTH_DIR, 'note.json')

export type BrowserSession = {
  browser: Browser
  context: BrowserContext
  page: Page
}

export type LaunchOptions = {
  headless?: boolean
  slowMo?: number
}

export class BrowserError extends Error {
  override readonly name = 'BrowserError'
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

function ensureAuthDir(): void {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true })
    log.info({ dir: AUTH_DIR }, 'created auth dir')
  }
}

export function hasStoredSession(): boolean {
  return existsSync(STORAGE_STATE_PATH)
}

export function launchBrowser(
  options: LaunchOptions = {},
): ResultAsync<BrowserSession, BrowserError> {
  // PLAYWRIGHT_HEADLESS=false または HEADLESS=false のどちらかで画面表示になる
  const { headless = process.env['PLAYWRIGHT_HEADLESS'] !== 'false' && process.env['HEADLESS'] !== 'false', slowMo = 100 } = options

  return ResultAsync.fromPromise(
    (async () => {
      ensureAuthDir()

      const browser = await chromium.launch({
        headless,
        slowMo,
        args: ['--disable-blink-features=AutomationControlled'],
      })

      const useStored = hasStoredSession()
      log.info(
        { headless, useStored, storageStatePath: STORAGE_STATE_PATH },
        'launching browser',
      )

      const context = await browser.newContext({
        ...(useStored ? { storageState: STORAGE_STATE_PATH } : {}),
        viewport: { width: 1280, height: 900 },
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()
      return { browser, context, page }
    })(),
    (e) => new BrowserError('failed to launch browser', e),
  )
}

export function saveStorageState(
  context: BrowserContext,
): ResultAsync<string, BrowserError> {
  return ResultAsync.fromPromise(
    (async () => {
      ensureAuthDir()
      await context.storageState({ path: STORAGE_STATE_PATH })
      log.info({ path: STORAGE_STATE_PATH }, 'saved storage state')
      return STORAGE_STATE_PATH
    })(),
    (e) => new BrowserError('failed to save storage state', e),
  )
}

export function closeBrowser(
  session: BrowserSession,
): ResultAsync<void, BrowserError> {
  return ResultAsync.fromPromise(
    (async () => {
      await session.context.close()
      await session.browser.close()
    })(),
    (e) => new BrowserError('failed to close browser', e),
  )
}
