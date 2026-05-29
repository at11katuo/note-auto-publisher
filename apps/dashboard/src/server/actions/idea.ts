'use server';

import { prisma } from '@note/db';
import { redirect } from 'next/navigation';
import Anthropic from '@anthropic-ai/sdk';
import {
  SYSTEM_PROMPT,
  buildArticlePrompt,
  DISCLAIMER,
  PROMPT_VERSION,
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

function addBulletToParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const trimmed = para.trimStart();
      if (!trimmed) return para;
      return trimmed.startsWith('●') ? para : `● ${trimmed}`;
    })
    .join('\n\n');
}

export async function generateFromIdea(ideaId: string): Promise<never> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
  if (!idea) throw new Error('ネタが見つかりません');
  if (idea.status === 'used') throw new Error('このネタは既に使用済みです');

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildArticlePrompt(idea) }],
  });

  const firstContent = response.content[0];
  if (!firstContent || firstContent.type !== 'text') {
    throw new Error('Claude API から予期しないレスポンスが返されました');
  }

  const parsed = articleSchema.parse(JSON.parse(extractJson(firstContent.text)));
  const bodyWithDisclaimer = addBulletToParagraphs(parsed.body) + DISCLAIMER;

  const draft = await prisma.draft.create({
    data: {
      ideaId: idea.id,
      title: parsed.title,
      body: bodyWithDisclaimer,
      tags: JSON.stringify(parsed.tags),
      charCount: bodyWithDisclaimer.length,
      status: 'draft',
      llmModel: 'claude-sonnet-4-5',
      promptVersion: PROMPT_VERSION,
    },
  });

  await prisma.idea.update({
    where: { id: idea.id },
    data: { status: 'used', usedAt: new Date() },
  });

  redirect(`/drafts/${draft.id}`);
}
