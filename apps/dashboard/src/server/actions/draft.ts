'use server';

import { prisma } from '@note/db';
import { revalidatePath } from 'next/cache';

// フォーム経由で呼ぶため第2引数は FormData。id は .bind(null, id) で注入する。
export async function updateDraft(id: string, formData: FormData): Promise<void> {
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const body = (formData.get('body') as string | null) ?? '';

  await prisma.draft.update({
    where: { id },
    data: {
      title,
      body,
      charCount: body.length,
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
