import { prisma } from '@note/db'
import { ok, err, type Result } from '@note/shared'
import type { Logger } from '@note/logger'
import type { RawIdea } from './types.js'

const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/仮想通貨|暗号資産|ビットコイン|BTC|crypto/i, 'crypto'],
  [/ETH(?!ernet)|イーサリアム|Ethereum/i, 'eth'],
  [/NISA|ニーサ/i, 'nisa'],
  [/iDeCo|イデコ/i, 'ideco'],
  [/FIRE|早期退職|経済的自立/i, 'fire'],
  [/DeFi|分散型金融/i, 'defi'],
  [/ETF/i, 'etf'],
  [/節税|確定申告|税制|分離課税/i, 'tax'],
  [/副業|サイドビジネス|マイクロ法人/i, 'side-hustle'],
  [/eMAXIS|インデックス|積立/i, 'index-fund'],
]

function inferTopics(text: string): string[] {
  const topics = TOPIC_PATTERNS.filter(([pattern]) => pattern.test(text)).map(
    ([, topic]) => topic,
  )
  return topics.length > 0 ? topics : ['general']
}

export async function saveIdeas(
  ideas: RawIdea[],
  logger: Logger,
): Promise<Result<number, Error>> {
  let saved = 0

  for (const idea of ideas) {
    try {
      const searchText = `${idea.title} ${idea.summary}`
      await prisma.idea.create({
        data: {
          source: idea.source,
          sourceUrl: idea.sourceUrl ?? null,
          title: idea.title,
          summary: idea.summary,
          rawContent: idea.rawContent ?? null,
          topics: JSON.stringify(inferTopics(searchText)),
        },
      })
      saved++
      logger.debug({ title: idea.title }, 'Idea saved')
    } catch (e) {
      logger.error({ title: idea.title, error: String(e) }, 'Failed to save idea')
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  return ok(saved)
}
