'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { saveLang, useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

const LINKS = [
  { name: '오늘의 신호', en: 'Signals', href: '/newsletter-preview' },
  { name: '읽을 글', en: 'Reads', href: '/news' },
  { name: 'PRD', en: 'PRD', href: '/prd' },
  { name: '탐색', en: 'Explore', href: '/trends' },
  { name: '검증 방법', en: 'How we verify', href: '/opportunities' },
];

export default function Footer() {
  const lang = useLang();
  const t = translator(lang);
  const router = useRouter();
  return (
    // The bottom padding clears the phone tab bar.
    <footer className="mt-auto border-t border-outline-soft pb-20 pt-6 lg:pb-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-1 px-5 text-[13px] text-muted sm:px-6 md:px-8">
        <span>© Seedup</span>
        <nav className="flex flex-wrap items-center gap-x-6" aria-label={t('하단 메뉴', 'Footer menu')}>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center whitespace-nowrap transition-colors hover:text-ink">{t(link.name, link.en)}</Link>
          ))}
        </nav>
        {/* The header hides these on phones; here they are reachable at every width. */}
        <span className="ml-auto inline-flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            lang={lang === 'en' ? 'ko' : 'en'}
            onClick={() => { saveLang(lang === 'en' ? 'ko' : 'en'); router.refresh(); }}
            aria-label={lang === 'en' ? '한국어로 보기' : 'View in English'}
            className="inline-flex h-11 items-center px-2 text-[13px] transition-colors hover:text-ink"
          >
            {lang === 'en' ? '한국어' : 'English'}
          </button>
        </span>
      </div>
    </footer>
  );
}
