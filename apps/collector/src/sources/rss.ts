import Parser from 'rss-parser'
import { ok, type Result } from '@note/shared'
import type { Logger } from '@note/logger'
import type { RawIdea } from '../types.js'
import { RSS_FEEDS } from '../config/feeds.js'

const LOOKBACK_MS = 24 * 60 * 60 * 1000

export async function collectFromRss(logger: Logger): Promise<Result<RawIdea[], Error>> {
  const parser = new Parser()
  const ideas: RawIdea[] = []
  const since = new Date(Date.now() - LOOKBACK_MS)

  for (const feed of RSS_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url)
      let count = 0

      for (const item of result.items) {
        if (!item.title || !item.link) continue
        if (item.isoDate && new Date(item.isoDate) < since) continue

        ideas.push({
          source: 'rss',
          sourceUrl: item.link,
          title: item.title.trim(),
          summary: (item.contentSnippet ?? item.title).slice(0, 200),
          rawContent: item.content ?? item.contentSnippet,
        })
        count++
      }

      logger.info({ feed: feed.name, count }, 'RSS feed collected')
    } catch (e) {
      logger.warn({ feed: feed.name, error: String(e) }, 'RSS feed fetch failed, skipping')
    }
  }

  return ok(ideas)
}
