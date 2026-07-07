import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import TrendAccordion from '@/components/TrendAccordion';
import { getTrends } from '@/lib/data';

export default async function Trends() {
  const trends = await getTrends();

  return (
    <>
      <Header />
      <main className="grow bg-[#f9fafb]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-12 md:px-10 md:py-16">
          <section>
            <h1 className="text-5xl font-bold leading-tight text-ink">개발 트렌드 키워드</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">인기 있는 개발 트렌드 키워드를 순위별로 확인하고 상세 분석을 살펴보세요.</p>
          </section>

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
