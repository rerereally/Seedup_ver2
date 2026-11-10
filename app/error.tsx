'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="page-shell flex min-h-screen grow flex-col items-start justify-center">
      <h1 className="page-intro-title">문제가 생겼습니다</h1>
      <p className="page-intro-description">화면을 그리는 중에 오류가 났습니다. 잠시 뒤에 다시 시도해 주세요.</p>
      {error.digest && <p className="num mt-3 text-xs text-muted">오류 코드 {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          다시 시도
        </button>
        <Link href="/" className="btn-quiet">홈으로</Link>
      </div>
    </main>
  );
}
