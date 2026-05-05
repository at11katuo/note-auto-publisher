export async function notifyDiscord(message: string): Promise<void> {
  const url = process.env['DISCORD_WEBHOOK_URL']
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `[note-auto-publisher] ${message}` }),
    })
  } catch {
    // best-effort: 通知失敗してもメイン処理に影響させない
  }
}
