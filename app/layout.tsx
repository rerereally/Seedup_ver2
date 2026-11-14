import type {Metadata, Viewport} from 'next';
import './globals.css';
import LangProvider from '@/components/LangProvider';
import { getLang } from '@/lib/i18n-server';

const COPY = {
  ko: { title: 'Seedup - 만들기 전에 사람들의 말부터', description: '개발자들이 실제로 남긴 불만을 원문과 대조해 모으고, 경쟁 상황을 확인한 뒤 근거가 연결된 PRD로 이어갑니다.', short: '입력한 아이디어에 실제 개발자의 증언이 반응합니다. 근거를 모아 PRD까지 만들어 보세요.', locale: 'ko_KR' },
  en: { title: 'Seedup - Hear developers before you build', description: 'Real developer complaints, verified against the source, checked for competition, and turned into evidence-traced PRDs.', short: 'Real developer quotes react to your idea. Collect the evidence and turn it into a PRD.', locale: 'en_US' },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[await getLang()];
  return {
    title: { default: copy.title, template: '%s | Seedup' },
    description: copy.description,
    openGraph: { title: copy.title, description: copy.short, siteName: 'Seedup', locale: copy.locale, type: 'website' },
    twitter: { card: 'summary_large_image', title: copy.title, description: copy.short },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" crossOrigin="anonymous" />
      </head>
      <body className="antialiased font-sans flex flex-col min-h-screen" suppressHydrationWarning>
        <a href="#main-content" className="skip-link">{lang === 'en' ? 'Skip to content' : '본문으로 건너뛰기'}</a>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
