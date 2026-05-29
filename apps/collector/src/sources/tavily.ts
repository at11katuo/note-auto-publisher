import { tavily } from '@tavily/core'
import { ok, err, type Result } from '@note/shared'
import type { Logger } from '@note/logger'
import type { RawIdea } from '../types.js'

const SEARCH_QUERIES = [
  '日本 NISA つみたて投資枠 オルカン 最新ニュース',
  'FRB 金利 米国経済 日本株 円相場 最新',
  '日銀 金融政策 為替介入 日経平均 今週',
  '仮想通貨 イーサリアム ビットコイン 相場 最新',
  'iDeCo 確定拠出年金 節税 資産形成 2025',
  'FIRE サイドFIRE 早期退職 資産運用 成功事例',
  '世界経済 景気後退 インフレ 投資戦略 日本人',
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
