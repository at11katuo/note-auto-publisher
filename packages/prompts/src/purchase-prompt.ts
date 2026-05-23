export type PurchaseInput = {
  investment: string   // 銘柄・ファンド名
  date: string         // 購入日
  price: string        // 購入価格・金額
  memo: string         // 購入理由・コメント
}

export function buildPurchasePrompt(input: PurchaseInput): string {
  return `以下の購入情報をもとに、note に投稿する「購入報告」記事を書いてください。

【購入情報】
銘柄・ファンド: ${input.investment}
購入日: ${input.date}
購入金額・口数: ${input.price}
購入理由・メモ: ${input.memo}

【出力フォーマット】
以下の JSON 形式で厳密に返してください。前置きや説明文は一切不要、JSON のみを出力してください。

{
  "title": "記事タイトル(30〜45字、煽りなし)",
  "tags": ["タグ1", "タグ2", ...],
  "body": "記事本文(1500〜2500字)"
}

【記事構成の指示】
- 見出し記号（## や # ）は一切使わない。流れるような文章で書く
- 冒頭: 今回何を買ったか、一言で（50〜100字）
- 中盤: なぜ今買ったか（相場環境・自分の方針との整合性）→ 具体的な購入内容（金額・口数など）→ リスクや懸念点も正直に書く
- 末尾: 今後どうするか、保有方針を短く（150〜200字）
- 自分の総資産（約1500万）や積立歴などの数字を文脈に応じて盛り込む
- 最後の免責文はシステム側で挿入するので不要`
}
