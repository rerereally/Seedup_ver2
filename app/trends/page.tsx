import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import TrendAccordion from '@/components/TrendAccordion';
import { getModelIntelligence, getTrends } from '@/lib/data';

export const metadata: Metadata = {
  title: '트렌드',
};

export default async function Trends() {
  const [trends, models] = await Promise.all([getTrends(), getModelIntelligence()]);
  const totalSignals = trends.reduce((sum, trend) => sum + Number(trend.sources_count ?? 0), 0);

  return (
    <>
      <Header />
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            title="개발 트렌드"
            description="기사, AI 제품, GitHub, 논문에서 같은 주제가 얼마나 겹쳐 나오는지 세어 순위를 매겼습니다."
            meta={trends.length ? <>주제 <span className="num text-ink">{trends.length}</span>개 · 겹친 신호 <span className="num text-ink">{totalSignals}</span>건</> : undefined}
          />

          <TrendAccordion trends={trends} models={models} />
        </div>
      </main>
      <Footer />
    </>
  );
}
