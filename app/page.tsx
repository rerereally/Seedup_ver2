import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import OpportunityStage from '@/components/opportunity-stage/OpportunityStage';
import OpportunityTable, { FunnelStrip } from '@/components/opportunity-stage/OpportunityTable';
import type { NewsItem } from '@/lib/data';
import { getAIProducts, getGitHubTrends, getNewsItems, getProjectIdeas, getScraps } from '@/lib/data';
import { getOpportunities, opportunityColors, summarizeFunnel, toStageOpportunities } from '@/lib/opportunities/data';
import type { StageNews } from '@/lib/opportunities/data';
import { buildRecommendationProfile, recommendAIProducts, recommendGitHubRepos, recommendNewsItems, recommendProjectIdeas, scrapTokens } from '@/lib/recommendations';
import { createClient } from '@/lib/supabase/server';
import { cleanProjectTitle } from '@/lib/utils';

const NEWS_ON_HOME = 6;
const OPPORTUNITIES_ON_HOME = 8;

function toStageNews(items: NewsItem[]): StageNews[] {
  return items.slice(0, NEWS_ON_HOME).map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    terms: [item.title, item.category ?? '', ...(item.topic_tags ?? []), ...(item.skill_tags ?? [])].map((term) => term.toLowerCase()),
  }));
}

type PersonalRow = { href: string; title: string; meta: string };

function PersonalColumn({ title, moreHref, rows }: { title: string; moreHref: string; rows: PersonalRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <Link href={moreHref} className="inline-flex min-h-9 items-center text-sm text-muted hover:text-ink">전체 보기</Link>
      </div>
      <ul className="mt-2 grid gap-1">
        {rows.map((row) => (
          <li key={row.href}>
            <Link href={row.href} className="block rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-low">
              <span className="line-clamp-1 font-bold">{row.title}</span>
              <span className="line-clamp-1 text-sm text-muted">{row.meta}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const userResult = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = userResult.data.user;

  const [{ opportunities }, news] = await Promise.all([getOpportunities(), getNewsItems()]);
  const publishedNews = news.filter((item) => Boolean(item.content?.trim()));
  let stageNews = [...publishedNews].sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0));
  let personal: Array<{ title: string; moreHref: string; rows: PersonalRow[] }> = [];

  if (user && supabase) {
    const [projects, githubRepos, aiProducts, userScraps, onboarding] = await Promise.all([
      getProjectIdeas(),
      getGitHubTrends(),
      getAIProducts(),
      getScraps(),
      supabase.from('user_onboarding').select('answers').eq('user_id', user.id).maybeSingle(),
    ]);
    const profile = buildRecommendationProfile((onboarding.data?.answers ?? null) as Record<string, unknown> | null, scrapTokens(userScraps));
    stageNews = recommendNewsItems(publishedNews, profile, NEWS_ON_HOME).map(({ item }) => item);
    personal = [
      { title: '뜨고 있는 오픈소스', moreHref: '/github-trends', rows: recommendGitHubRepos(githubRepos, profile, 3).map(({ item, reasons }) => ({ href: `/github-trends/${item.id}`, title: item.repo_full_name, meta: reasons[0] ?? `★${item.stars?.toLocaleString('en-US') ?? 0}` })) },
      { title: '도전해볼 프로젝트', moreHref: '/projects', rows: recommendProjectIdeas(projects, profile, 3).map(({ item, reasons }) => ({ href: `/projects/${item.id}`, title: cleanProjectTitle(item.title), meta: reasons[0] ?? item.level ?? '추천' })) },
      { title: '많이 보는 AI 제품', moreHref: '/ai-products', rows: recommendAIProducts(aiProducts, profile, 3).map(({ item, reasons }) => ({ href: `/ai-products/${item.id}`, title: item.name, meta: reasons[0] ?? item.category ?? 'AI 제품' })) },
    ];
  }

  const hasPersonal = personal.some((column) => column.rows.length > 0);

  return (
    <>
      <main className="grow">
        <OpportunityStage opportunities={toStageOpportunities(opportunities)} news={toStageNews(stageNews)} header={<Header overlay />} />

        <section className="page-shell" aria-labelledby="opportunities-heading">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <h2 id="opportunities-heading" className="page-intro-title">살펴볼 기회</h2>
              <p className="page-intro-description">말이 많다고 기회는 아닙니다. 출처가 겹치고, 아직 아무도 제대로 풀지 않은 것만 남깁니다.</p>
            </div>
            <Link href="/opportunities" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-ink hover:underline">전체 {opportunities.length}개 보기 <span aria-hidden="true">→</span></Link>
          </div>
          <div className="mt-8">
            <FunnelStrip funnel={summarizeFunnel(opportunities)} />
          </div>
          <div className="mt-3">
            <OpportunityTable opportunities={opportunities.slice(0, OPPORTUNITIES_ON_HOME)} colors={opportunityColors(opportunities)} />
          </div>
          <p className="mt-4 max-w-[62em] text-[13px] leading-6 text-muted">
            막대가 다 차면 기준을 넘은 것입니다. 증언은 공개 글에서 찾아 원문과 글자 단위로 대조한 문장만 남겼습니다. 기존 도구는 GitHub, npm, Show HN, VS Code 마켓만 조사했고, 직접 경쟁인지는 무료 AI 모델이 판정했습니다.
          </p>
        </section>

        {hasPersonal && (
          <section className="page-shell !pt-0" aria-labelledby="personal-heading">
            <h2 id="personal-heading" className="text-[clamp(22px,2.4vw,30px)] font-extrabold tracking-tight">내 관심사에 맞춰서</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {personal.map((column) => <PersonalColumn key={column.moreHref} {...column} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
