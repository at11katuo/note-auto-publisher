import { tavily } from '@tavily/core'
import { ok, err, type Result } from '@note/shared'
import type { Logger } from '@note/logger'
import type { RawIdea } from '../types.js'

const SEARCH_QUERIES = [
  '日本 NISA オルカン 投資信託 最新ニュース',
  '仮想通貨 イーサリアム ビットコイン 暗号資産 相場',
  '米国経済指標 FRB 金利 株式市場 日本への影響',
  'FIRE 早期退職 資産運用 インデックス投資',
  'iDeCo 確定拠出年金 節税 資産形成',
]

export async function collectFromTavily(logger: Logger): Promise<Result<RawIdea[], Error>> {
  const apiKey = process.env['TAVILY_API_KEY']
  if (!apiKey) {
    logger.info('TAVILY_API_KEY not set, skipping Tavily collection')
    return ok([])
  }

  const client = tavily({ apiKey })
  const ideas: RawIdea[] = []

  for (const query of SEARCH_QUERIES) {
    try {
      const response = await client.search(query, {
        searchDepth: 'basic',
        maxResults: 5,
        includeAnswer: false,
      })

      for (const result of response.results) {
        if (!result.title || !result.content) continue

        ideas.push({
          source: 'tavily',
          sourceUrl: result.url,
          title: result.title.trim(),
          summary: result.content.slice(0, 200),
          rawContent: result.content,
        })
      }

      logger.info({ query, count: response.results.length }, 'Tavily search done')
    } catch (e) {
      logger.warn({ query, error: String(e) }, 'Tavily search failed, skipping')
    }
  }

  return ok(ideas)
}
