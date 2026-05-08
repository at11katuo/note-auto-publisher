import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@note/db';
import { approveDraft, rejectDraft, updateDraft } from '@/server/actions/draft';

export const revalidate = 0;

const STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  approved: '承認済み',
  published: '投稿済み',
  rejected: '却下',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-yellow-900 text-yellow-300',
  approved: 'bg-blue-900 text-blue-300',
  published: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
};

type Props = { params: { id: string } };

export default async function DraftDetailPage({ params }: Props) {
  const draft = await prisma.draft.findUnique({
    where: { id: params.id },
    include: { idea: { select: { title: true } } },
  });

  if (!draft) notFound();

  const saveAction = updateDraft.bind(null, draft.id);
  const approveAction = approveDraft.bind(null, draft.id);
  const rejectAction = rejectDraft.bind(null, draft.id);

  const statusColor = STATUS_COLOR[draft.status] ?? 'bg-gray-800 text-gray-400';
  const isDraft = draft.status === 'draft';

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/drafts" className="text-sm text-gray-400 hover:text-white">
            ← 下書き一覧
          </Link>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
            {STATUS_LABEL[draft.status] ?? draft.status}
          </span>
        </div>
        <Link
          href={`/drafts/${draft.id}/preview`}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          プレビュー
        </Link>
      </div>

      {/* メタ情報 */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-xs text-gray-500 space-y-1">
        <p>ネタ: <span className="text-gray-300">{draft.idea.title}</span></p>
        <p>モデル: <span className="text-gray-300">{draft.llmModel}</span> / プロンプト v{draft.promptVersion}</p>
        <p>生成日: <span className="text-gray-300">{new Date(draft.generatedAt).toLocaleString('ja-JP')}</span></p>
        <p>文字数: <span className="text-gray-300">{draft.charCount.toLocaleString()} 字</span></p>
        {draft.rejectReason && (
          <p className="text-red-400">却下理由: {draft.rejectReason}</p>
        )}
        {draft.noteUrl && (
          <p>
            投稿URL:{' '}
            <a href={draft.noteUrl} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline break-all">
              {draft.noteUrl}
            </a>
          </p>
        )}
      </div>

      {/* 編集フォーム */}
      <form action={saveAction} className="space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300">タイトル</label>
          <input
            name="title"
            type="text"
            defaultValue={draft.title}
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300">本文（Markdown）</label>
          <textarea
            name="body"
            defaultValue={draft.body}
            required
            rows={20}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-y h-96"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-gray-700 py-3 text-sm font-semibold text-white hover:bg-gray-600 active:scale-95 transition-transform"
        >
          保存
        </button>
      </form>

      {/* 承認・却下（下書きのみ表示） */}
      {isDraft && (
        <div className="space-y-3 border-t border-gray-800 pt-6">
          <p className="text-sm font-medium text-gray-400">アクション</p>

          {/* 承認 */}
          <form action={approveAction}>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-600 active:scale-95 transition-transform"
            >
              承認する
            </button>
          </form>

          {/* 却下 */}
          <form action={rejectAction} className="space-y-2">
            <input
              name="reason"
              type="text"
              placeholder="却下理由（任意）"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-red-800 py-3 text-sm font-semibold text-white hover:bg-red-700 active:scale-95 transition-transform"
            >
              却下する
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
