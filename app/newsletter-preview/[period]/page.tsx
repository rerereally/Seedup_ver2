import { newsletterIssue } from '@/lib/db/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import NewsletterIssue from '@/components/NewsletterIssue';

const day = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }): Promise<Metadata> {
  const { period } = await params;
  return { title: `주간 신호 ${period}` };
}

/** A past issue from the archive, as it went out to everyone (without one reader's personal order). */
export default async function PastIssuePage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const stored = await newsletterIssue(period);
  if (!stored) notFound();

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <Link href="/newsletter-preview" className="inline-flex min-h-9 items-center text-sm text-muted hover:text-ink">‹ 주간 신호</Link>
        <div className="mx-auto mt-4 max-w-[760px]">
          <NewsletterIssue issue={stored.issue} dateLabel={day.format(new Date(`${stored.period}T00:00:00+09:00`))} />
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-outline-soft pt-6">
            <p className="text-[15px] text-tertiary">다음 호는 월요일 아침에 메일로 받을 수 있습니다.</p>
            <Link href="/newsletter-preview#subscription" className="btn h-11 px-5">구독하기</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
