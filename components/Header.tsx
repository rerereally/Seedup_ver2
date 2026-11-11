'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, Search, Sprout, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const PRIMARY_LINKS = [
  { name: '기회', href: '/opportunities' },
  { name: '내 씨앗', href: '/seeds' },
  { name: '아이디어 평가', href: '/ideas' },
  { name: '보관함', href: '/scrap' },
];

const MORE_LINKS = [
  { name: '오늘 읽을 것', href: '/news' },
  { name: '트렌드', href: '/trends' },
  { name: '오픈소스', href: '/github-trends' },
  { name: 'AI 제품', href: '/ai-products' },
  { name: '프로젝트', href: '/projects' },
];

const pill = 'inline-flex min-h-9 items-center rounded-full px-3.5 text-sm transition-colors';

export default function Header({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const mobileMenuId = useId();
  const moreMenuId = useId();
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const updateAuthState = (email?: string | null) => {
      setIsLoggedIn(Boolean(email));
      if (!email) {
        setIsAdmin(false);
        return;
      }
      fetch('/api/auth/is-admin')
        .then((response) => (response.ok ? response.json() : { isAdmin: false }))
        .then((result: { isAdmin?: boolean }) => setIsAdmin(Boolean(result.isAdmin)))
        .catch(() => setIsAdmin(false));
    };

    supabase.auth.getUser().then(({ data }) => updateAuthState(data.user?.email));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthState(session?.user.email);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen && !isMoreOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsMoreOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setIsMoreOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMobileMenuOpen, isMoreOpen]);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  const account = isLoggedIn ? { href: '/profile', label: '프로필' } : { href: '/login', label: '로그인' };
  const position = overlay
    ? 'pointer-events-none absolute inset-x-0 top-0 z-[60]'
    : 'sticky top-0 z-50 border-b border-outline-soft bg-surface/90 backdrop-blur';

  return (
    <header className={position}>
      <div className="mx-auto flex min-h-16 w-full items-center justify-between gap-3 px-5 py-3 md:px-6 [&>*]:pointer-events-auto">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[19px] font-extrabold tracking-tight text-ink">
          <Sprout className="h-[22px] w-[22px] text-hot" aria-hidden="true" />
          Seedup
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full bg-[rgba(255,255,255,.05)] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,.09)] lg:flex" aria-label="주요 메뉴">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`${pill} ${isActive(link.href) ? 'bg-surface-high text-ink' : 'text-muted hover:text-ink'}`}
            >
              {link.name}
            </Link>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={`${pill} gap-1 text-muted hover:text-ink`}
              aria-expanded={isMoreOpen}
              aria-controls={moreMenuId}
              onClick={() => setIsMoreOpen((open) => !open)}
            >
              더보기
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {isMoreOpen && (
              <div id={moreMenuId} className="absolute right-0 top-full mt-2 flex w-40 flex-col gap-0.5 rounded-2xl border border-outline-soft bg-surface-lowest p-1.5 shadow-xl">
                {MORE_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setIsMoreOpen(false)} className="flex min-h-10 items-center rounded-xl px-3 text-sm text-muted hover:bg-surface-mid hover:text-ink">
                    {link.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/search" aria-label="검색" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-mid hover:text-ink">
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
          {isAdmin && (
            <Link href="/admin/ingest" className="inline-flex h-10 items-center rounded-full px-3 text-sm text-muted hover:text-ink">관리</Link>
          )}
          <Link href={account.href} className="inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-bold text-white transition-opacity hover:opacity-90">
            {account.label}
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink lg:hidden"
          aria-label={isMobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-controls={mobileMenuId}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div id={mobileMenuId} className="pointer-events-auto absolute inset-x-2 top-16 flex max-h-[calc(100dvh-5rem)] flex-col gap-1 overflow-y-auto rounded-3xl border border-outline-soft bg-surface-lowest p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-2xl lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="모바일 주요 메뉴">
            {[...PRIMARY_LINKS, ...MORE_LINKS, { name: '검색', href: '/search' }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex min-h-11 items-center rounded-2xl px-4 text-[15px] ${isActive(link.href) ? 'bg-surface-high font-bold text-ink' : 'text-muted'}`}
              >
                {link.name}
              </Link>
            ))}
            {isAdmin && <Link href="/admin/ingest" onClick={() => setIsMobileMenuOpen(false)} className="flex min-h-11 items-center rounded-2xl px-4 text-[15px] text-muted">관리</Link>}
          </nav>
          <Link href={account.href} onClick={() => setIsMobileMenuOpen(false)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
            {account.label}
          </Link>
        </div>
      )}
    </header>
  );
}
