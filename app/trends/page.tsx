import type { Metadata } from 'next';
import ExploreTabs from '@/components/ExploreTabs';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ModelIntelligencePanel from '@/components/ModelIntelligencePanel';
import TrendAccordion from '@/components/TrendAccordion';
import Link from 'next/link';
import PeriodTabs from '@/components/PeriodTabs';
import { getModelIntelligence, getPeriodBaseline, getTrendAverages, getTrends } from '@/lib/data';
import { rankByRise } from '@/lib/popularity';

export const metadata: Metadata = {
  title: '트렌드',
};

export default async function Trends({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string; sort?: string }> }) {
  const params = await searchParams;
  const showModels = params.tab === 'models';
  const [trends, models] = await Promise.all([getTrends(), getModelIntelligence()]);
  const scoreOf = (trend: (typeof trends)[number]) => Number(trend.display_score ?? trend.score ?? 0);
  const [topicPeriod, modelPeriod] = await Promise.all([
    getPeriodBaseline('trend_snapshots', 'keyword', 'score', showModels ? [] : trends.map((trend) => trend.keyword), showModels ? null : params.period),
    getPeriodBaseline('ai_model_snapshots', 'model_id', 'popularity_rank', showModels ? models.map((model) => model.model_id) : [], showModels ? params.period : null),
  ]);
  const period = topicPeriod.state.period;
  const mode = params.sort === 'rising' ? 'rising' : 'popular';
  // Popular: average daily score over the period. Rising: the rise since its first day, where a topic missing that
  // day appeared during the period, so its whole score counts.
  const periodValue = !period || showModels ? null
    : mode === 'popular' ? await getTrendAverages(trends.map((trend) => trend.keyword), period.days)
      : new Map(rankByRise(trends, scoreOf, (trend) => trend.keyword, topicPeriod.baseline, true).map((row) => [row.item.keyword, row.rise]));
  const href = (key: string | null, sort: string = mode) => `/trends?${new URLSearchParams({ ...(showModels ? { tab: 'models' } : {}), ...(key ? { period: key } : {}), ...(key && !showModels && sort === 'rising' ? { sort } : {}) })}`.replace(/\?$/, '');
  const totalSignals = trends.reduce((sum, trend) => sum + Number(trend.sources_count ?? 0), 0);
  // The browser gets only what the accordion shows: one source list (it reads detected before refs), five of each.
  const slim = trends.map(({ source_refs, detected_sources, bars: _bars, ...trend }) => ({
    ...trend,
    detected_sources: (detected_sources ?? source_refs ?? []).slice(0, 5),
    project_ideas: trend.project_ideas?.slice(0, 5) ?? null,
    why_trending: trend.why_trending?.slice(0, 5) ?? null,
    bars: null,
    period_value: periodValue ? periodValue.get(trend.keyword) ?? 0 : null,
  }));

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <ExploreTabs current={showModels ? '/trends?tab=models' : undefined} />
        <div className="flex flex-wrap gap-3">
          <PeriodTabs state={showModels ? modelPeriod.state : topicPeriod.state} href={(key) => href(key)} />
          {period && !showModels && (
            <nav aria-label="순위 기준" className="seg">
              <Link href={href(period.key, 'popular')} aria-current={mode === 'popular' ? 'page' : undefined}>인기</Link>
              <Link href={href(period.key, 'rising')} aria-current={mode === 'rising' ? 'page' : undefined}>급상승</Link>
            </nav>
          )}
        </div>
        {showModels ? <ModelIntelligencePanel models={models} period={modelPeriod.state.period} baseline={modelPeriod.baseline} /> : (
          <>
            <TrendAccordion trends={slim} periodLabel={period?.label} mode={mode} />
            <p className="text-[13px] leading-6 text-muted">
              기사, AI 제품, GitHub, 논문에서 같은 주제가 얼마나 겹쳐 나오는지 세어 순위를 매겼습니다.
              {period && (mode === 'popular'
                ? <> 지금은 최근 {period.label} 동안의 하루 평균 점수 순서이고, 기록이 없는 날은 0점으로 셉니다.</>
                : <> 지금은 {period.label} 전보다 점수가 많이 오른 순서이고, 그때 없던 주제는 점수 전체를 오른 폭으로 셉니다.</>)}
              {trends.length > 0 && <> 주제 <span className="num">{trends.length}</span>개, 겹친 신호 <span className="num">{totalSignals}</span>건.</>}
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
