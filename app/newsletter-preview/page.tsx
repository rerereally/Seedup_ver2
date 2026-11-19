import { newsletterIssues } from '@/lib/db/server';
import { onboardingRow } from '@/lib/db/onboarding';
import { savedOpportunitySlugs } from '@/lib/db/dossiers';
import type { Metadata } from 'next';
import Link from 'next/link';
import { updateNewsletterSubscription } from '@/app/actions/profile';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import NewsletterIssue from '@/components/NewsletterIssue';
import OpportunityBrowser from '@/components/OpportunityBrowser';
import OpportunityMap from '@/components/OpportunityMap';
import SubmitButton from '@/components/SubmitButton';
import { getAIProducts, getArticleFeedItems, getGitHubTrends, getNewsItems, getProjectIdeas, getResearchPapers } from '@/lib/data';
import { buildOpportunityDigest } from '@/lib/newsletter/opportunity-digest';
import { pickReads } from '@/lib/newsletter/reads';
import { getLang } from '@/lib/i18n-server';
import { getOpportunities } from '@/lib/opportunities/data';
import { mapPoints } from '@/lib/opportunities/map';
import { MIN_EVIDENCE, MIN_PLATFORMS } from '@/lib/opportunities/types';
import { DEMO_NEWSLETTER_PROFILES, isRecommendableNewsItem, scoreNewsletterItems, toNewsletterContentItems } from '@/lib/recommendations';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: '인사이트',
};

const WEEK_MS = 7 * 24 * 3_600_000;
const day = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });

/**
 * Today's signals: the problem list first with the map as a side panel, and this week's issue (exactly what the
 * Monday mail carries) with subscribing and past issues on its own tab (?view=issue).
 */
