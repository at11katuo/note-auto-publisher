import { prisma } from '@note/db';

export const revalidate = 0;

const STATUS_LABEL: Record<string, string> = {
  new: '未使用',
  used: '使用済み',
  skipped: 'スキップ',
};

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-900 text-blue-300',
  used: 'bg-green-900 text-green-300',
  skipped: 'bg-gray-800 text-gray-400',
};

const SOURCE_LABEL: Record<string, string> = {
  rss: 'RSS',
  x: 'X',
  manual: '手動',
};

export default async function IdeasPage() {
  const ideas = await prisma.idea.findMany({
    where: { deletedAt: null },
    orderBy: { collectedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      source: true,
      sourceUrl: true,
      status: true,
      topics: true,
      collectedAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">ネタ一覧</h1>
        <span className="text-sm text-gray-500">{ideas.length} 件</span>
      </div>

      {ideas.length === 0 ? (
        <p className="text-center text-gray-500 py-20">ネタがまだありません</p>
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => {
            const topics = JSON.parse(idea.topics) as string[];
            const statusColor = STATUS_COLOR[idea.status] ?? 'bg-gray-800 text-gray-400';
            return (
              <li
                key={idea.id}
                className="rounded-lg border border-gray-800 bg-gray-900 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="flex-1 text-sm font-medium leading-snug">{idea.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                  >
                    {STATUS_LABEL[idea.status] ?? idea.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{SOURCE_LABEL[idea.source] ?? idea.source}</span>
                  <span>{new Date(idea.collectedAt).toLocaleDateString('ja-JP')}</span>
                  {topics.map((t) => (
                    <span key={t} className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-400">
                      {t}
                    </span>
                  ))}
                </div>
                {idea.sourceUrl && (
                  <a
                    href={idea.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-blue-500 hover:underline"
                  >
                    {idea.sourceUrl}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
