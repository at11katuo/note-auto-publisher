import { describe, it, expect } from 'vitest'
import { validateArticle } from '../validate.js'

const baseBody =
  '## はじめに\n' +
  'テスト本文'.repeat(60) +
  '\n\n## 投資戦略について\n' +
  'テスト本文'.repeat(60) +
  '\n\n## NISAの活用\n' +
  'テスト本文'.repeat(60) +
  '\n\n## 終わりに\n' +
  'テスト本文'.repeat(20)

const validDraft = {
  title: 'ETHの長期保有戦略とステーキング利回りの考え方',
  body: baseBody,
  charCount: 2200,
}

describe('validateArticle', () => {
  it('passes a valid article', () => {
    const result = validateArticle(validDraft)
    expect(result.ok).toBe(true)
  })

  it('rejects NG word "衝撃" in title', () => {
    const result = validateArticle({ ...validDraft, title: '衝撃！ETHが急騰' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('衝撃')
  })

  it('rejects NG word "やばい" in body', () => {
    const result = validateArticle({
      ...validDraft,
      body: validDraft.body + 'これはやばい話です',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('やばい')
  })

  it('rejects NG word "絶対儲かる" in body', () => {
    const result = validateArticle({
      ...validDraft,
      body: validDraft.body + '絶対儲かる方法',
    })
    expect(result.ok).toBe(false)
  })

  it('rejects NG word "100%" in body', () => {
    const result = validateArticle({
      ...validDraft,
      body: validDraft.body + '100%確実に上がります',
    })
    expect(result.ok).toBe(false)
  })

  it('rejects article with only 1 H2 heading', () => {
    const result = validateArticle({
      ...validDraft,
      body: '## 一つだけ\n' + 'テスト'.repeat(200),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('H2')
  })

  it('rejects article with 6 H2 headings', () => {
    const manyH2 =
      '## 1\n## 2\n## 3\n## 4\n## 5\n## 6\n' + 'テスト'.repeat(100)
    const result = validateArticle({ ...validDraft, body: manyH2 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('H2')
  })

  it('accepts article with exactly 3 H2 headings', () => {
    const body3h2 =
      '## セクション1\n' +
      'テスト'.repeat(150) +
      '\n\n## セクション2\n' +
      'テスト'.repeat(150) +
      '\n\n## 終わりに\n' +
      'テスト'.repeat(50)
    const result = validateArticle({ ...validDraft, body: body3h2 })
    expect(result.ok).toBe(true)
  })

  it('rejects insufficient character count', () => {
    const result = validateArticle({ ...validDraft, charCount: 1999 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('1999字')
  })

  it('rejects excessive character count', () => {
    const result = validateArticle({ ...validDraft, charCount: 3501 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('3501字')
  })

  it('accumulates multiple violations in reason', () => {
    const result = validateArticle({
      title: '衝撃！絶対儲かる',
      body: '## 一つだけ\nやばい内容',
      charCount: 500,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('衝撃')
      expect(result.reason).toContain('H2')
      expect(result.reason).toContain('文字数')
    }
  })
})
