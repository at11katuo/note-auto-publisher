'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/ideas', label: 'ネタ一覧' },
  { href: '/drafts', label: '下書き一覧' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3">
        <span className="mr-4 text-sm font-bold text-gray-200">note Publisher</span>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              pathname === href
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white',
            )}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
