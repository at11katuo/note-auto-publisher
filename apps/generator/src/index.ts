import { createLogger } from '@note/logger'
import { prisma } from '@note/db'
import { generateArticle } from './generate.js'
import { notifyDiscord } from './notify.js'

const logger = createLogger('generator')

const args = process.argv.slice(2)
const ideaIdIdx = args.indexOf('--idea-id')
const batchIdx = args.indexOf('--batch')

const ideaId = ideaIdIdx !== -1 ? (args[ideaIdIdx + 1] ?? null) : null
const batchSize =
  batchIdx !== -1 ? parseInt(args[batchIdx + 1] ?? '1', 10) : 1

async function main(): Promise<void> {
  if (ideaId) {
    logger.info({ ideaId }, 'Processing specific idea')
    const idea = await prisma.idea.findUnique({ where: { id: ideaId } })
    if (!idea) {
      logger.error({ ideaId }, 'Idea not found')
      await notifyDiscord(`❌ Idea が見つかりません: ${ideaId}`)
      process.exit(1)
    }
    const result = await generateArticle(idea)
    if (result.isErr()) {
      logger.error({ error: result.error.message }, 'Generation failed')
      await notifyDiscord(`❌ 記事生成エラー: ${result.error.message}`)
      process.exit(1)
    }
    const draft = result.value
    const emoji = draft.status === 'rejected' ? '⚠️' : '✅'
    logger.info({ draftId: draft.id, status: draft.status }, 'Done')
    await notifyDiscord(
      `${emoji} 記事生成完了: "${draft.title}"（${draft.status}）`,
    )
    return
  }

  const ideas = await prisma.idea.findMany({
    where: { status: 'new' },
    orderBy: { collectedAt: 'desc' },
    take: batchSize,
  })

  if (ideas.length === 0) {
    logger.info('No new ideas to process')
    return
  }

  logger.info({ count: ideas.length }, 'Starting batch generation')

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    if (!idea) continue

    logger.info({ ideaId: idea.id, title: idea.title }, 'Processing idea')
    const result = await generateArticle(idea)

    if (result.isErr()) {
      logger.error(
        { ideaId: idea.id, error: result.error.message },
        'Generation failed',
      )
      failCount++
    } else {
      logger.info(
        { draftId: result.value.id, status: result.value.status },
        'Done',
      )
      successCount++
    }

    // API レート対策: 最後の1件以外は5秒待機
    if (i < ideas.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  const message = `✅ ${successCount} 件生成完了${failCount > 0 ? `（${failCount} 件失敗）` : ''}`
  logger.info({ successCount, failCount }, 'Batch generation complete')
  await notifyDiscord(message)
}

main().catch(async (e: unknown) => {
  logger.error({ error: String(e) }, 'Unhandled error in generator')
  await notifyDiscord(`致命的エラー: ${String(e)}`)
  process.exit(1)
})
