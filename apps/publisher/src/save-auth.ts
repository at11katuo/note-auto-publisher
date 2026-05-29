/**
 * 手動ログインでPlaywrightのセッションを保存するスクリプト。
 * ローカルPC上でヘッドフルブラウザを起動し、手動でNoteにログインした後、
 * 認証状態を .auth/note.json に保存する。
 *
 * 使い方: pnpm --filter @note/publisher save-auth
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = resolve(__dirname, '../.auth')
const STORAGE_STATE_PATH = resolve(AUTH_DIR, 'note.json')

const NOTE_LOGIN_URL = 'https://note.com/login'

async function main() {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true })
  }

  console.log('=== Note 手動ログイン認証スクリプト ===')
  console.log('ブラウザを起動します。Noteにログインしてください。')
  console.log(`セッション保存先: ${STORAGE_STATE_PATH}`)
  console.log('')

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()
  await page.goto(NOTE_LOGIN_URL)

  console.log('ログインページを開きました。')
  console.log('ブラウザ上でメールアドレスとパスワードを入力し、ログインを完了してください。')
  console.log('ログイン完了を自動検知します（最大3分間待機）...')

  // ログイン完了をURL変化で検知（/login から離れたら完了とみなす）
  try {
    await page.waitForURL(
      (url) => !url.pathname.startsWith('/login') && url.hostname === 'note.com',
      { timeout: 180_000 },
    )
  } catch {
    console.error('タイムアウト: 3分以内にログインが完了しませんでした。')
    await browser.close()
    process.exit(1)
  }

  const currentUrl = page.url()
  console.log(`ログイン完了を検知しました: ${currentUrl}`)
  console.log('セッションを保存しています...')

  await context.storageState({ path: STORAGE_STATE_PATH })

  console.log(`✅ セッションを保存しました: ${STORAGE_STATE_PATH}`)
  console.log('')
  console.log('次のステップ:')
  console.log(
    `  scp ${STORAGE_STATE_PATH} <user>@<vps-host>:/path/to/note-auto-publisher/apps/publisher/.auth/note.json`,
  )
  console.log('  または docker cp コマンドでコンテナに転送してください。')

  await browser.close()
}

main().catch((e) => {
  console.error('エラーが発生しました:', e)
  process.exit(1)
})
