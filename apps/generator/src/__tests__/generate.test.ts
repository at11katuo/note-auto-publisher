import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Idea, Draft } from '@note/db'

// vi.hoisted でモック変数を巻き上げ可能にする
const { mockMessagesCreate, mockDraftCreate, mockIdeaUpdate } = vi.hoisted(
  () => ({
    mockMessagesCreate: vi.fn(),
    mockDraftCreate: vi.fn(),
    mockIdeaUpdate: vi.fn(),
  }),
)

vi.mock('../anthropic.js', () => ({
  getAnthropicClient: vi.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
  MODEL: 'claude-sonnet-4-5',
  MAX_TOKENS: 8000,
  TEMPERATURE: 0.7,
  callWithRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@note/db', () => ({
  prisma: {
    draft: { create: mockDraftCreate },
    idea: { update: mockIdeaUpdate },
  },
}))

vi.mock('@note/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { generateArticle, extractJson, countChars } from '../generate.js'

const mockIdea: Idea = {
  id: 'idea-test-001',
  source: 'rss',
  sourceUrl: 'https://coindesk.co.jp/test',
  title: 'ETHステーキング利回りが上昇傾向',
  summary: 'イーサリアムのステーキング報酬が増加している',
  rawContent: null,
  topics: '["crypto"]',
  status: 'new',
  collectedAt: new Date(),
  usedAt: null,
}

const validArticleJson = JSON.stringify({
  title: 'ETHステーキング利回りの上昇と長期保有戦略への影響を考える',
  tags: ['仮想通貨', 'ETH', 'ステーキング', 'FIRE'],
  body:
    '## はじめに\n' +
    '自分がETHを保有し始めて9年が経つ。'.repeat(30) +
    '\n\n## ステーキングの現状\n' +
    'ステーキング利回りは上昇傾向にある。'.repeat(40) +
    '\n\n## 長期保有戦略との関係\n' +
    '長期保有とステーキングは相性がいい。'.repeat(40) +
    '\n\n## NISAとの比較\n' +
    'NISAと比較すると、流動性に違いがある。'.repeat(30) +
    '\n\n## 終わりに\n' +
    '投資は自分のペースで続けることが大切だと思っている。'.repeat(15),
})

const mockDraft: Draft = {
  id: 'draft-test-001',
  ideaId: 'idea-test-001',
  title: 'ETHステーキング利回りの上昇と長期保有戦略への影響を考える',
  body: 'body content',
  tags: '["仮想通貨","ETH"]',
  charCount: 2100,
  status: 'draft',
  generatedAt: new Date(),
  publishedAt: null,
  noteUrl: null,
  rejectReason: null,
  llmModel: 'claude-sonnet-4-5',
  promptVersion: 'v1.0.0',
}

describe('extractJson', () => {
  it('returns plain JSON as-is', () => {
    const json = '{"title":"test"}'
    expect(extractJson(json)).toBe(json)
  })

  it('strips ```json fences', () => {
    const fenced = '```json\n{"title":"test"}\n```'
    expect(extractJson(fenced)).toBe('{"title":"test"}')
  })

  it('strips ``` fences without language tag', () => {
    const fenced = '```\n{"title":"test"}\n```'
    expect(extractJson(fenced)).toBe('{"title":"test"}')
  })
})

describe('countChars', () => {
  it('counts Japanese characters', () => {
    const count = countChars('テスト文字列')
    expect(count).toBeGreaterThan(0)
  })

  it('excludes markdown symbols and whitespace', () => {
    const withSymbols = countChars('## テスト\n\n**太字**')
    const plain = countChars('テスト太字')
    expect(withSymbols).toBe(plain)
  })

  it('returns 0 for empty string', () => {
    expect(countChars('')).toBe(0)
  })
})

describe('generateArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDraftCreate.mockResolvedValue(mockDraft)
    mockIdeaUpdate.mockResolvedValue({ ...mockIdea, status: 'used' })
  })

  it('returns ok with draft on successful generation', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: validArticleJson }],
    })

    const result = await generateArticle(mockIdea)

    expect(result.isOk()).toBe(true)
    expect(mockDraftCreate).toHaveBeenCalledOnce()
    expect(mockIdeaUpdate).toHaveBeenCalledWith({
      where: { id: mockIdea.id },
      data: { status: 'used', usedAt: expect.any(Date) },
    })
  })

  it('saves as "rejected" when validation fails (NG word in response)', async () => {
    const ngJson = JSON.stringify({
      // title ≥20 chars で zod を通過させ、NG ワードで validation を落とす
      title: '衝撃！ETHが絶対儲かると言われる長期保有戦略について',
      tags: ['仮想通貨'],
      body:
        '## はじめに\n' +
        'やばい内容です。投資は慎重に。'.repeat(80) +
        '\n\n## 投資戦略について\n' +
        'テスト本文を書いていく。'.repeat(80) +
        '\n\n## 終わりに\n' +
        'テスト'.repeat(50),
    })
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: ngJson }],
    })

    await generateArticle(mockIdea)

    expect(mockDraftCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rejected' }) }),
    )
  })

  it('returns err when Claude API call fails', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API rate limit'))

    const result = await generateArticle(mockIdea)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toContain('API rate limit')
    expect(mockDraftCreate).not.toHaveBeenCalled()
  })

  it('returns err when response content is not text type', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
    })

    const result = await generateArticle(mockIdea)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toContain('Unexpected')
  })

  it('returns err when response JSON is invalid', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'これはJSONではありません' }],
    })

    const result = await generateArticle(mockIdea)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toContain('Failed to parse')
  })

  it('returns err when JSON fails zod validation', async () => {
    const shortBodyJson = JSON.stringify({
      title: 'short',
      tags: ['タグ'],
      body: '短すぎる本文',
    })
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: shortBodyJson }],
    })

    const result = await generateArticle(mockIdea)

    expect(result.isErr()).toBe(true)
  })

  it('appends DISCLAIMER to body before saving', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: validArticleJson }],
    })

    await generateArticle(mockIdea)

    const createCall = mockDraftCreate.mock.calls[0] as [{ data: { body: string } }]
    expect(createCall[0].data.body).toContain('個人の見解')
  })

  it('strips JSON fences from Claude response', async () => {
    const fencedJson = '```json\n' + validArticleJson + '\n```'
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: fencedJson }],
    })

    const result = await generateArticle(mockIdea)
    expect(result.isOk()).toBe(true)
  })
})
