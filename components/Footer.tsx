import Link from 'next/link';

const LINKS = [
  { name: '기회', href: '/opportunities' },
  { name: '오늘 읽을 것', href: '/news' },
  { name: '트렌드', href: '/trends' },
  { name: '오픈소스', href: '/github-trends' },
  { name: '프로젝트', href: '/projects' },
  { name: 'AI 제품', href: '/ai-products' },
  { name: '아이디어 평가', href: '/ideas' },
  { name: '보관함', href: '/scrap' },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-outline-soft py-10 text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-5 px-5 sm:px-6 md:flex-row md:items-center md:px-8">
        <div>
          <Link href="/" className="text-xl font-extrabold tracking-tight text-ink">Seedup</Link>
          <p className="mt-1 text-sm text-muted">만들기 전에 사람들의 말부터.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted" aria-label="하단 메뉴">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-10 items-center transition-colors hover:text-ink">{link.name}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
