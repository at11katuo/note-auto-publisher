import Link from 'next/link';
import { getDashboardStats } from '@/lib/stats';

export const revalidate = 0;

type StatCardProps = {
  label: string;
  value: number;
  accent?: string;
  href?: string;
};

function StatCard({ label, value, accent = 'text-white', href }: StatCardProps) {
  const inner = (
    <div className="rounded-lg bg-gray-900 border border-gray-800 p-5 hover:border-gray-600 hover:bg-gray-800 transition-colors">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          ネタ（Ideas）
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="合計" value={stats.ideas.total} href="/ideas" />
          <StatCard label="未使用" value={stats.ideas.new} accent="text-blue-400" href="/ideas" />
          <StatCard label="使用済み" value={stats.ideas.used} accent="text-green-400" href="/ideas" />
          <StatCard label="スキップ" value={stats.ideas.skipped} accent="text-gray-500" href="/ideas" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          下書き（Drafts）
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="合計" value={stats.drafts.total} href="/drafts" />
          <StatCard label="下書き" value={stats.drafts.draft} accent="text-yellow-400" href="/drafts" />
          <StatCard label="承認済み" value={stats.drafts.approved} accent="text-blue-400" href="/drafts" />
          <StatCard label="投稿済み" value={stats.drafts.published} accent="text-green-400" href="/drafts" />
          <StatCard label="却下" value={stats.drafts.rejected} accent="text-red-400" href="/drafts" />
        </div>
      </section>
    </main>
  );
}
