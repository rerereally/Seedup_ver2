import type { Metadata } from 'next';
import ExploreTabs from '@/components/ExploreTabs';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ModelIntelligencePanel from '@/components/ModelIntelligencePanel';
import TrendAccordion from '@/components/TrendAccordion';
import { getModelIntelligence, getTrends } from '@/lib/data';

export const metadata: Metadata = {
  title: '탐색',
};

export default async function Trends({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const showModels = (await searchParams).tab === 'models';
  const [trends, models] = await Promise.all([getTrends(), getModelIntelligence()]);
  const totalSignals = trends.reduce((sum, trend) => sum + Number(trend.sources_count ?? 0), 0);

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <ExploreTabs current={showModels ? '/trends?tab=models' : undefined} />
        {showModels ? <ModelIntelligencePanel models={models} /> : (
          <>
            <TrendAccordion trends={trends} />
            <p className="text-[13px] leading-6 text-muted">
              기사, AI 제품, GitHub, 논문에서 같은 주제가 얼마나 겹쳐 나오는지 세어 순위를 매겼습니다.
              {trends.length > 0 && <> 주제 <span className="num">{trends.length}</span>개 · 겹친 신호 <span className="num">{totalSignals}</span>건.</>}
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
