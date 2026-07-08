import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import TrendAccordion from '@/components/TrendAccordion';
import { getTrends } from '@/lib/data';
import { TrendingUp } from 'lucide-react';

export default async function Trends() {
  const trends = await getTrends();

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Trends"
            title="개발 트렌드 키워드"
            description="인기 있는 개발 트렌드 키워드를 순위별로 확인하고 상세 분석을 살펴보세요."
            icon={TrendingUp}
          />

          {trends.length ? (
            <TrendAccordion trends={trends} />
          ) : (
            <EmptyState title="아직 등록된 트렌드가 없습니다" description="Supabase의 trends 테이블에 데이터를 넣으면 이 화면에 자동으로 표시됩니다." />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
