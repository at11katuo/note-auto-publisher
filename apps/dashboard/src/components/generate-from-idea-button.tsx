'use client';

import { useTransition } from 'react';
import { generateFromIdea } from '@/server/actions/idea';

export function GenerateFromIdeaButton({ ideaId }: { ideaId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => generateFromIdea(ideaId))}
      className="shrink-0 rounded-md bg-indigo-700 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? '生成中…' : '記事を生成'}
    </button>
  );
}
