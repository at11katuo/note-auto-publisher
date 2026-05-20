/**
 * RSS フィード設定ファイル
 *
 * テーマを変更したいときはここだけ編集してください。
 * url: RSS/Atom フィードの URL
 * name: ログ表示用の短縮名（任意）
 */

export type FeedConfig = {
  /** ログ・デバッグ用ラベル */
  name: string
  /** RSS / Atom フィードの URL */
  url: string
}

export const RSS_FEEDS: readonly FeedConfig[] = [
  // ── テーマ1: インデックス投資・NISA・長期投資 ──────────────────────────
  { name: 'nikkei-markets',  url: 'https://www.nikkei.com/markets/rss/' },
  { name: 'rakuten-toushin', url: 'https://media.rakuten-sec.net/feed' },
  { name: 'minkabu',         url: 'https://minkabu.jp/rss.xml' },
  { name: 'hatena-money',    url: 'https://b.hatena.ne.jp/hotentry/money.rss' },

  // ── テーマ2: Python・GitHub Actions・業務自動化 ───────────────────────
  { name: 'zenn-python',         url: 'https://zenn.dev/topics/python/feed' },
  { name: 'zenn-githubactions',  url: 'https://zenn.dev/topics/githubactions/feed' },
  { name: 'qiita-python',        url: 'https://qiita.com/tags/python/feed' },
  { name: 'qiita-githubactions', url: 'https://qiita.com/tags/githubactions/feed' },
  { name: 'hatena-it',           url: 'https://b.hatena.ne.jp/hotentry/it.rss' },
  { name: 'itmedia-news',        url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml' },

  // ── テーマ3: 筋トレ・ダイエット・健康管理 ────────────────────────────
  { name: 'tarzan',        url: 'https://tarzan.jp/feed/' },
  { name: 'womenshealth',  url: 'https://www.womenshealthmag.com/jp/rss/all/' },
  { name: 'hatena-life',   url: 'https://b.hatena.ne.jp/hotentry/life.rss' },
]
