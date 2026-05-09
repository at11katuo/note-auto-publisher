import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'note Auto Publisher',
  description: '記事の管理・承認ダッシュボード',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
