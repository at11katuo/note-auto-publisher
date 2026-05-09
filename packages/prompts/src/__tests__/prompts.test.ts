import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT } from '../system.js'
import { buildArticlePrompt } from '../article-prompt.js'
import { DISCLAIMER } from '../disclaimer.js'
import { PROMPT_VERSION } from '../version.js'
import type { Idea } from '@note/shared'

const mockIdea: Idea = {
  id: 'test-cuid-001',
  source: 'rss',
  sourceUrl: 'https://coindesk.co.jp/article/eth-staking',
  title: 'ETHステーキング利回りが上昇傾向、長期保有戦略への影響は',
  summary: 'イーサリアムのステーキング報酬が増加しており、長期保有戦略に影響を与える可能性がある。',
  rawContent: 'ETH staking yields have been rising steadily...',
  topics: '["crypto", "eth", "staking"]',
  status: 'new',
  collectedAt: new Date('2026-05-05T00:00:00Z'),
  usedAt: null,
}

describe('SYSTEM_PROMPT', () => {
  it('matches snapshot', () => {
    expect(SYSTEM_PROMPT).toMatchSnapshot()
  })

  it('contains persona definition', () => {
    expect(SYSTEM_PROMPT).toContain('36歳')
    expect(SYSTEM_PROMPT).toContain('電気エンジニア')
    expect(SYSTEM_PROMPT).toContain('サイドFIRE')
  })

  it('lists prohibited expressions', () => {
    expect(SYSTEM_PROMPT).toContain('絶対儲かる')
    expect(SYSTEM_PROMPT).toContain('衝撃')
  })
})

describe('buildArticlePrompt', () => {
  it('matches snapshot', () => {
    expect(buildArticlePrompt(mockIdea)).toMatchSnapshot()
  })

  it('includes idea title and summary', () => {
    const prompt = buildArticlePrompt(mockIdea)
    expect(prompt).toContain(mockIdea.title)
    expect(prompt).toContain(mockIdea.summary)
  })

  it('includes source URL', () => {
    const prompt = buildArticlePrompt(mockIdea)
    expect(prompt).toContain(mockIdea.sourceUrl)
  })

  it('shows (なし) when rawContent is null', () => {
    const prompt = buildArticlePrompt({ ...mockIdea, rawContent: null })
    expect(prompt).toContain('(なし)')
  })

  it('shows (なし) when sourceUrl is null', () => {
    const prompt = buildArticlePrompt({ ...mockIdea, sourceUrl: null })
    expect(prompt).toContain('(なし)')
  })

  it('specifies JSON output format', () => {
    const prompt = buildArticlePrompt(mockIdea)
    expect(prompt).toContain('"title"')
    expect(prompt).toContain('"tags"')
    expect(prompt).toContain('"body"')
  })
})

describe('DISCLAIMER', () => {
  it('starts with newlines for spacing', () => {
    expect(DISCLAIMER).toMatch(/^\n\n---\n/)
  })

  it('contains disclaimer text', () => {
    expect(DISCLAIMER).toContain('個人の見解')
    expect(DISCLAIMER).toContain('投資判断はご自身の責任')
  })
})

describe('PROMPT_VERSION', () => {
  it('follows semver-like pattern', () => {
    expect(PROMPT_VERSION).toMatch(/^v\d+\.\d+\.\d+$/)
  })
})
