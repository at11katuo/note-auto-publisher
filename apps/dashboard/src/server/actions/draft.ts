'use server';

import { prisma } from '@note/db';
import { revalidatePath } from 'next/cache';

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
