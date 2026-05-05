import { ok, err, type Result } from '@note/shared'
import type { Logger } from '@note/logger'
import type { RawIdea } from '../types.js'

const SEARCH_QUERY =
  'NISA OR iDeCo OR FIRE OR 仮想通貨 OR ETH lang:ja -is:retweet'
const MAX_RESULTS = 10
const X_API_BASE = 'https://api.twitter.com/2'

type TweetData = {
  id: string
  text: string
  created_at?: string
}

type SearchResponse = {
  data?: TweetData[]
  meta?: { result_count: number }
  errors?: Array<{ message: string }>
}

export async function collectFromX(logger: Logger): Promise<Result<RawIdea[], Error>> {
  const bearerToken = process.env['X_BEARER_TOKEN']
  if (!bearerToken) {
    logger.info('X_BEARER_TOKEN not set, skipping X collection')
    return ok([])
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const params = new URLSearchParams({
    query: SEARCH_QUERY,
    max_results: String(MAX_RESULTS),
    start_time: since,
    'tweet.fields': 'created_at',
    sort_order: 'relevancy',
  })

  try {
    const response = await fetch(`${X_API_BASE}/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })

    if (!response.ok) {
      const body = await response.text()
      return err(new Error(`X API error ${response.status}: ${body}`))
    }

    const data = (await response.json()) as SearchResponse

    if (data.errors) {
      return err(new Error(`X API errors: ${JSON.stringify(data.errors)}`))
    }

    if (!data.data || data.data.length === 0) {
      logger.info('No tweets found from X')
      return ok([])
    }

    const ideas: RawIdea[] = data.data.map((tweet) => ({
      source: 'x' as const,
      sourceUrl: `https://twitter.com/i/web/status/${tweet.id}`,
      title: tweet.text.slice(0, 100).replace(/\n/g, ' '),
      summary: tweet.text.slice(0, 200),
      rawContent: tweet.text,
    }))

    logger.info({ count: ideas.length }, 'X tweets collected')
    return ok(ideas)
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}
