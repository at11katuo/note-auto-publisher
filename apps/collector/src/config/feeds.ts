/**
 * RSS フィード設定ファイル
 *
 * テーマを変更したいときはここだけ編集してください。
 * url: RSS/Atom フィードの URL
 * name: ログ表示用の短縮名（任意）
 *
 * 参考: フィード URL の探し方
 *   - サイト URL の末尾に /feed, /rss, /rss.xml, /atom.xml を試す
 *   - ブラウザの「フィードを検出」拡張機能を使う
 */

export type FeedConfig = {
  /** ログ・デバッグ用ラベル */
  name: string
  /** RSS / Atom フィードの URL */
  url: string
}

export const RSS_FEEDS: readonly FeedConfig[] = [
  // ── インデックス投資・NISA ──────────────────────────────────────────
  { name: 'nikkei-markets', url: 'https://www.nikkei.com/markets/rss/' },
  { name: 'minkabu',        url: 'https://minkabu.jp/rss.xml' },
  { name: 'reuters-biz',   url: 'https://jp.reuters.com/rssFeed/businessNews' },

  // ── 仮想通貨・Web3 ────────────────────────────────────────────────
  // { name: 'coindeskjp',   url: 'https://www.coindeskjapan.com/feed/' },
  // { name: 'neweconomy',   url: 'https://www.neweconomy.jp/feed' },

  // ── テック・プログラミング ────────────────────────────────────────
  // { name: 'zenn-python',  url: 'https://zenn.dev/topics/python/feed' },
  // { name: 'qiita-python', url: 'https://qiita.com/tags/python/feed' },
  // { name: 'dev-to',       url: 'https://dev.to/feed/tag/python' },

  // ── フィットネス・健康 ────────────────────────────────────────────
  // { name: 'womenshealth', url: 'https://www.womenshealthmag.com/jp/rss/all/' },
  // { name: 'tarzan',       url: 'https://tarzan.jp/feed/' },

  // ── ライフスタイル・FIRE ──────────────────────────────────────────
  // { name: 'president',    url: 'https://president.jp/list/rss/article' },
]
