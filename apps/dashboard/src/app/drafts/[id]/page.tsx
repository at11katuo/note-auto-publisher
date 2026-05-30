import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@note/db';
import { approveDraft, rejectDraft, triggerPublish, updateDraft, regenerateDraft } from '@/server/actions/draft';
import { RegenerateForm } from '@/components/regenerate-form';
import { DraftBeforePanel } from '@/components/draft-before-panel';
import { formatDateTimeJST } from '@/lib/format-date';

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

  const parentDraft = draft.parentDraftId
    ? await prisma.draft.findUnique({
        where: { id: draft.parentDraftId },
        select: { title: true, body: true, generatedAt: true },
      })
    : null;

  const saveAction = updateDraft.bind(null, draft.id);
  const approveAction = approveDraft.bind(null, draft.id);
  const rejectAction = rejectDraft.bind(null, draft.id);
  const publishAction = triggerPublish.bind(null, draft.id);
  const regenerateAction = regenerateDraft.bind(null, draft.id);

  const statusColor = STATUS_COLOR[draft.status] ?? 'bg-gray-800 text-gray-400';
  const isDraft = draft.status === 'draft';
  const isApproved = draft.status === 'approved';
  const canRegenerate = (isDraft || draft.status === 'rejected') && !!draft.ideaId;

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
        {draft.idea && <p>ネタ: <span className="text-gray-300">{draft.idea.title}</span></p>}
        <p>モデル: <span className="text-gray-300">{draft.llmModel}</span> / プロンプト {draft.promptVersion}</p>
        <p>生成日: <span className="text-gray-300">{formatDateTimeJST(draft.generatedAt)}</span></p>
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

      {/* 変更前との比較パネル（再生成後のみ表示） */}
      {parentDraft && draft.feedback && (
        <DraftBeforePanel
          parentTitle={parentDraft.title}
          parentBody={parentDraft.body}
          parentGeneratedAt={parentDraft.generatedAt.toISOString()}
          feedback={draft.feedback}
        />
      )}

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

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300">ステータス</label>
          <select
            name="status"
            defaultValue={draft.status}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="draft">下書き</option>
            <option value="approved">承認済み</option>
            <option value="rejected">却下</option>
            <option value="published">投稿済み</option>
          </select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-gray-700 py-3 text-sm font-semibold text-white hover:bg-gray-600 active:scale-95 transition-transform"
          >
            保存
          </button>
          {isApproved && (
            <button
              type="submit"
              formAction={publishAction}
              className="flex-1 rounded-lg bg-green-700 py-3 text-sm font-semibold text-white hover:bg-green-600 active:scale-95 transition-transform"
            >
              noteへ投稿（Publish）
            </button>
          )}
        </div>
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

      {/* 再生成（下書き・却下のみ、ネタ紐付きの場合のみ） */}
      {canRegenerate && (
        <div className="space-y-3 border-t border-gray-800 pt-6">
          <p className="text-sm font-medium text-gray-400">記事を再生成</p>
          <RegenerateForm action={regenerateAction} prevFeedback={draft.feedback} />
        </div>
      )}
    </main>
  );
}
