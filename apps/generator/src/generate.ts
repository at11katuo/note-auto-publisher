import { z } from 'zod'
import { ok, err, type Result } from '@note/shared'
import { prisma, type Idea, type Draft } from '@note/db'
import {
  SYSTEM_PROMPT,
  buildArticlePrompt,
  buildWriterPrompt,
  DISCLAIMER,
  PROMPT_VERSION,
  PROMPT_VERSION_V2,
} from '@note/prompts'
import { createLogger } from '@note/logger'
import {
  getAnthropicClient,
  MODEL,
  MAX_TOKENS,
  TEMPERATURE,
  callWithRetry,
} from './anthropic.js'
import { runDirector, HERMES_MODEL } from './openrouter.js'
import { validateArticle } from './validate.js'

const logger = createLogger('generator')

const articleSchema = z.object({
  title: z.string().min(20).max(60),
  tags: z.array(z.string()).min(1).max(10),
  body: z.string().min(800),
})

export function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()
  return text.trim()
}

export function countChars(text: string): number {
  return text.replace(/[\s\r\n#*`>\-|~_[\]()!]/g, '').length
}

export async function generateArticle(idea: Idea): Promise<Result<Draft, Error>> {
  const openrouterKey = process.env['OPENROUTER_API_KEY']
  const tavilyKey = process.env['TAVILY_API_KEY']

  let imagePrompt: string | null = null
  let llmModel = MODEL
  let promptVersion = PROMPT_VERSION
  let userPrompt: string

  // ── Stage 1: Hermes Director ─────────────────────────────────────────────
  if (openrouterKey) {
    logger.info({ ideaId: idea.id }, 'Stage 1: Hermes Director starting')

    const directorResult = await runDirector(idea, openrouterKey, tavilyKey)

    if (directorResult.isOk()) {
      const director = directorResult.value
      imagePrompt = director.image_prompt
      userPrompt = buildWriterPrompt(director, idea)
      llmModel = `${HERMES_MODEL}+${MODEL}`
      promptVersion = PROMPT_VERSION_V2
      logger.info(
        { ideaId: idea.id, sections: director.outline.sections.length },
        'Stage 1 complete — outline and image prompt generated',
      )
    } else {
      logger.warn(
        { ideaId: idea.id, err: directorResult.error.message },
        'Stage 1 failed — falling back to single-stage Claude',
      )
      userPrompt = buildArticlePrompt(idea)
    }
  } else {
    logger.info({ ideaId: idea.id }, 'OPENROUTER_API_KEY not set — single-stage Claude')
    userPrompt = buildArticlePrompt(idea)
  }

  // ── Stage 2: Claude Writer ───────────────────────────────────────────────
  const client = getAnthropicClient()

  let rawText: string
  try {
    const response = await callWithRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
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
  const validation = validateArticle({ title: parsed.title, body: bodyWithDisclaimer, charCount })

  if (!validation.ok) {
    logger.warn({ ideaId: idea.id, reason: validation.reason }, 'Article failed validation')
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
        imagePrompt,
        llmModel,
        promptVersion,
      },
    })

    await prisma.idea.update({
      where: { id: idea.id },
      data: { status: 'used', usedAt: new Date() },
    })

    logger.info(
      { draftId: draft.id, status: draft.status, charCount, pipeline: promptVersion },
      'Draft saved',
    )
    return ok(draft)
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}
