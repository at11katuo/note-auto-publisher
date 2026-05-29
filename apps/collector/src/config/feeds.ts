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
  // ── マーケット・株式・為替 ──────────────────────────────────────────
  { name: 'nikkei-markets',   url: 'https://www.nikkei.com/markets/rss/' },
  { name: 'minkabu',          url: 'https://minkabu.jp/rss.xml' },
  { name: 'kabutan',          url: 'https://kabutan.jp/rss/news/' },
  { name: 'reuters-jp-money', url: 'https://feeds.reuters.com/reuters/JPmoneyNews' },

  // ── 投資信託・NISA・資産運用 ─────────────────────────────────────────
  { name: 'rakuten-toushin',  url: 'https://media.rakuten-sec.net/feed' },
  { name: 'toushi-no-susume', url: 'https://toushi-no-susume.com/feed/' },
  { name: 'hatena-money',     url: 'https://b.hatena.ne.jp/hotentry/money.rss' },

  // ── マクロ経済・金融政策・FRB・日銀 ─────────────────────────────────
  { name: 'diamond-online',   url: 'https://diamond.jp/feed/category/economy' },
  { name: 'toyo-keizai',      url: 'https://toyokeizai.net/list/feed/rss' },
  { name: 'president-online', url: 'https://president.jp/list/economics/rss' },

  // ── 仮想通貨・暗号資産 ───────────────────────────────────────────────
  { name: 'coindesk-jp',      url: 'https://www.coindeskjapan.com/feed/' },
  { name: 'coinpost',         url: 'https://coinpost.jp/?feed=rss2' },
]
