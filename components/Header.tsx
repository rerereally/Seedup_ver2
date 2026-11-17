'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, FileText, GitBranch, List, Mail, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import { saveLang, useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

// `match` lists every route that keeps the tab lit, since explore and my-work each span several pages.
const NAV = [
  // Signals (the map, this week's issue, every problem) and the reading feed are separate places.
  { name: '오늘의 신호', en: 'Signals', href: '/newsletter-preview', match: ['/newsletter-preview', '/opportunities'], icon: Mail },
  { name: '읽을 글', en: 'Reads', href: '/news', match: ['/news', '/papers'], icon: List },
  { name: 'PRD', en: 'PRD', href: '/prd', match: ['/prd', '/spec'], icon: FileText },
  { name: '내 저장소', en: 'My repo', href: '/seeds', match: ['/seeds'], icon: GitBranch },
];
const EXPLORE = { name: '탐색', en: 'Explore', href: '/trends', match: ['/trends', '/github-trends', '/ai-products', '/projects'], icon: Compass };
const WORK = ['/ideas', '/scrap', '/profile'];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const lang = useLang();
  const t = translator(lang);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const update = (next?: string | null) => {
      setEmail(next ?? null);
      if (!next) return setIsAdmin(false);
      fetch('/api/auth/is-admin')
        .then((response) => (response.ok ? response.json() : { isAdmin: false }))
        .then((result: { isAdmin?: boolean }) => setIsAdmin(Boolean(result.isAdmin)))
        .catch(() => setIsAdmin(false));
    };
    supabase.auth.getUser().then(({ data }) => update(data.user?.email));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => update(session?.user.email));
    return () => listener.subscription.unsubscribe();
  }, []);

  // The idea workspace is a full-screen tool: it has its own make action and needs the bottom of a phone screen.
  const workspace = pathname?.startsWith('/prd/new') ?? false;
  const on = (match: string[]) => match.some((href) => pathname === href || pathname?.startsWith(`${href}/`));
  const link = (item: { name: string; en: string; href: string; match: string[] }) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={on(item.match) ? 'page' : undefined}
      className={`-mb-px inline-flex h-16 items-center border-b-2 text-[15px] transition-colors ${on(item.match) ? 'border-ink font-semibold text-ink' : 'border-transparent text-tertiary hover:text-ink'}`}
    >
      {t(item.name, item.en)}
    </Link>
  );
  const switchLang = () => {
    saveLang(lang === 'en' ? 'ko' : 'en');
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-outline-soft bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-5 sm:px-6 md:px-8 lg:gap-6">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[19px] font-bold tracking-tight text-ink">
            <Logo />
            Seedup
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label={t('주요 메뉴', 'Main menu')}>
            {NAV.map(link)}
            <span aria-hidden="true" className="h-4 w-px bg-outline-strong" />
            {link(EXPLORE)}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href="/search" aria-label={t('검색', 'Search')} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-tertiary transition-colors hover:bg-surface-low hover:text-ink">
              <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            {isAdmin && <Link href="/admin/ingest" className="hidden h-10 items-center px-2 text-sm text-tertiary hover:text-ink sm:inline-flex">{t('관리', 'Admin')}</Link>}
            {/* On phones the theme and language switches live in the footer, so the bar keeps the brand, search and the action. */}
            <span className="hidden sm:contents"><ThemeToggle /></span>
            <button type="button" onClick={switchLang} lang={lang === 'en' ? 'ko' : 'en'} className="hidden h-11 items-center px-2 text-sm text-tertiary hover:text-ink sm:inline-flex" aria-label={lang === 'en' ? '한국어로 보기' : 'View in English'}>
              {lang === 'en' ? '한국어' : 'EN'}
            </button>
            {email ? (
              <Link href="/scrap" aria-current={on(WORK) ? 'page' : undefined} aria-label={t('내 작업', 'My work')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-soft bg-white p-1 text-sm font-medium text-ink transition-colors hover:border-outline-strong lg:pr-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-seed-soft text-sm font-semibold text-seed">{email[0].toUpperCase()}</span>
                <span className="hidden lg:inline">{t('내 작업', 'My work')}</span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="inline-flex h-11 items-center whitespace-nowrap px-2 text-sm text-ink">{t('로그인', 'Sign in')}</Link>
                {!workspace && <Link href="/prd/new" className="btn h-11 whitespace-nowrap px-3.5 sm:px-4">{t('PRD 만들기', 'Make a PRD')}</Link>}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Phones get the five places as a bottom bar, so the top row stays just the brand and the account. */}
      <nav className={`fixed inset-x-0 bottom-0 z-50 grid-cols-5 border-t ${workspace ? 'hidden' : 'grid'} border-outline-soft bg-white pb-[env(safe-area-inset-bottom)] lg:hidden`} aria-label={t('모바일 주요 메뉴', 'Mobile menu')}>
        {[...NAV, EXPLORE].map((item) => (
          <Link key={item.href} href={item.href} aria-current={on(item.match) ? 'page' : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] ${on(item.match) ? 'font-semibold text-seed' : 'text-muted'}`}>
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {t(item.name, item.en)}
          </Link>
        ))}
      </nav>
    </>
  );
}
