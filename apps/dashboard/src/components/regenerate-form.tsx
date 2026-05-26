'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { RegenerateState } from '@/server/actions/draft';

type Props = {
  action: (prevState: RegenerateState, formData: FormData) => Promise<RegenerateState>;
  prevFeedback?: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-purple-700 py-3 text-sm font-semibold text-white hover:bg-purple-600 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          再生成中…（30〜60秒かかります）
        </span>
      ) : (
        '指摘を反映して再生成'
      )}
    </button>
  );
}

export function RegenerateForm({ action, prevFeedback }: Props) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-2">
      <textarea
        name="feedback"
        required
        rows={4}
        placeholder="修正の指示を入力してください（例: 導入部をもっと口語体にして、専門用語を減らして読みやすくしてほしい）"
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none resize-y"
      />
      {state?.error && (
        <p className="rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
      <SubmitButton />
      {prevFeedback && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-xs text-gray-400">
          <span className="text-gray-500">前回の指摘: </span>{prevFeedback}
        </div>
      )}
    </form>
  );
}
