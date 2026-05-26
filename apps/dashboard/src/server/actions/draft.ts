'use server';

import { prisma } from '@note/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildArticlePrompt, DISCLAIMER, PROMPT_VERSION } from '@note/prompts';
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

// フォーム経由で呼ぶため第2引数は FormData。id は .bind(null, id) で注入する。
const VALID_STATUSES = ['draft', 'approved', 'rejected', 'published'] as const;
type DraftStatus = (typeof VALID_STATUSES)[number];

export async function updateDraft(id: string, formData: FormData): Promise<void> {
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const body = (formData.get('body') as string | null) ?? '';
  const rawStatus = (formData.get('status') as string | null) ?? '';
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as DraftStatus)
    : undefined;

  await prisma.draft.update({
    where: { id },
    data: {
      title,
      body,
      charCount: body.length,
      ...(status !== undefined ? { status } : {}),
    },
  });

  revalidatePath(`/drafts/${id}`);
  revalidatePath('/drafts');
}

export async function approveDraft(id: string, _formData: FormData): Promise<void> {
  await prisma.draft.update({
    where: { id },
    data: { status: 'approved' },
  });

  revalidatePath(`/drafts/${id}`);
  revalidatePath('/drafts');
  revalidatePath('/');
}

export async function triggerPublish(id: string, _formData?: FormData): Promise<void> {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) {
    throw new Error(`Draft not found: ${id}`);
  }
  if (draft.status !== 'approved') {
    throw new Error(
      `Draft must be approved before publishing (current status: ${draft.status})`,
    );
  }

  // status を publishing に変更し、publisher daemon がポーリングで検知して処理する
  await prisma.draft.update({
    where: { id },
    data: { status: 'publishing' },
  });

  revalidatePath(`/drafts/${id}`);
  revalidatePath('/drafts');
  revalidatePath('/');
}

export async function rejectDraft(id: string, formData: FormData): Promise<void> {
  const reason = (formData.get('reason') as string | null)?.trim() ?? '';

  await prisma.draft.update({
    where: { id },
    data: { status: 'rejected', rejectReason: reason || null },
  });

  revalidatePath(`/drafts/${id}`);
  revalidatePath('/drafts');
  revalidatePath('/');
}

export type RegenerateState = { error: string } | null;

export async function regenerateDraft(
  id: string,
  _prevState: RegenerateState,
  formData: FormData,
): Promise<RegenerateState> {
  const feedback = (formData.get('feedback') as string | null)?.trim() ?? '';
  if (!feedback) return { error: 'フィードバックを入力してください' };

  let newDraftId: string | undefined;
  try {
    const draft = await prisma.draft.findUnique({
      where: { id },
      include: { idea: true },
    });
    if (!draft) return { error: '下書きが見つかりません' };
    if (!draft.idea) return { error: 'この下書きにはネタ情報が紐付いていないため再生成できません' };

    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return { error: 'ANTHROPIC_API_KEY が設定されていません' };

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildArticlePrompt(draft.idea, feedback) }],
    });

    const firstContent = response.content[0];
    if (!firstContent || firstContent.type !== 'text') {
      return { error: 'Claude API から予期しないレスポンスが返されました' };
    }

    const parsed = articleSchema.parse(JSON.parse(extractJson(firstContent.text)));
    const bodyWithDisclaimer = parsed.body + DISCLAIMER;

    const newDraft = await prisma.draft.create({
      data: {
        ideaId: draft.ideaId,
        title: parsed.title,
        body: bodyWithDisclaimer,
        tags: JSON.stringify(parsed.tags),
        charCount: bodyWithDisclaimer.length,
        status: 'draft',
        feedback,
        llmModel: 'claude-sonnet-4-5',
        promptVersion: PROMPT_VERSION,
      },
    });
    newDraftId = newDraft.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath('/drafts');
  revalidatePath('/');
  redirect(`/drafts/${newDraftId}`);
}
