import type { Idea } from '@note/shared'

export type DirectorOutput = {
  outline: {
    sections: Array<{ heading: string; points: string[] }>
  }
  image_prompt: string
  key_facts?: string[]
}

export function buildWriterPrompt(outline: DirectorOutput, idea: Idea): string {
  const sectionsText = outline.outline.sections
    .map(
      (s, i) =>
        `【第${i + 1}章: ${s.heading}】\n${s.points.map((p) => `・${p}`).join('\n')}`,
    )
    .join('\n\n')

  const factsText =
    (outline.key_facts ?? []).length > 0
      ? (outline.key_facts ?? []).map((f) => `・${f}`).join('\n')
      : '(なし)'

  return `以下の構成案と参考事実に基づいて、note に投稿する記事を書いてください。

【ネタ情報】
タイトル: ${idea.title}
要約: ${idea.summary}
ソース: ${idea.sourceUrl ?? '(なし)'}

【記事構成案（AIディレクターが最新検索に基づき作成）】
${sectionsText}

【参考事実・最新データ（ウェブ検索から収集済み）】
${factsText}

【出力フォーマット】
以下の JSON 形式で厳密に返してください。前置きや説明文は一切不要、JSON のみを出力してください。

{
  "title": "記事タイトル(30〜45字、煽りなし、検索を意識)",
  "tags": ["タグ1", "タグ2", ...],
  "body": "記事本文(2000〜3500字)"
}

【記事執筆の指示】
- 見出し記号（## や #）は一切使わない。流れるような文章で書く
- 冒頭: 自分がこの話題をどう受け止めたか、個人的な文脈から入る（150〜250字）
- 中盤: 構成案の各章を順に展開する。参考事実・最新データを自然に織り交ぜる
- 末尾: 「結局どうするか」自分の方針を短く締める（150〜200字）
- 段落間は空行を入れて読みやすく
- 自分の保有資産（約1500万円、オルカン積立中）への具体的な影響・感想を必ず1箇所以上入れる
- 最後の免責文はシステム側で挿入するので不要`
}
