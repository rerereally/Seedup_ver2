'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

const COLUMNS = [
  { name: '리서치', en: 'Research', links: [
    { name: '인사이트', en: 'Insights', href: '/newsletter-preview' },
    { name: '아티클', en: 'Articles', href: '/news' },
    { name: '트렌드', en: 'Trends', href: '/trends' },
  ] },
  { name: '기획', en: 'Plan', links: [
    { name: 'PRD', en: 'PRD', href: '/prd' },
    { name: '아이디어 검증', en: 'Idea validation', href: '/prd?mode=validate' },
    { name: 'MCP 연동', en: 'MCP', href: '/agents' },
    { name: '레포 분석', en: 'Repo analysis', href: '/prd?mode=repo' },
  ] },
  { name: 'Seedup', en: 'Seedup', links: [
    { name: '소개', en: 'About', href: '/about' },
    { name: '가이드', en: 'Guide', href: '/guide' },
    { name: '주간 메일', en: 'Weekly mail', href: '/newsletter-preview?view=issue' },
    { name: '로그인', en: 'Sign in', href: '/login' },
    { name: '이용약관', en: 'Terms', href: '/terms' },
    { name: '개인정보처리방침', en: 'Privacy', href: '/privacy' },
  ] },
];

/** The intro site's footer: a small sitemap. Inside the app shell it is hidden (see globals.css). */
export default function Footer() {
  const lang = useLang();
  const t = translator(lang);
  return (
    <footer className="site-footer mt-auto border-t border-outline-soft pt-14 pb-8">
      <div className="mx-auto grid w-full max-w-[1280px] gap-x-10 gap-y-10 px-5 sm:px-6 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] md:px-8">
        <div>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[17px] font-bold tracking-tight text-ink"><Logo />Seedup</Link>
          <p className="mt-2 max-w-[22em] text-[14px] leading-6 text-muted">{t('개발자가 실제로 쓴 불만에서, 원문이 붙은 PRD를 만듭니다.', 'PRDs from what developers actually wrote, with every source attached.')}</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.name} aria-label={t(column.name, column.en)}>
            <p className="text-[13px] font-semibold text-ink">{t(column.name, column.en)}</p>
            <ul className="mt-2">
              {column.links.map((link) => (
                <li key={link.href}><Link href={link.href} className="inline-flex min-h-10 items-center text-[14px] text-muted transition-colors hover:text-ink">{t(link.name, link.en)}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-10 flex w-full max-w-[1280px] flex-wrap items-center gap-x-6 border-t border-outline-soft px-5 pt-4 text-[13px] text-muted sm:px-6 md:px-8">
        <span>© Seedup</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <ThemeToggle />
        </span>
      </div>
    </footer>
  );
}
