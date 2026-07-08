import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <section className="w-full max-w-xl rounded-xl border border-outline-soft bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <FileQuestion className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold text-ink">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 leading-7 text-muted">
          요청한 글이 없거나, 아직 Supabase에 데이터가 등록되지 않았을 수 있습니다.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/news" className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            아티클 목록으로
          </Link>
          <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-outline-soft bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-primary hover:text-brand-primary">
            홈으로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
