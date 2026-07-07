import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-outline-soft/60 bg-[#191c1d] py-10 text-white">
      <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center md:px-10">
        <div>
          <Link href="/" className="text-2xl font-bold tracking-tight text-brand-primary">
            Seedup
          </Link>
          <p className="mt-2 text-sm text-white/60">
            © 2026 Seedup. Cultivating news into code.
          </p>
        </div>
        
        <nav className="flex flex-wrap items-center gap-5 text-sm text-white/60">
          <Link href="/news" className="transition-colors hover:text-white">뉴스</Link>
          <Link href="/trends" className="transition-colors hover:text-white">트렌드</Link>
          <Link href="/projects" className="transition-colors hover:text-white">프로젝트</Link>
          <Link href="/ideas" className="transition-colors hover:text-white">아이디어 평가</Link>
        </nav>
      </div>
    </footer>
  );
}
