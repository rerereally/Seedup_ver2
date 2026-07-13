'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, X, UserCircle, TerminalSquare } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const GUEST_NAV_LINKS = [
  { name: '아티클', href: '/news' },
  { name: '오픈소스', href: '/github-trends' },
  { name: 'AI 제품', href: '/ai-products' },
  { name: '트렌드', href: '/trends' },
];

const MEMBER_NAV_LINKS = [
  { name: '트렌드', href: '/trends' },
  { name: '아티클', href: '/news' },
  { name: '오픈소스', href: '/github-trends' },
  { name: '프로젝트', href: '/projects' },
  { name: 'AI 제품', href: '/ai-products' },
  { name: '아이디어 평가', href: '/ideas' },
  { name: '내 보관함', href: '/scrap' },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const desktopSearchId = useId();
  const mobileSearchId = useId();
  const mobileMenuId = useId();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const updateAuthState = (email?: string | null) => {
      setIsLoggedIn(Boolean(email));
      setIsAdmin(Boolean(email && adminEmails.includes(email.toLowerCase())));
    };

    supabase.auth.getUser().then(({ data }) => updateAuthState(data.user?.email));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthState(session?.user.email);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
    setIsMobileMenuOpen(false);
  };
  const navLinks = isLoggedIn ? MEMBER_NAV_LINKS : GUEST_NAV_LINKS;

  return (
    <header className="sticky top-0 z-50 border-b border-ink bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center justify-between px-4 md:px-10">
        <div className="flex h-full items-center gap-7 lg:gap-9">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-black tracking-tight text-ink">
            <TerminalSquare className="h-5 w-5" />
            Seedup
          </Link>
          
          <nav className="hidden h-full items-center gap-5 lg:flex">
            {navLinks.map((link) => {
              const isActuallyActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative inline-flex h-full items-center px-1 text-xs font-bold uppercase transition-colors ${
                    isActuallyActive ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {link.name}
                  {isActuallyActive && (
                    <span className="absolute bottom-0 left-0 h-[2px] w-full bg-ink" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <form onSubmit={handleSearch} className="relative">
            <label htmlFor={desktopSearchId} className="sr-only">Seedup 콘텐츠 검색</label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id={desktopSearchId}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색"
              className="h-10 w-40 border border-outline-soft bg-white py-2 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-muted/70 focus:w-52 focus:border-ink"
            />
          </form>
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link href="/admin/ingest" className="inline-flex h-10 items-center border border-outline-soft px-4 text-xs font-bold uppercase text-ink transition-colors hover:border-ink">
                  관리
                </Link>
              )}
              <Link href="/profile" className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-xs font-bold uppercase text-white transition-opacity hover:opacity-90">
                <UserCircle className="h-4 w-4" />
                프로필
              </Link>
            </>
          ) : (
            <Link href="/login" className="inline-flex h-10 items-center bg-ink px-4 text-xs font-bold uppercase text-white transition-opacity hover:opacity-90">
              로그인
            </Link>
          )}
        </div>

        <button 
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
          aria-label={isMobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-controls={mobileMenuId}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div id={mobileMenuId} className="absolute left-0 top-14 flex max-h-[calc(100dvh-3.5rem)] w-full flex-col gap-4 overflow-y-auto border-b border-ink bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg lg:hidden">
          <form onSubmit={handleSearch} className="relative w-full">
            <label htmlFor={mobileSearchId} className="sr-only">Seedup 콘텐츠 검색</label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id={mobileSearchId}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색"
              className="h-11 w-full border border-outline-soft bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-ink"
            />
          </form>
          <nav className="flex flex-col gap-1" aria-label="모바일 주요 메뉴">
            {navLinks.map((link) => {
              const isActuallyActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex min-h-11 items-center border p-3 text-sm font-bold ${
                    isActuallyActive ? 'border-ink bg-ink text-white' : 'border-outline-soft text-muted'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link href="/admin/ingest" onClick={() => setIsMobileMenuOpen(false)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center border border-outline-soft py-2 text-center text-sm font-bold text-ink">
                  관리
                </Link>
              )}
              <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="inline-flex min-h-11 w-full items-center justify-center bg-ink py-2 text-center text-sm font-bold text-white">
                프로필
              </Link>
            </>
          ) : (
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center bg-ink py-2 text-center text-sm font-bold text-white">
              로그인
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
