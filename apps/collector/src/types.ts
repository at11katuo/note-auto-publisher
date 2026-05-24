export type RawIdea = {
  source: 'rss' | 'x' | 'tavily'
  sourceUrl?: string
  title: string
  summary: string
  rawContent?: string
}
