const NG_WORDS = ['絶対儲かる', '100%', '衝撃', 'やばい'] as const

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export function validateArticle(draft: {
  title: string
  body: string
  charCount: number
}): ValidationResult {
  const violations: string[] = []

  const fullText = `${draft.title}\n${draft.body}`
  for (const word of NG_WORDS) {
    if (fullText.includes(word)) {
      violations.push(`NG ワード「${word}」が含まれています`)
    }
  }

  const h2Count = (draft.body.match(/^## /gm) ?? []).length
  if (h2Count < 3 || h2Count > 5) {
    violations.push(`H2 見出しは3〜5個必要ですが、${h2Count}個あります`)
  }

  if (draft.charCount < 2000) {
    violations.push(`文字数が不足しています（${draft.charCount}字、最低2000字必要）`)
  } else if (draft.charCount > 3500) {
    violations.push(`文字数が超過しています（${draft.charCount}字、最大3500字）`)
  }

  if (violations.length > 0) {
    return { ok: false, reason: violations.join('\n') }
  }
  return { ok: true }
}
