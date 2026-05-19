import { createLogger } from '@note/logger'
import { prisma } from '@note/db'
import { generateArticle } from './generate.js'
import { notifyDiscord } from './notify.js'

const logger = createLogger('generator')

/** 1サイクルで生成する最大件数 */
const DAEMON_BATCH_SIZE = 3
/** 次のサイクルまでの待機時間 (ms) */
const DAEMON_INTERVAL_MS = 30 * 60 * 1000

const args = process.argv.slice(2)
const ideaIdIdx = args.indexOf('--idea-id')
const batchIdx = args.indexOf('--batch')

const ideaId = ideaIdIdx !== -1 ? (args[ideaIdIdx + 1] ?? null) : null
const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1] ?? '1', 10) : null

async function processBatch(size: number): Promise<{ success: number; fail: number }> {
  const ideas = await prisma.idea.findMany({
    where: { status: 'new' },
    orderBy: { collectedAt: 'desc' },
    take: size,
  })

  if (ideas.length === 0) {
    logger.info('No new ideas to process')
    return { success: 0, fail: 0 }
  }

  logger.info({ count: ideas.length }, 'Starting batch generation')

  let success = 0
  let fail = 0

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    if (!idea) continue

    logger.info({ ideaId: idea.id, title: idea.title }, 'Processing idea')
    const result = await generateArticle(idea)

    if (result.isErr()) {
      logger.error({ ideaId: idea.id, error: result.error.message }, 'Generation failed')
      fail++
    } else {
      logger.info({ draftId: result.value.id, status: result.value.status }, 'Done')
      success++
    }

    // API レート対策: 最後の1件以外は5秒待機
    if (i < ideas.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  return { success, fail }
}

async function runOnce(size: number): Promise<void> {
  const { success, fail } = await processBatch(size)
  const message = `✅ ${success} 件生成完了${fail > 0 ? `（${fail} 件失敗）` : ''}`
  logger.info({ success, fail }, 'Batch generation complete')
  if (success > 0 || fail > 0) {
    await notifyDiscord(message)
  }
}

async function runDaemon(): Promise<never> {
  // 起動時に API キーの存在を確認
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    logger.error('ANTHROPIC_API_KEY is not set — generator cannot start')
    process.exit(1)
  }

  logger.info(
    { batchSize: DAEMON_BATCH_SIZE, intervalMinutes: DAEMON_INTERVAL_MS / 60000 },
    'mode=daemon starting',
  )

  while (true) {
    try {
      await runOnce(DAEMON_BATCH_SIZE)
    } catch (e) {
      logger.error({ error: String(e) }, 'Daemon cycle error')
      await notifyDiscord(`❌ generator サイクルエラー: ${String(e)}`)
    }
    logger.info({ waitMs: DAEMON_INTERVAL_MS }, 'Sleeping until next cycle')
    await new Promise(resolve => setTimeout(resolve, DAEMON_INTERVAL_MS))
  }
}

async function main(): Promise<void> {
  // --idea-id <id>: 特定のネタ1件を生成して終了
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
    await notifyDiscord(`${emoji} 記事生成完了: "${draft.title}"（${draft.status}）`)
    return
  }

  // --batch <n>: 指定件数を生成して終了（手動テスト・CI用）
  if (batchSize !== null) {
    logger.info({ batchSize }, 'mode=batch')
    await runOnce(batchSize)
    return
  }

  // 引数なし: デーモンモード（docker-compose デフォルト）
  await runDaemon()
}

main().catch(async (e: unknown) => {
  logger.error({ error: String(e) }, 'Unhandled error in generator')
  await notifyDiscord(`致命的エラー: ${String(e)}`)
  process.exit(1)
})
