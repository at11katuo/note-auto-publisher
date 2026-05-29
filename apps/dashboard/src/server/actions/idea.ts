'use server';

import { prisma } from '@note/db';
import { redirect } from 'next/navigation';
import Anthropic from '@anthropic-ai/sdk';
import { runDirector } from '@note/agent';
import {
  SYSTEM_PROMPT,
  buildArticlePrompt,
  buildWriterPrompt,
  DISCLAIMER,
  PROMPT_VERSION,
  PROMPT_VERSION_V2,
} from '@note/prompts';
import { z } from 'zod';

const articleSchema = z.object({
  title: z.string().min(10).max(80),
  tags: z.array(z.string()).min(1).max(10),
  body: z.string().min(500),
});

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return text.trim();
}

export async function generateFromIdea(ideaId: string): Promise<never> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
  if (!idea) throw new Error('ネタが見つかりません');
  if (idea.status === 'used') throw new Error('このネタは既に使用済みです');

  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

  const openrouterKey = process.env['OPENROUTER_API_KEY'];
  const tavilyKey = process.env['TAVILY_API_KEY'];

  let userPrompt: string;
  let imagePrompt: string | null = null;
  let llmModel = 'claude-sonnet-4-5';
  let promptVersion = PROMPT_VERSION;

  // ── Stage 1: Hermes Director（OpenRouter経由）────────────────────────────
  if (openrouterKey) {
    const directorResult = await runDirector(idea, openrouterKey, tavilyKey);
    if (directorResult.isOk()) {
      const director = directorResult.value;
      imagePrompt = director.image_prompt;
      userPrompt = buildWriterPrompt(director, idea);
      llmModel = `gpt-4o-mini+claude-sonnet-4-5`;
      promptVersion = PROMPT_VERSION_V2;
    } else {
      // Director失敗時はシングルステージにフォールバック
      userPrompt = buildArticlePrompt(idea);
    }
  } else {
    userPrompt = buildArticlePrompt(idea);
  }

  // ── Stage 2: Claude Writer ───────────────────────────────────────────────
  const client = new Anthropic({ apiKey: anthropicKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const firstContent = response.content[0];
  if (!firstContent || firstContent.type !== 'text') {
    throw new Error('Claude API から予期しないレスポンスが返されました');
  }

  const parsed = articleSchema.parse(JSON.parse(extractJson(firstContent.text)));
  const bodyWithDisclaimer = parsed.body + DISCLAIMER;

  const draft = await prisma.draft.create({
    data: {
      ideaId: idea.id,
      title: parsed.title,
      body: bodyWithDisclaimer,
      tags: JSON.stringify(parsed.tags),
      charCount: bodyWithDisclaimer.length,
      status: 'draft',
      imagePrompt,
      llmModel,
      promptVersion,
    },
  });

  await prisma.idea.update({
    where: { id: idea.id },
    data: { status: 'used', usedAt: new Date() },
  });

  redirect(`/drafts/${draft.id}`);
}
