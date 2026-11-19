'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bookmark, Compass, FileText, House, List, LogOut, Mail, Menu, PanelLeftClose, PanelLeftOpen, Plug, Search, Settings, X } from 'lucide-react';
import { signOut } from '@/app/actions/profile';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import { saveLang, useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

type NavItem = { name: string; en: string; href: string; match: string[]; icon: LucideIcon };

// `match` lists every route that keeps the item lit, since several items span more than one page.
const HOME: NavItem = { name: '홈', en: 'Home', href: '/', match: [], icon: House };
const SIGNALS: NavItem = { name: '인사이트', en: 'Insights', href: '/newsletter-preview', match: ['/newsletter-preview', '/opportunities'], icon: Mail };
const READS: NavItem = { name: '아티클', en: 'Articles', href: '/news', match: ['/news', '/papers'], icon: List };
const EXPLORE: NavItem = { name: '트렌드', en: 'Trends', href: '/trends', match: ['/trends', '/github-trends', '/ai-products', '/projects'], icon: Compass };
const PRD: NavItem = { name: 'PRD', en: 'PRD', href: '/prd', match: ['/prd', '/spec', '/ideas', '/seeds'], icon: FileText };
const AGENT: NavItem = { name: 'MCP 연동', en: 'MCP', href: '/agents', match: ['/agents'], icon: Plug };
const SCRAP: NavItem = { name: '북마크', en: 'Bookmarks', href: '/scrap', match: ['/scrap'], icon: Bookmark };

const GROUPS: Array<{ name: string; en: string; items: NavItem[] }> = [
  { name: '리서치', en: 'Research', items: [SIGNALS, READS, EXPLORE] },
  { name: '기획', en: 'Plan', items: [PRD, AGENT] },
  { name: '내 작업', en: 'My work', items: [SCRAP] },
];
// Phones: the four places used most, the rest is in the drawer.
const TABS = [HOME, SIGNALS, PRD, SCRAP];

// The desk is the signed-in front page; it lights only on exactly "/".
const isOn = (pathname: string | null, item: NavItem) =>
  item.href === '/' ? pathname === '/' : item.match.some((href) => pathname === href || pathname?.startsWith(`${href}/`));

// Every page renders its own Header, so the shell mounts again on each navigation. What it learned (who is signed in,
// whether they are an admin, whether the menu is folded) is kept here for the tab's life, so a page change does not
// flash the signed-out buttons, drop the admin link or unfold the menu before the same values come back.
const remembered: { email: string | null; isAdmin: boolean; folded: boolean | null } = { email: null, isAdmin: false, folded: null };

function useAccount() {
  const [email, setEmail] = useState<string | null>(remembered.email);
  const [isAdmin, setIsAdmin] = useState(remembered.isAdmin);
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    // The listener's first event carries the session from the cookie, so the header needs no network call of its
    // own; the admin check runs once per signed-in address, not on every auth event.
    let checked: string | null = remembered.email;
    const admin = (value: boolean) => {
      remembered.isAdmin = value;
      setIsAdmin(value);
    };
    const update = (next?: string | null) => {
      remembered.email = next ?? null;
      setEmail(next ?? null);
      if (!next) {
        checked = null;
        return admin(false);
      }
      if (checked === next) return;
      checked = next;
      fetch('/api/auth/is-admin')
        .then((response) => (response.ok ? response.json() : { isAdmin: false }))
        .then((result: { isAdmin?: boolean }) => admin(Boolean(result.isAdmin)))
        .catch(() => admin(false));
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => update(session?.user.email));
    return () => listener.subscription.unsubscribe();
  }, []);
  return { email, isAdmin };
}

/**
 * The app shell (default): a fixed left sidebar on wide screens, a top bar with a drawer and a bottom tab bar on phones.
 * `variant="site"` is the intro site's top bar, used by the signed-out landing.
 */
export default function Header({ variant = 'app' }: { variant?: 'app' | 'site' }) {
  return variant === 'site' ? <SiteHeader /> : <AppShell />;
}

