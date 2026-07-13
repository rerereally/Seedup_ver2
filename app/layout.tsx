import type {Metadata, Viewport} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Seedup - 개발 트렌드를 프로젝트로 연결하는 성장 플랫폼',
    template: '%s | Seedup',
  },
  description: '개발 뉴스, 논문, GitHub 오픈소스, AI 제품 흐름을 분석해 내 수준에 맞는 아티클과 프로젝트 아이디어로 연결합니다.',
  openGraph: {
    title: 'Seedup - 개발 트렌드를 프로젝트로 연결하는 성장 플랫폼',
    description: '읽고 끝나는 개발 콘텐츠를 저장, 분석, 프로젝트 아이디어, 아이디어 평가 흐름으로 이어보세요.',
    siteName: 'Seedup',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seedup - 개발 트렌드를 프로젝트로 연결하는 성장 플랫폼',
    description: '개발 트렌드와 오픈소스를 내 성장 루틴과 프로젝트 후보로 바꿔보세요.',
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
      <body className="antialiased font-sans flex flex-col min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
