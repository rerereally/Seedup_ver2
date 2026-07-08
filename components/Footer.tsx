import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-ink bg-white py-10 text-ink">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-8 px-4 md:px-10">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div>
            <Link href="/" className="text-2xl font-black tracking-tight text-ink">
              Seedup
            </Link>
            <p className="mt-2 text-xs font-bold uppercase text-muted">
              © 2026 Seedup System. Curating news into code.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-5 text-xs font-bold uppercase text-muted">
            <Link href="/trends" className="transition-colors hover:text-ink">트렌드</Link>
            <Link href="/news" className="transition-colors hover:text-ink">아티클</Link>
            <Link href="/github-trends" className="transition-colors hover:text-ink">오픈소스</Link>
            <Link href="/projects" className="transition-colors hover:text-ink">프로젝트</Link>
            <Link href="/ai-products" className="transition-colors hover:text-ink">AI 제품</Link>
            <Link href="/ideas" className="transition-colors hover:text-ink">아이디어 평가</Link>
            <Link href="/scrap" className="transition-colors hover:text-ink">내 보관함</Link>
          </nav>
        </div>
        <div className="grid gap-4 border-t border-outline-soft pt-6 text-xs font-bold uppercase text-muted md:grid-cols-3">
          <div className="border border-outline-soft bg-surface p-3">System Status: Online</div>
          <div className="border border-outline-soft bg-surface p-3">Deployment: Weekly Digest</div>
          <div className="border border-outline-soft bg-surface p-3">Signal/Noise: High</div>
        </div>
      </div>
    </footer>
  );
}
