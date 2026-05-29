import { createLogger } from '@note/logger'
import { collectFromRss } from './sources/rss.js'
import { collectFromX } from './sources/x.js'
import { collectFromTavily } from './sources/tavily.js'
import { filterDuplicates } from './dedupe.js'
import { saveIdeas } from './save.js'
import { notifyDiscord } from './notify.js'
import { runCleanup } from './cleanup.js'
import type { RawIdea } from './types.js'

const logger = createLogger('collector')

/** 収集サイクルの間隔: 6時間 */
const DAEMON_INTERVAL_MS = 6 * 60 * 60 * 1000

async function runCycle(): Promise<void> {
  const source = process.argv[2] ?? 'all'
  logger.info({ source }, 'Starting collection cycle')

  // クリーンアップは収集結果に関わらず毎サイクル必ず実行する
  try {
    await runCleanup(logger)
  } catch (e) {
    logger.error({ error: String(e) }, 'Cleanup error')
  }

  const allIdeas: RawIdea[] = []

  if (source === 'all' || source === 'rss') {
    const result = await collectFromRss(logger)
    if (result.isOk()) {
      allIdeas.push(...result.value)
      logger.info({ count: result.value.length }, 'RSS collection done')
    } else {
      logger.error({ error: result.error.message }, 'RSS collection failed')
      await notifyDiscord(`RSS 収集エラー: ${result.error.message}`)
    }
  }

  if (source === 'all' || source === 'x') {
    const result = await collectFromX(logger)
    if (result.isOk()) {
      allIdeas.push(...result.value)
      logger.info({ count: result.value.length }, 'X collection done')
    } else {
      logger.error({ error: result.error.message }, 'X collection failed')
      await notifyDiscord(`X 収集エラー: ${result.error.message}`)
    }
  }

  if (source === 'all' || source === 'tavily') {
    const result = await collectFromTavily(logger)
    if (result.isOk()) {
      allIdeas.push(...result.value)
      logger.info({ count: result.value.length }, 'Tavily collection done')
    } else {
      logger.error({ error: result.error.message }, 'Tavily collection failed')
      await notifyDiscord(`Tavily 収集エラー: ${result.error.message}`)
    }
  }

  logger.info({ total: allIdeas.length }, 'Total ideas before deduplication')

  if (allIdeas.length === 0) {
    logger.info('No ideas collected this cycle')
    return
  }

  const dedupeResult = await filterDuplicates(allIdeas, logger)
  if (dedupeResult.isErr()) {
    logger.error({ error: dedupeResult.error.message }, 'Deduplication failed')
    await notifyDiscord(`重複除去エラー: ${dedupeResult.error.message}`)
    return
  }

  const uniqueIdeas = dedupeResult.value
  logger.info(
    { unique: uniqueIdeas.length, duplicates: allIdeas.length - uniqueIdeas.length },
    'Deduplication complete',
  )

  if (uniqueIdeas.length === 0) {
    logger.info('No new ideas after deduplication')
    return
  }

  const saveResult = await saveIdeas(uniqueIdeas, logger)
  if (saveResult.isErr()) {
    logger.error({ error: saveResult.error.message }, 'Save failed')
    await notifyDiscord(`DB 保存エラー: ${saveResult.error.message}`)
    return
  }

  logger.info({ saved: saveResult.value }, 'Collection cycle complete')
  await notifyDiscord(`✅ ${saveResult.value} 件の新しいネタを収集しました`)
}

async function main(): Promise<void> {
  // 引数なしの場合はデーモンモード（docker-compose デフォルト）
  const runOnce = process.argv[2] === '--once' || process.argv[2] !== undefined && process.argv[2] !== 'all'

  if (runOnce) {
    await runCycle()
    return
  }

  // デーモンモード: 起動時に1回実行し、以降は6時間おきに繰り返す
  logger.info({ intervalHours: DAEMON_INTERVAL_MS / 3600000 }, 'mode=daemon starting')

  while (true) {
    try {
      await runCycle()
    } catch (e) {
      logger.error({ error: String(e) }, 'Cycle error')
      await notifyDiscord(`❌ collector サイクルエラー: ${String(e)}`)
    }
    logger.info({ waitMs: DAEMON_INTERVAL_MS }, 'Sleeping until next cycle')
    await new Promise(resolve => setTimeout(resolve, DAEMON_INTERVAL_MS))
  }
}

main().catch(async (e: unknown) => {
  logger.error({ error: String(e) }, 'Unhandled error in collector')
  await notifyDiscord(`致命的エラー: ${String(e)}`)
  process.exit(1)
})
