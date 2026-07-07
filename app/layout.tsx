import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seedup - 뉴스에서 프로젝트로',
  description: '개발 뉴스, 읽고 끝내지 말고 만들어보세요.',
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
