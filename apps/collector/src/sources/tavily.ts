import { tavily } from '@tavily/core'
import { ok, type Result } from '@note/shared'
import type { Logger } from '@note/logger'
import type { RawIdea } from '../types.js'

/** JST での今日の日付ラベル（例: 2026年6月2日） */
function getTodayJST(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ── 投資・経済ニュース記事クエリ ──────────────────────────────────
// days:1 で当日分のみ取得
const ARTICLE_QUERIES = [
  'NISA つみたて投資枠 オルカン 最新ニュース',
  'FRB 金利 米国経済 日本株 円相場',
  '日銀 金融政策 為替介入 日経平均',
  'iDeCo 確定拠出年金 節税 資産形成',
  '世界株式 インフレ 投資戦略 日本人投資家',
]

// ── 経済指標・マーケットデータクエリ ────────────────────────────
// クエリに当日の日付を埋め込み + days:2 で週末・祝日もカバー
function getMarketQueries(today: string): string[] {
  return [
    `日経平均株価 終値 ${today}`,
    `ドル円 為替レート ${today}`,
    `S&P500 米国株 終値 ${today}`,
    `eMAXIS Slim 全世界株式 オルカン 基準価額 ${today}`,
    `金価格 ゴールド 円建て ${today}`,
  ]
}

export async function collectFromTavily(logger: Logger): Promise<Result<RawIdea[], Error>> {
  const apiKey = process.env['TAVILY_API_KEY']
  if (!apiKey) {
    logger.info('TAVILY_API_KEY not set, skipping Tavily collection')
    return ok([])
  }

  const client = tavily({ apiKey })
  const ideas: RawIdea[] = []
  const today = getTodayJST()

  // ① 当日の経済ニュース記事（days:1 で当日のみ）
  for (const query of ARTICLE_QUERIES) {
    try {
      const response = await client.search(query, {
        searchDepth: 'basic',
        maxResults: 3,
        includeAnswer: false,
        days: 1,
      })

      for (const result of response.results) {
        if (!result.title || !result.content) continue
        ideas.push({
          source: 'tavily',
          sourceUrl: result.url,
          title: result.title.trim(),
          summary: result.content.slice(0, 300),
          rawContent: result.content,
        })
      }

      logger.info({ query, count: response.results.length }, 'Tavily article search done')
    } catch (e) {
      logger.warn({ query, error: String(e) }, 'Tavily article search failed, skipping')
    }
  }

  // ② 当日の経済指標・マーケットサマリー（days:2 で週末・祝日でも前日をカバー）
  for (const query of getMarketQueries(today)) {
    try {
      const response = await client.search(query, {
        searchDepth: 'advanced',
        maxResults: 3,
        includeAnswer: true,
        days: 2,
      })

      // Tavily の answer（AI要約）があれば先頭に追加
      if (response.answer) {
        ideas.push({
          source: 'tavily',
          title: `【市場データ】${query}`,
          summary: response.answer.slice(0, 500),
          rawContent: response.answer,
        })
      }

      for (const result of response.results) {
        if (!result.title || !result.content) continue
        ideas.push({
          source: 'tavily',
          sourceUrl: result.url,
          title: `【市場】${result.title.trim()}`,
          summary: result.content.slice(0, 300),
          rawContent: result.content,
        })
      }

      logger.info({ query, count: response.results.length }, 'Tavily market search done')
    } catch (e) {
      logger.warn({ query, error: String(e) }, 'Tavily market search failed, skipping')
    }
  }

  logger.info({ total: ideas.length, today }, 'Tavily collection complete')
  return ok(ideas)
}
