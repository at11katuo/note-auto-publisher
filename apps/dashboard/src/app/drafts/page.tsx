import Link from 'next/link';
import { prisma } from '@note/db';
import { formatDateJST } from '@/lib/format-date';

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

export default async function DraftsPage() {
  const drafts = await prisma.draft.findMany({
    where: { deletedAt: null },
    orderBy: { generatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      charCount: true,
      status: true,
      llmModel: true,
      promptVersion: true,
      generatedAt: true,
      publishedAt: true,
      noteUrl: true,
      rejectReason: true,
      idea: { select: { title: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">下書き一覧</h1>
        <span className="text-sm text-gray-500">{drafts.length} 件</span>
      </div>

      {drafts.length === 0 ? (
        <p className="text-center text-gray-500 py-20">下書きがまだありません</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => {
            const statusColor = STATUS_COLOR[draft.status] ?? 'bg-gray-800 text-gray-400';
            return (
              <li key={draft.id}>
                <Link
                  href={`/drafts/${draft.id}`}
                  className="block rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-600 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="flex-1 text-sm font-medium leading-snug">{draft.title}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                    >
                      {STATUS_LABEL[draft.status] ?? draft.status}
                    </span>
                  </div>

                  {draft.idea && (
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      ネタ: {draft.idea.title}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{draft.charCount.toLocaleString()} 字</span>
                    <span>{draft.llmModel}</span>
                    <span>{draft.promptVersion}</span>
                    <span>{formatDateJST(draft.generatedAt)}</span>
                  </div>

                  {draft.rejectReason && (
                    <p className="mt-1 text-xs text-red-400">却下理由: {draft.rejectReason}</p>
                  )}

                  {draft.noteUrl && (
                    <p className="mt-1 truncate text-xs text-blue-500">{draft.noteUrl}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