export default async function NewsletterPreviewPage({ searchParams }: { searchParams: Promise<{ profile?: string; stage?: string; size?: string; q?: string; all?: string; view?: string }> }) {
  const params = await searchParams;
  const profile = DEMO_NEWSLETTER_PROFILES.find((item) => item.user_id === params.profile) ?? DEMO_NEWSLETTER_PROFILES[0];
  const supabase = await createClient();
  const user = supabase ? await getCurrentUser() : null;
  const [news, products, repos, projects, papers, { opportunities, generatedAt }, onboarding, dossiers, archive, lang, articles] = await Promise.all([
    getNewsItems(),
    getAIProducts(),
    getGitHubTrends(),
    getProjectIdeas(),
    getResearchPapers(20),
    getOpportunities(),
    user && supabase ? onboardingRow<{ newsletter_subscribed?: boolean | null }>(supabase, user.id, 'newsletter_subscribed') : null,
    user && supabase ? savedOpportunitySlugs(supabase) : null,
    newsletterIssues(),
    getLang(),
    getArticleFeedItems(),
  ]);

  const lookbackDays = getLookbackDays(news.length + products.length + repos.length + projects.length + papers.length);
  const now = issueTime();
  const cutoff = now - lookbackDays * 24 * 3_600_000;
  const items = toNewsletterContentItems({
    news: news.filter((item) => isInLookback(item.published_at, cutoff) && isRecommendableNewsItem(item)),
    products,
    repos: repos.filter((item) => isInLookback(item.pushed_at, cutoff)),
    projects,
    papers: papers.filter((item) => isInLookback(item.published_at ?? item.created_at, cutoff)),
  });
  const reads = pickReads(scoreNewsletterItems(items, profile));
  // The same builder the Monday job uses, so this page is the issue, not a mock of it.
  const issue = buildOpportunityDigest(opportunities, new Date(now - WEEK_MS).toISOString(), '', 'weekly', now, undefined, reads);

  const subscribed = onboarding?.newsletter_subscribed ?? false;
  const watchedSlugs = new Set((dossiers?.data ?? []).map((row) => row.opportunity_slug as string));
  const watched = opportunities.filter((item) => watchedSlugs.has(item.slug));
  const points = mapPoints(opportunities, new Date(generatedAt).getTime());
  const quoteCount = opportunities.reduce((sum, item) => sum + item.evidence.length, 0);
  const sourceCount = new Set(opportunities.flatMap((item) => item.evidence.map((row) => row.platform))).size;
  const updated = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(generatedAt));
  const showIssue = params.view === 'issue';
  const today = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date(now));

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <h1 className="page-intro-title">인사이트</h1>
        <p className="mt-1 text-sm text-muted">{today}, 기회 분석 {updated} 갱신</p>
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-tertiary">
          <span>원문과 일치한 인용 <b className="num font-semibold text-ink">{quoteCount}</b>건</span>
          <span>출처 <b className="num font-semibold text-ink">{sourceCount}</b>곳</span>
          <span>원문 3건, 2곳 이상 확인된 문제 <b className="num font-semibold text-seed">{opportunities.filter((item) => item.qualified).length}</b>개</span>
          <Link href="/news" className="text-tertiary underline-offset-4 hover:text-ink hover:underline">오늘의 아티클 <b className="num font-semibold text-ink">{articles.length}</b>편</Link>
        </p>
        <nav className="tabs mt-5" aria-label="보기">
          <Link href="/newsletter-preview" aria-current={showIssue ? undefined : 'page'} className="tab">문제 <span className="num">{opportunities.length}</span></Link>
          <Link href="/newsletter-preview?view=issue" aria-current={showIssue ? 'page' : undefined} className="tab">이번 주 메일</Link>
        </nav>

        {showIssue ? (
          <div className="mt-6">
          <h2 id="issue-heading" className="sr-only">이번 주 주간 신호</h2>
          <p className="max-w-[44em] text-[15px] leading-7 text-tertiary">매주 월요일 아침, 문제가 어떻게 움직였는지와 읽을 만한 글만 골라 메일로 보냅니다. 아래가 이번 주 호입니다.</p>
          <div className="mt-6 page-split">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-sm text-muted">누구 기준으로 볼까요</span>
                <nav className="seg" aria-label="예시 관심 분야">
                  {DEMO_NEWSLETTER_PROFILES.map((demo) => (
                    <Link key={demo.user_id} href={`/newsletter-preview?view=issue&profile=${demo.user_id}`} scroll={false} aria-current={demo.user_id === profile.user_id ? 'true' : undefined}>{demo.label}</Link>
                  ))}
                </nav>
              </div>
              {issue
                ? <NewsletterIssue issue={issue} dateLabel={day.format(new Date(now))} />
                : <p className="card p-8 text-[15px] text-muted">이번 주에는 아직 보낼 소식이 없습니다.</p>}
              <p className="mt-3 text-[13px] text-muted">예시 관심 분야({profile.interests.join(', ')})로 고른 읽을거리입니다. 실제 메일은 내 관심 분야와 저장한 문제를 기준으로 고릅니다.</p>
            </div>

            <aside className="page-side">
              <section id="subscription" aria-labelledby="subscribe-heading" className="scroll-mt-24">
                <h2 id="subscribe-heading" className="text-[15px] font-semibold">구독</h2>
                <p className="mt-1 text-sm leading-6 text-muted">매주 월요일 오전 7시. 기준을 통과한 문제, 움직인 문제, 읽을거리.</p>
                {user ? (
                  <form action={updateNewsletterSubscription} className="mt-4 grid gap-2">
                    <input type="hidden" name="subscribed" value={subscribed ? 'false' : 'true'} />
                    <SubmitButton pendingText="저장 중" className={subscribed ? 'btn-quiet w-full' : 'btn w-full'}>{subscribed ? '구독 해지' : '주간 신호 구독'}</SubmitButton>
                    <span className="text-[13px] text-muted">{subscribed ? `${user.email}로 받고 있습니다.` : '지금은 받지 않습니다.'}</span>
                  </form>
                ) : (
                  <>
                    <Link href="/login?next=/newsletter-preview%23subscription" className="btn mt-4 w-full">Google로 구독하기</Link>
                    <p className="mt-2 text-[13px] text-muted">로그인하면 관심 분야를 고른 뒤 바로 받습니다.</p>
                  </>
                )}
                <Link href="/onboarding" className="link-seed mt-2">관심 분야 바꾸기</Link>
              </section>

              <section aria-labelledby="archive-heading">
                <h2 id="archive-heading" className="text-[15px] font-semibold">지난 호</h2>
                {archive.length ? (
                  <ul className="rows mt-3">
                    {archive.map((past) => (
                      <li key={past.period}>
                        <Link href={`/newsletter-preview/${past.period}`} className="block py-3.5 hover:bg-surface-low">
                          <span className="block text-[13px] text-muted">{day.format(new Date(`${past.period}T00:00:00+09:00`))}</span>
                          <span className="mt-0.5 line-clamp-2 block text-[15px] leading-6">{past.issue.headline}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 border-y border-outline-soft py-4 text-sm leading-6 text-muted">첫 호가 나가면 여기에 쌓입니다.</p>
                )}
              </section>

              {user && (
                <section aria-labelledby="watched-heading">
                  <h2 id="watched-heading" className="text-[15px] font-semibold">지켜보는 문제</h2>
                  {watched.length ? (
                    <ul className="rows mt-3">
                      {watched.map((item) => (
                        <li key={item.slug}>
                          <Link href={`/opportunities/${item.slug}`} className="flex items-baseline justify-between gap-4 py-3.5 text-[15px] hover:bg-surface-low">
                            <span className="min-w-0 truncate">{item.name}</span>
                            <span className={`shrink-0 text-sm ${item.qualified ? 'font-medium text-seed' : 'text-muted'}`}>{item.qualified ? '검증됨' : `원문 ${item.evidence.length}건`}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted">원문을 담은 문제가 자동으로 여기에 들어오고, 메일에서 먼저 보입니다. <Link href="/newsletter-preview#problems" className="text-seed underline-offset-4 hover:underline">기회 살펴보기</Link></p>
                  )}
                </section>
              )}
            </aside>
          </div>
          </div>
        ) : (
          <>
            {/* The map is what this page alone has, so it comes first and large; every problem is listed under it. */}
            {points.length > 0 && (
              <section className="mt-6" aria-label="문제 지도">
                <OpportunityMap points={points} />
                <p className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[13px] leading-6 text-muted">
                  <span>원문 {MIN_EVIDENCE}건과 플랫폼 {MIN_PLATFORMS}곳을 넘으면 기준을 통과하고, 주간 신호에 실립니다. <Link href="/prd" className="text-seed underline-offset-4 hover:underline">내 아이디어로 PRD 만들기</Link></span>
                  <a href="#problems" className="link-seed">문제 목록 보기</a>
                </p>
              </section>
            )}
            <section id="problems" aria-label="모든 문제" className="mt-12 flex min-w-0 scroll-mt-6 flex-col gap-8">
              <OpportunityBrowser opportunities={opportunities} generatedAt={generatedAt} lang={lang} stage={params.stage} size={params.size} q={params.q} all={params.all} basePath="/newsletter-preview" keep={{ profile: params.profile }} />
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

// One clock read per request; the page is rendered on the server for each visit.
function issueTime() {
  return Date.now();
}

function getLookbackDays(totalCount: number) {
  if (totalCount >= 40) return 1;
  if (totalCount >= 20) return 7;
  return 14;
}

function isInLookback(value: string | null | undefined, cutoff: number) {
  if (!value) return true;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time >= cutoff : true;
}
