import stringSimilarity from 'string-similarity'
import { prisma } from '@note/db'
import { ok, err, type Result } from '@note/shared'
import type { Logger } from '@note/logger'
import type { RawIdea } from './types.js'

const SIMILARITY_THRESHOLD = 0.85
const LOOKBACK_DAYS = 7

export async function filterDuplicates(
  ideas: RawIdea[],
  logger: Logger,
): Promise<Result<RawIdea[], Error>> {
  if (ideas.length === 0) return ok([])

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const existing = await prisma.idea.findMany({
      where: { collectedAt: { gte: since } },
      select: { title: true },
    })

    const existingTitles = existing.map((e) => e.title)

    const unique = ideas.filter((idea) => {
      if (existingTitles.length === 0) return true

      const { bestMatch } = stringSimilarity.findBestMatch(idea.title, existingTitles)
      if (bestMatch.rating >= SIMILARITY_THRESHOLD) {
        logger.debug(
          { title: idea.title, similar: bestMatch.target, score: bestMatch.rating },
          'Skipping duplicate idea',
        )
        return false
      }
      return true
    })

    return ok(unique)
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}
