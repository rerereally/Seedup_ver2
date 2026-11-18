import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '아이디어 검증',
};

export default function IdeasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
