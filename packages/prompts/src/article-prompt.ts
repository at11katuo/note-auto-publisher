import type { Idea } from '@note/shared'

export function buildArticlePrompt(idea: Idea): string {
  return `以下のネタを元に、note に投稿する記事を書いてください。

【ネタ情報】
タイトル: ${idea.title}
要約: ${idea.summary}
ソース: ${idea.sourceUrl ?? '(なし)'}
本文抜粋: ${idea.rawContent ?? '(なし)'}

【出力フォーマット】
以下の JSON 形式で厳密に返してください。前置きや説明文は一切不要、JSON のみを出力してください。

{
  "title": "記事タイトル(30〜45字、煽りなし、検索を意識)",
  "tags": ["タグ1", "タグ2", ...],
  "body": "記事本文(markdown、2000〜3500字)"
}

【記事構成の指示】
- 冒頭: 自分の視点での問題提起(150〜250字)
- H2見出し3〜5個、各セクション 400〜700字
- 自分の経験や数字を必ず1つ以上盛り込む
- 末尾に「## 終わりに」セクション(200字程度)
- 最後の免責文はシステム側で挿入するので不要`
}
