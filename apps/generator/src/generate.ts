import { z } from 'zod'
import { ok, err, type Result } from '@note/shared'
import { prisma, type Idea, type Draft } from '@note/db'
import {
  SYSTEM_PROMPT,
  buildArticlePrompt,
  DISCLAIMER,
  PROMPT_VERSION,
} from '@note/prompts'
import { createLogger } from '@note/logger'
import {
  getAnthropicClient,
  MODEL,
  MAX_TOKENS,
  TEMPERATURE,
  callWithRetry,
} from './anthropic.js'
import { validateArticle } from './validate.js'

const logger = createLogger('generator')

const articleSchema = z.object({
  title: z.string().min(20).max(60),
  tags: z.array(z.string()).min(1).max(10),
  body: z.string().min(1500),
})

export function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()
  return text.trim()
}

export function countChars(text: string): number {
  // 改行・マークダウン記号・空白を除いた実質文字数
  return text.replace(/[\s\r\n#*`>\-|~_[\]()!]/g, '').length
}

export async function generateArticle(
  idea: Idea,
): Promise<Result<Draft, Error>> {
  const client = getAnthropicClient()

  let rawText: string
  try {
    const response = await callWithRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildArticlePrompt(idea) }],
      }),
    )

    const firstContent = response.content[0]
    if (!firstContent || firstContent.type !== 'text') {
      return err(new Error('Unexpected response format from Claude API'))
    }
    rawText = firstContent.text
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }

  let parsed: z.infer<typeof articleSchema>
  try {
    const json = extractJson(rawText)
    parsed = articleSchema.parse(JSON.parse(json))
  } catch (error) {
    return err(
      new Error(
        `Failed to parse Claude response: ${String(error)}\nRaw (first 300 chars): ${rawText.slice(0, 300)}`,
      ),
    )
  }

  const bodyWithDisclaimer = parsed.body + DISCLAIMER
  const charCount = countChars(bodyWithDisclaimer)
  const validation = validateArticle({
    title: parsed.title,
    body: bodyWithDisclaimer,
    charCount,
  })

  if (!validation.ok) {
    logger.warn(
      { ideaId: idea.id, reason: validation.reason },
      'Article failed validation',
    )
  }

  try {
    const draft = await prisma.draft.create({
      data: {
        ideaId: idea.id,
        title: parsed.title,
        body: bodyWithDisclaimer,
        tags: JSON.stringify(parsed.tags),
        charCount,
        status: validation.ok ? 'draft' : 'rejected',
        rejectReason: validation.ok ? null : validation.reason,
        llmModel: MODEL,
        promptVersion: PROMPT_VERSION,
      },
    })

    await prisma.idea.update({
      where: { id: idea.id },
      data: { status: 'used', usedAt: new Date() },
    })

    logger.info(
      { draftId: draft.id, status: draft.status, charCount },
      'Draft saved',
    )
    return ok(draft)
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}
