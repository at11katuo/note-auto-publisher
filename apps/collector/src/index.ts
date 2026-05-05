import { createLogger } from '@note/logger'
import { collectFromRss } from './sources/rss.js'
import { collectFromX } from './sources/x.js'
import { filterDuplicates } from './dedupe.js'
import { saveIdeas } from './save.js'
import { notifyDiscord } from './notify.js'
import type { RawIdea } from './types.js'

const logger = createLogger('collector')

async function main(): Promise<void> {
  const source = process.argv[2] ?? 'all'
  logger.info({ source }, 'Starting collection')

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

  logger.info({ total: allIdeas.length }, 'Total ideas before deduplication')

  if (allIdeas.length === 0) {
    logger.info('No ideas collected')
    return
  }

  const dedupeResult = await filterDuplicates(allIdeas, logger)
  if (dedupeResult.isErr()) {
    logger.error({ error: dedupeResult.error.message }, 'Deduplication failed')
    await notifyDiscord(`重複除去エラー: ${dedupeResult.error.message}`)
    process.exit(1)
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
    process.exit(1)
  }

  logger.info({ saved: saveResult.value }, 'Collection complete')
  await notifyDiscord(`✅ ${saveResult.value} 件の新しいネタを収集しました`)
}

main().catch(async (e: unknown) => {
  logger.error({ error: String(e) }, 'Unhandled error in collector')
  await notifyDiscord(`致命的エラー: ${String(e)}`)
  process.exit(1)
})
