import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { prisma } from '@note/db'
import { SYSTEM_PROMPT, buildPurchasePrompt, DISCLAIMER } from '@note/prompts'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  investment: z.string().min(1),
  date: z.string().min(1),
  price: z.string().min(1),
  memo: z.string(),
})

const articleSchema = z.object({
  title: z.string().min(1),
  tags: z.array(z.string()),
  body: z.string().min(1),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  let input: z.infer<typeof bodySchema>
  try {
    input = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })

  let rawText: string
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 6000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPurchasePrompt(input) }],
    })
    const first = response.content[0]
    if (!first || first.type !== 'text') throw new Error('Unexpected response')
    rawText = first.text
  } catch (e) {
    return NextResponse.json({ error: `Claude API error: ${String(e)}` }, { status: 500 })
  }

  let parsed: z.infer<typeof articleSchema>
  try {
    const jsonStr = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? rawText.trim()
    parsed = articleSchema.parse(JSON.parse(jsonStr))
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response', raw: rawText.slice(0, 300) }, { status: 500 })
  }

  const body = parsed.body + DISCLAIMER
  const draft = await prisma.draft.create({
    data: {
      title: parsed.title,
      body,
      tags: JSON.stringify(parsed.tags),
      charCount: body.replace(/[\s\r\n#*`>\-|~_[\]()!]/g, '').length,
      status: 'draft',
      llmModel: 'claude-sonnet-4-5',
      promptVersion: 'purchase-v1',
    },
  })

  return NextResponse.json({ draftId: draft.id })
}
