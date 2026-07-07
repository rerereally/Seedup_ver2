'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <section className="w-full max-w-xl rounded-xl border border-outline-soft bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold text-ink">오류가 발생했습니다</h1>
        <p className="mt-3 leading-7 text-muted">
          데이터를 불러오거나 페이지를 렌더링하는 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.
        </p>
        {error.digest && <p className="mt-3 text-xs text-muted">오류 코드: {error.digest}</p>}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            다시 시도
          </button>
          <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-outline-soft bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-primary hover:text-brand-primary">
            홈으로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
