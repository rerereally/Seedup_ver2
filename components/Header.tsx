'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, X, UserCircle } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { name: '트렌드', href: '/trends' },
  { name: '아티클', href: '/news' },
  { name: 'GitHub', href: '/github-trends' },
  { name: '프로젝트', href: '/projects' },
  { name: 'AI 랭킹', href: '/ai-products' },
  { name: '스크랩', href: '/scrap' },
  { name: '아이디어 평가', href: '/ideas' },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-outline-soft/70 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4 md:px-8">
        <div className="flex h-full items-center gap-7 lg:gap-9">
          <Link href="/" className="text-xl font-black tracking-tight text-brand-primary">
            Seedup
          </Link>
          
          <nav className="hidden h-full items-center gap-5 lg:flex">
            {NAV_LINKS.map((link) => {
              const isActuallyActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative inline-flex h-full items-center px-1 text-sm font-semibold transition-colors ${
                    isActuallyActive ? 'text-brand-primary' : 'text-[#5f5e5e] hover:text-brand-primary'
                  }`}
                >
                  {link.name}
                  {isActuallyActive && (
                    <span className="absolute bottom-0 left-0 h-[2px] w-full bg-brand-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색"
              className="w-40 rounded-full border border-outline-soft/50 bg-surface-low py-2 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-muted/70 focus:w-52 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
            />
          </form>
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link href="/admin/ingest" className="rounded-full border border-outline-soft px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand-primary hover:text-brand-primary">
                  관리
                </Link>
              )}
              <Link href="/profile" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                <UserCircle className="h-4 w-4" />
                프로필
              </Link>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              로그인
            </Link>
          )}
        </div>

        <button 
          type="button"
          className="text-muted lg:hidden"
          aria-label="메뉴 열기"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="absolute left-0 top-14 flex w-full flex-col gap-4 border-b border-outline-soft/70 bg-white p-4 shadow-lg lg:hidden">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색"
              className="w-full rounded-full border border-outline-soft/60 bg-surface-low py-2 pl-9 pr-4 text-sm outline-none focus:border-brand-primary"
            />
          </form>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActuallyActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block rounded-lg p-3 text-sm font-medium ${
                    isActuallyActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-muted'
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
                <Link href="/admin/ingest" onClick={() => setIsMobileMenuOpen(false)} className="mt-2 w-full rounded-full border border-outline-soft py-2 text-center text-sm font-medium text-ink">
                  관리
                </Link>
              )}
              <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="w-full rounded-full bg-ink py-2 text-center text-sm font-medium text-white">
                프로필
              </Link>
            </>
          ) : (
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="mt-2 w-full rounded-full bg-brand-primary py-2 text-center text-sm font-medium text-white">
              로그인
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