function LangButton({ className }: { className: string }) {
  const lang = useLang();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => { saveLang(lang === 'en' ? 'ko' : 'en'); router.refresh(); }}
      lang={lang === 'en' ? 'ko' : 'en'}
      aria-label={lang === 'en' ? '한국어로 보기' : 'View in English'}
      className={className}
    >
      {lang === 'en' ? '한국어' : 'EN'}
    </button>
  );
}

function AppShell() {
  const pathname = usePathname();
  const router = useRouter();
  const t = translator(useLang());
  const { email, isAdmin } = useAccount();
  const [open, setOpen] = useState(false);
  // The /prd work screens (PRD, idea check, repo analysis): two panes, so the sidebar starts folded on wide screens
  // and phones give the bottom of the screen to the chat box instead of the tab bar.
  const workspace = ['/prd/new', '/prd/validate', '/prd/repo'].some((path) => pathname?.startsWith(path));
  // Wide screens: the sidebar folds to an icon rail and back, pushing the page. The PRD workspace starts folded.
  const [folded, setFoldedState] = useState<boolean | null>(remembered.folded);
  const setFolded = (value: boolean) => {
    remembered.folded = value;
    setFoldedState(value);
  };
  const rail = folded ?? workspace;

  // A link in the drawer navigates; the drawer then closes on the new page.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        router.push('/search');
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const item = (entry: NavItem) => (
    <Link key={entry.href} href={entry.href} aria-current={isOn(pathname, entry) ? 'page' : undefined}>
      <entry.icon aria-hidden="true" />
      {t(entry.name, entry.en)}
    </Link>
  );

  const nav = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-[17px] font-bold tracking-tight text-ink">
          <Logo />
          Seedup
        </Link>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('메뉴 닫기', 'Close menu')} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-tertiary hover:bg-surface-low lg:hidden">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setFolded(true)} aria-label={t('메뉴 접기', 'Collapse menu')} title={t('메뉴 접기', 'Collapse menu')} className="hidden h-9 w-9 items-center justify-center rounded-lg text-tertiary hover:bg-surface-low hover:text-ink lg:inline-flex">
          <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
      <div className="px-3">
        <Link href="/search" className="flex h-9 w-full items-center gap-2 rounded-lg border border-outline-soft bg-white px-2.5 text-[14px] text-muted transition-colors hover:border-outline-strong">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="grow">{t('검색', 'Search')}</span>
          <span className="kbd hidden lg:inline-flex">⌘K</span>
        </Link>
      </div>
      <nav className="app-nav mt-3 flex grow flex-col gap-5 overflow-y-auto px-3 pb-4" aria-label={t('주요 메뉴', 'Main menu')}>
        <div className="flex flex-col gap-0.5">{item(HOME)}</div>
        {GROUPS.map((group) => (
          <div key={group.name} className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1 text-[12px] font-semibold text-muted">{t(group.name, group.en)}</p>
            {group.items.map(item)}
          </div>
        ))}
        {isAdmin && (
          <div className="flex flex-col gap-0.5">
            <Link href="/admin/ingest" aria-current={pathname?.startsWith('/admin') ? 'page' : undefined}>
              <Settings aria-hidden="true" />
              {t('관리', 'Admin')}
            </Link>
          </div>
        )}
      </nav>
      <div className="shrink-0 border-t border-outline-soft p-3">
        {email ? (
          <div className="flex items-center gap-1">
            <Link href="/profile" className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 text-[14px] text-ink hover:bg-surface-low">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-seed-soft text-[13px] font-semibold text-seed">{email[0].toUpperCase()}</span>
              <span className="min-w-0 truncate">{email}</span>
            </Link>
            <form action={signOut}>
              <button type="submit" aria-label={t('로그아웃', 'Sign out')} title={t('로그아웃', 'Sign out')} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-tertiary hover:bg-surface-low hover:text-ink">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link href="/login" className="btn-quiet h-9 flex-1">{t('로그인', 'Sign in')}</Link>
            {!pathname?.startsWith('/prd') && !pathname?.startsWith('/newsletter-preview') && <Link href="/prd/new" className="btn h-9 flex-1">{t('PRD 만들기', 'Make a PRD')}</Link>}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1">
          <ThemeToggle />
          <LangButton className="inline-flex h-11 items-center px-2 text-[13px] text-tertiary hover:text-ink" />
        </div>
      </div>
    </>
  );

  return (
    <>
      {rail ? (
        <aside style={{ viewTransitionName: 'app-sidebar' }} className="app-sidebar is-rail fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center gap-1 border-r border-outline-soft bg-white py-3 lg:flex">
          <button type="button" onClick={() => setFolded(false)} aria-label={t('메뉴 펼치기', 'Expand menu')} title={t('메뉴 펼치기', 'Expand menu')} className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-tertiary hover:bg-surface-low hover:text-ink">
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          {[HOME, ...GROUPS.flatMap((group) => group.items)].map((entry) => (
            <Link key={entry.href} href={entry.href} aria-label={t(entry.name, entry.en)} title={t(entry.name, entry.en)} aria-current={isOn(pathname, entry) ? 'page' : undefined} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-surface-low ${isOn(pathname, entry) ? 'bg-surface-mid text-ink' : 'text-muted'}`}>
              <entry.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
          ))}
          <span className="mt-auto"><ThemeToggle /></span>
        </aside>
      ) : (
        <aside style={{ viewTransitionName: 'app-sidebar' }} className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-outline-soft bg-white lg:flex">{nav}</aside>
      )}

      <header style={{ viewTransitionName: 'app-topbar' }} className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-outline-soft bg-surface px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label={t('메뉴 열기', 'Open menu')} aria-expanded={open} className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-tertiary hover:bg-surface-low">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[17px] font-bold tracking-tight text-ink">
          <Logo />
          Seedup
        </Link>
        <Link href="/search" aria-label={t('검색', 'Search')} className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg text-tertiary hover:bg-surface-low">
          <Search className="h-5 w-5" aria-hidden="true" />
        </Link>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('메뉴', 'Menu')}>
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('메뉴 닫기', 'Close menu')} onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-outline-soft bg-surface">{nav}</aside>
        </div>
      )}

      {!workspace && (
        <nav style={{ viewTransitionName: 'app-tabbar' }} className="app-tabbar fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-outline-soft bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label={t('모바일 주요 메뉴', 'Mobile menu')}>
          {TABS.map((entry) => (
            <Link key={entry.href} href={entry.href} aria-current={isOn(pathname, entry) ? 'page' : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] ${isOn(pathname, entry) ? 'font-semibold text-seed' : 'text-muted'}`}>
              <entry.icon className="h-5 w-5" aria-hidden="true" />
              {t(entry.name, entry.en)}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

/** The intro site's top bar: the brand and one action. Everything else is on the page itself or in the footer. */
const SITE_TABS: Array<[string, string, string]> = [
  ['인사이트', 'Insights', '/newsletter-preview'],
  ['아티클', 'Articles', '/news'],
  ['트렌드', 'Trends', '/trends'],
  ['PRD', 'PRD', '/prd'],
];

function SiteHeader() {
  const t = translator(useLang());
  const { email } = useAccount();
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-outline-soft bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-3 px-5 sm:px-6 md:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[19px] font-bold tracking-tight text-ink">
          <Logo />
          Seedup
        </Link>
        {/* The original top tabs, kept for now so every main page is one click away. */}
        <nav className="ml-6 hidden items-center gap-6 lg:flex" aria-label={t('주요 메뉴', 'Main menu')}>
          {SITE_TABS.map(([ko, en, href]) => (
            <Link key={href} href={href} aria-current={pathname?.startsWith(href) ? 'page' : undefined} className="inline-flex h-11 items-center text-sm text-tertiary transition-colors hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink">{t(ko, en)}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {email ? (
            <Link href="/" className="btn h-10 whitespace-nowrap px-4">{t('홈으로', 'Home')}</Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex h-11 items-center whitespace-nowrap px-2 text-sm text-ink">{t('로그인', 'Sign in')}</Link>
              <Link href="/prd/new" className="btn h-10 whitespace-nowrap px-4">{t('무료로 시작하기', 'Start free')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
