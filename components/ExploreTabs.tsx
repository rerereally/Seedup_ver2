'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { name: '트렌드', href: '/trends' },
  { name: '오픈소스', href: '/github-trends' },
  { name: 'AI 제품', href: '/ai-products' },
  { name: 'AI 모델', href: '/trends?tab=models' },
  { name: '논문', href: '/news?tab=paper' },
];

/** Heading and tabs shared by every explore page, so they read as one place. `current` names a tab that lives behind a query string. */
export default function ExploreTabs({ current }: { current?: string }) {
  const pathname = usePathname();
  return (
    <header>
      <h1 className="page-intro-title">트렌드</h1>
      <p className="page-intro-description">큐레이션에 쓰이는 자료를 종류별로 모아 두었습니다. 매일 새로 확인합니다.</p>
      <nav className="tabs mt-8" aria-label="자료 종류">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="tab" aria-current={(current ?? pathname) === tab.href ? 'page' : undefined}>{tab.name}</Link>
        ))}
      </nav>
    </header>
  );
}
