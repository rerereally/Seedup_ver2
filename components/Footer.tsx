import Link from 'next/link';

const LINKS = [
  { name: '검증 방법', href: '/opportunities' },
  { name: '탐색', href: '/trends' },
  { name: '오늘의 신호', href: '/newsletter-preview' },
  { name: '읽을 글', href: '/news' },
];

export default function Footer() {
  return (
    // The bottom padding clears the phone tab bar.
    <footer className="mt-auto border-t border-outline-soft pb-20 pt-6 lg:pb-6">
      <nav className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-1 px-5 text-[13px] text-muted sm:px-6 md:px-8" aria-label="하단 메뉴">
        <span>© Seedup</span>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="inline-flex min-h-10 items-center transition-colors hover:text-ink">{link.name}</Link>
        ))}
      </nav>
    </footer>
  );
}
