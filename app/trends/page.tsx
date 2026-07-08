import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import TrendAccordion from '@/components/TrendAccordion';
import { getTrends } from '@/lib/data';
import { Radio } from 'lucide-react';

export default async function Trends() {
  const trends = await getTrends();
  const topTrend = trends[0];
  const totalSignals = trends.reduce((sum, trend) => sum + Number(trend.sources_count ?? 0), 0);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Trend Radar"
            title="오늘 감지된 개발 트렌드"
            description="뉴스, AI 제품, GitHub 저장소에서 반복적으로 잡힌 키워드를 점수화해 지금 볼만한 기술 신호만 정리합니다."
            icon={Radio}
            meta={(
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [`${trends.length}개`, '랭킹 키워드'],
                  [topTrend?.keyword ?? '-', '최상위 트렌드'],
                  [`${totalSignals || '-'}개`, '누적 신호'],
                ].map(([value, label]) => (
                  <div key={label} className="border border-outline-soft bg-white px-4 py-3">
                    <p className="text-2xl font-black text-ink">{value}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
                  </div>
                ))}
              </div>
            )}
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
