import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { prisma } from '@note/db';

export const revalidate = 0;

type Props = { params: { id: string } };

export default async function DraftPreviewPage({ params }: Props) {
  const draft = await prisma.draft.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, body: true, charCount: true },
  });

  if (!draft) notFound();

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 操作バー */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link
            href={`/drafts/${draft.id}`}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 active:scale-95 transition-transform"
          >
            ← 編集に戻る
          </Link>
          <span className="text-xs text-gray-500">{draft.charCount.toLocaleString()} 字</span>
        </div>
      </div>

      {/* noteライクな白背景プレビュー */}
      <div className="mx-auto max-w-2xl px-4 py-10">
        <article className="rounded-2xl bg-white px-6 py-10 shadow-lg sm:px-10">
          <h1 className="mb-8 text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
            {draft.title}
          </h1>
          <div className="prose prose-sm max-w-none text-gray-800
            prose-headings:font-bold prose-headings:text-gray-900
            prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-xl
            prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-lg
            prose-p:leading-relaxed prose-p:mb-4
            prose-ul:pl-5 prose-ul:mb-4 prose-li:mb-1
            prose-ol:pl-5 prose-ol:mb-4
            prose-strong:font-semibold prose-strong:text-gray-900
            prose-blockquote:border-l-4 prose-blockquote:border-gray-300
            prose-blockquote:pl-4 prose-blockquote:text-gray-600 prose-blockquote:italic
            prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-sm
            prose-hr:border-gray-200 prose-hr:my-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {draft.body}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  );
}
