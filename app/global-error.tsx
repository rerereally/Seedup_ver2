'use client';

// Replaces the root layout when the layout itself fails, so it carries its own document and plain styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fafafa', color: '#151517', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ padding: 24, maxWidth: 480 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>문제가 생겼습니다</h1>
          <p style={{ color: '#6b6b72', lineHeight: 1.7 }}>화면을 불러오지 못했습니다. 잠시 뒤에 다시 시도해 주세요.</p>
          {error.digest && <p style={{ color: '#6b6b72', fontSize: 12 }}>오류 코드 {error.digest}</p>}
          <button type="button" onClick={reset} style={{ marginTop: 16, height: 44, padding: '0 20px', border: 0, borderRadius: 10, background: '#1f6b4a', color: '#ffffff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>다시 시도</button>
        </main>
      </body>
    </html>
  );
}
