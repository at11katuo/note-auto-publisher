import { prisma } from '@note/db'
import type { Logger } from '@note/logger'

const TRASH_AFTER_MS = 14 * 24 * 60 * 60 * 1000   // 14日でゴミ箱へ
const DELETE_AFTER_MS = 14 * 24 * 60 * 60 * 1000  // ゴミ箱から14日で完全削除

export async function runCleanup(logger: Logger): Promise<void> {
  const now = new Date()
  const trashThreshold = new Date(now.getTime() - TRASH_AFTER_MS)
  const deleteThreshold = new Date(now.getTime() - DELETE_AFTER_MS)

  // ──────────────────────────────────────────────
  // 1. 完全削除: ゴミ箱入りから14日経過したもの
  // ──────────────────────────────────────────────
  const deletedDrafts = await prisma.draft.deleteMany({
    where: {
      deletedAt: { lte: deleteThreshold },
      // 投稿済みは削除しない
      status: { not: 'published' },
    },
  })
  const deletedIdeas = await prisma.idea.deleteMany({
    where: { deletedAt: { lte: deleteThreshold } },
  })

  if (deletedDrafts.count > 0 || deletedIdeas.count > 0) {
    logger.info(
      { drafts: deletedDrafts.count, ideas: deletedIdeas.count },
      'Permanently deleted trashed items',
    )
  }

  // ──────────────────────────────────────────────
  // 2. ゴミ箱へ: 14日間ためこんだ未使用アイテム
  // ──────────────────────────────────────────────
  const trashedDrafts = await prisma.draft.updateMany({
    where: {
      deletedAt: null,
      status: { in: ['draft', 'rejected'] },
      generatedAt: { lte: trashThreshold },
    },
    data: { deletedAt: now },
  })
  const trashedIdeas = await prisma.idea.updateMany({
    where: {
      deletedAt: null,
      status: { in: ['new', 'skipped'] },
      collectedAt: { lte: trashThreshold },
    },
    data: { deletedAt: now },
  })

  if (trashedDrafts.count > 0 || trashedIdeas.count > 0) {
    logger.info(
      { drafts: trashedDrafts.count, ideas: trashedIdeas.count },
      'Moved old items to trash',
    )
  }
}
