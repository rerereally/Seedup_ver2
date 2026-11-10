import type {Metadata, Viewport} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Seedup - 만들기 전에 사람들의 말부터',
    template: '%s | Seedup',
  },
  description: '개발자들이 실제로 남긴 불만을 원문과 대조해 모으고, 경쟁 상황을 확인한 뒤 근거가 연결된 PRD로 이어갑니다.',
  openGraph: {
    title: 'Seedup - 만들기 전에 사람들의 말부터',
    description: '입력한 아이디어에 실제 개발자의 증언이 반응합니다. 근거를 모아 PRD까지 만들어 보세요.',
    siteName: 'Seedup',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seedup - 만들기 전에 사람들의 말부터',
    description: '입력한 아이디어에 실제 개발자의 증언이 반응합니다.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" crossOrigin="anonymous" />
      </head>
      <body className="antialiased font-sans flex flex-col min-h-screen" suppressHydrationWarning>
        <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
        {children}
      </body>
    </html>
  );
}
