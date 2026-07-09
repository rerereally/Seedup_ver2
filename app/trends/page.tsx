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
            title="카테고리별 개발 트렌드 Top 30"
            description="뉴스, AI 제품, GitHub, 논문 신호를 카테고리별로 다르게 추출해 개발 워크플로우, AI 도구·모델, 구현 패턴, 오픈소스 프로젝트, 빌드 아이디어를 점수화합니다."
            icon={Radio}
            meta={(
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [`${trends.length}개`, '분석된 트렌드'],
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
