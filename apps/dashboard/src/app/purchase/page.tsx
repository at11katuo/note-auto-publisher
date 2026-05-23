'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PurchasePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const body = {
      investment: form.get('investment') as string,
      date: form.get('date') as string,
      price: form.get('price') as string,
      memo: form.get('memo') as string,
    }

    try {
      const res = await fetch('/api/purchase-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { draftId?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Unknown error')
      router.push(`/drafts/${data.draftId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }

  return (
    <main className="p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">購入報告記事を生成</h1>
        <p className="mt-1 text-sm text-gray-400">買った銘柄・ファンドの情報を入力すると記事を自動生成します</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-300 mb-1">銘柄・ファンド名 *</label>
          <input
            name="investment"
            required
            placeholder="例: eMAXIS Slim 全世界株式（オルカン）"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">購入日 *</label>
          <input
            name="date"
            required
            type="date"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">購入金額・口数 *</label>
          <input
            name="price"
            required
            placeholder="例: 10万円（積立NISA枠）、500口"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">購入理由・メモ</label>
          <textarea
            name="memo"
            rows={4}
            placeholder="例: 先週の米CPI発表後に一時下落したタイミングで追加。長期保有方針は変わらず。"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 px-6 py-3 font-semibold transition-colors"
        >
          {loading ? '生成中...' : '記事を生成する'}
        </button>
      </form>
    </main>
  )
}
