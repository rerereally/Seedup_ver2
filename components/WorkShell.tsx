'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const LINKS = [
  { name: '아이디어 평가', href: '/ideas' },
  { name: '보관함', href: '/scrap' },
  { name: '에이전트 연결', href: '/profile' },
];

/** The "my work" pages share one left rail; on a phone it becomes a row of links above the page. */
export default function WorkShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <main id="main-content" className="page-shell grid grow content-start gap-x-12 gap-y-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="side-nav flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="내 작업">
        <p className="hidden px-4 pb-2 text-sm text-muted lg:block">내 작업</p>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href || pathname?.startsWith(`${link.href}/`) ? 'page' : undefined} className="shrink-0 whitespace-nowrap">{link.name}</Link>
        ))}
      </nav>
      <div className="page-stack min-w-0">{children}</div>
    </main>
  );
}
