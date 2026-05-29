import { prisma } from '@note/db'
import type { Logger } from '@note/logger'

/** 取り込みから3日経過したデータを削除する */
const RETAIN_MS = 3 * 24 * 60 * 60 * 1000

export async function runCleanup(logger: Logger): Promise<void> {
  const threshold = new Date(Date.now() - RETAIN_MS)

  // ── Ideas: 収集から3日経過した未使用ネタを削除 ───────────────────────────
  // 'used' は記事生成済みのため除外
  const deletedIdeas = await prisma.idea.deleteMany({
    where: {
      collectedAt: { lte: threshold },
      status: { not: 'used' },
    },
  })

  // ── Drafts: 生成から3日経過した未投稿下書きを削除 ────────────────────────
  // 'published' は投稿済みのため除外
  const deletedDrafts = await prisma.draft.deleteMany({
    where: {
      generatedAt: { lte: threshold },
      status: { not: 'published' },
    },
  })

  // ── 手動削除済み(deletedAt あり)のアイテムも即時削除 ──────────────────────
  const deletedTrashedIdeas = await prisma.idea.deleteMany({
    where: { deletedAt: { not: null } },
  })
  const deletedTrashedDrafts = await prisma.draft.deleteMany({
    where: {
      deletedAt: { not: null },
      status: { not: 'published' },
    },
  })

  const totalIdeas = deletedIdeas.count + deletedTrashedIdeas.count
  const totalDrafts = deletedDrafts.count + deletedTrashedDrafts.count

  if (totalIdeas > 0 || totalDrafts > 0) {
    logger.info(
      { ideas: totalIdeas, drafts: totalDrafts },
      'Cleanup: deleted old items (3-day retention)',
    )
  } else {
    logger.info('Cleanup: nothing to delete')
  }
}
