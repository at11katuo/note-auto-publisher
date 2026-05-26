'use client';

import { useState } from 'react';

type Props = {
  parentTitle: string;
  parentBody: string;
  parentGeneratedAt: string;
  feedback: string;
};

export function DraftBeforePanel({ parentTitle, parentBody, parentGeneratedAt, feedback }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-amber-800 bg-amber-950/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-amber-400">
          変更前の記事を{open ? '閉じる' : '確認する'}
        </span>
        <span className="text-amber-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-amber-800 px-4 pb-4 pt-3 space-y-4">
          {/* 指摘内容 */}
          <div className="rounded-lg border border-amber-700 bg-amber-900/30 px-3 py-2 text-xs text-amber-300">
            <span className="font-semibold">指摘内容: </span>{feedback}
          </div>

          {/* 変更前タイトル */}
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">
              変更前タイトル
              <span className="ml-2 text-gray-600">
                ({new Date(parentGeneratedAt).toLocaleString('ja-JP')})
              </span>
            </p>
            <p className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">
              {parentTitle}
            </p>
          </div>

          {/* 変更前本文 */}
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">変更前本文</p>
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-400 leading-relaxed">
              {parentBody}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
