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
import { dailyResearch, dailyTotals } from '@/lib/opportunities/research';
import type { DailyTotal } from '@/lib/opportunities/research';
import { MIN_EVIDENCE, MIN_PLATFORMS, PLATFORM_LABELS, localizedOpportunity } from '@/lib/opportunities/types';
import type { Opportunity } from '@/lib/opportunities/types';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { StatusLabel } from '@/components/opportunity-stage/OpportunityTable';
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
  const updated = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(generatedAt));
  const showIssue = params.view === 'issue';
  const verified = opportunities.filter((item) => item.qualified);
  // Verified problems that gained a quote most recently, so the cards change as the week moves. Crowded ones stay in the full list only.
  const picks = verified.filter((item) => item.status !== 'closed').sort((a, b) => String(b.lastSeenAt ?? b.firstSeenAt ?? '').localeCompare(String(a.lastSeenAt ?? a.firstSeenAt ?? '')) || b.evidence.length - a.evidence.length).slice(0, 4);
  const today = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date(now));

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <h1 className="page-intro-title">인사이트</h1>
        <p className="mt-1 text-sm text-muted">{today}, 기회 분석 {updated} 갱신</p>
        <TodayChanges
          research={dailyResearch(opportunities, now)}
          totals={dailyTotals(opportunities, now, 7)}
          opportunities={opportunities}
          tiles={{ quotes: quoteCount, problems: opportunities.length, qualified: verified.length, articles: articles.length }}
          lang={lang}
        />
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
            {/* The problems worth building first as cards, then the full list; the map is a small panel beside them. */}
            <div className="mt-8 page-split">
              <div className="flex min-w-0 flex-col gap-12">
                {picks.length > 0 && (
                  <section aria-labelledby="picks-heading">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <h2 id="picks-heading" className="text-[17px] font-bold tracking-[-0.015em]">지금 만들 만한 문제</h2>
                      <span className="text-[13px] text-muted">원문 {MIN_EVIDENCE}건, {MIN_PLATFORMS}곳을 넘고 경쟁이 많지 않은 문제, 최근에 원문이 붙은 순서</span>
                    </div>
                    <ul className="mt-4 grid gap-4 xl:grid-cols-2">
                      {picks.map((item) => <li key={item.slug} className="flex"><ProblemCard item={item} lang={lang} /></li>)}
                    </ul>
                  </section>
                )}
                <section id="problems" aria-labelledby="all-heading" className="flex min-w-0 scroll-mt-6 flex-col gap-8">
                  <h2 id="all-heading" className="text-[17px] font-bold tracking-[-0.015em]">모든 문제 <span className="num ml-1 text-[15px] font-semibold text-muted">{opportunities.length}</span></h2>
                  <OpportunityBrowser opportunities={opportunities} generatedAt={generatedAt} lang={lang} stage={params.stage} size={params.size} q={params.q} all={params.all} basePath="/newsletter-preview" keep={{ profile: params.profile }} />
                </section>
              </div>

              {points.length > 0 && (
                <aside className="page-side" aria-label="문제 지도">
                  <OpportunityMap points={points} compact />
                  <p className="text-[13px] leading-6 text-muted">점을 고르면 위 카드가 바뀝니다. 원문 {MIN_EVIDENCE}건과 플랫폼 {MIN_PLATFORMS}곳을 넘으면 기준을 통과하고, 주간 신호에 실립니다. <Link href="/prd" className="text-seed underline-offset-4 hover:underline">내 아이디어로 PRD 만들기</Link></p>
                </aside>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

/** A tiny 7-day line on a 0-based axis for one tile: the engine's own daily totals, nothing estimated. */
function MiniTrend({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const top = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${30 - (value / top) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true" className="mt-3 h-8 w-full">
      <polyline points={points} fill="none" className="stroke-tertiary" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const CHANGE_LABELS = { new: '새 문제', rising: '원문 늘어남', qualified: '기준 통과', gap: '경쟁 늘어남' } as const;

/**
 * What changed, at the top of Insights: the day's totals with how much each moved since yesterday and a 7-day line,
 * then only the problems that actually changed, as cards with a quote. Nothing is shown for a kind with no change.
 */
function TodayChanges({ research, totals, opportunities, tiles, lang }: { research: ReturnType<typeof dailyResearch>; totals: DailyTotal[]; opportunities: Opportunity[]; tiles: { quotes: number; problems: number; qualified: number; articles: number }; lang: Lang }) {
  const t = translator(lang);
  const last = totals[totals.length - 1];
  const before = totals[totals.length - 2];
  const delta = (key: 'quotes' | 'problems' | 'qualified') => (last && before ? last[key] - before[key] : 0);
  const cells = [
    { label: t('원문과 일치한 인용', 'Verbatim quotes'), value: tiles.quotes, unit: t('건', ''), key: 'quotes' as const },
    { label: t('추적 중인 문제', 'Problems tracked'), value: tiles.problems, unit: t('개', ''), key: 'problems' as const },
    { label: t(`원문 ${MIN_EVIDENCE}건, ${MIN_PLATFORMS}곳 넘은 문제`, 'Past the bar'), value: tiles.qualified, unit: t('개', ''), key: 'qualified' as const, seed: true },
  ];

  // One card per problem, with every kind of change it had in the window.
  const changes = new Map<string, { slug: string; kinds: string[]; detail: string }>();
  const add = (slug: string, kind: keyof typeof CHANGE_LABELS, detail: string) => {
    const row = changes.get(slug) ?? { slug, kinds: [], detail };
    row.kinds.push(CHANGE_LABELS[kind]);
    changes.set(slug, row);
  };
  research.newProblems.forEach((item) => add(item.slug, 'new', `원문 ${item.evidence}건`));
  research.demandRising.forEach((item) => add(item.slug, 'rising', `원문 +${item.growth}건`));
  research.newlyQualified.forEach((item) => add(item.slug, 'qualified', `원문 ${item.evidence}건, ${item.platforms}곳`));
  research.gapClosing.forEach((item) => add(item.slug, 'gap', item.directGrowth > 0 ? `직접 경쟁 +${item.directGrowth}` : '경쟁 늘어남'));
  const cards = [...changes.values()].flatMap((row) => {
    const item = opportunities.find((problem) => problem.slug === row.slug);
    return item ? [{ ...row, item }] : [];
  });

  return (
    <section aria-labelledby="today-heading" className="mt-5">
      <h2 id="today-heading" className="sr-only">{t('오늘 달라진 것', 'What changed today')}</h2>
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-outline-soft sm:grid-cols-4">
        {cells.map((cell, index) => {
          const moved = delta(cell.key);
          return (
            <div key={cell.key} className={`border-outline-soft px-5 py-4 ${index % 2 ? 'border-l' : ''} ${index > 1 ? 'border-t sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}>
              <dt className="text-[13px] text-muted">{cell.label}</dt>
              <dd className="mt-1 text-sm text-muted">
                <span className={`num mr-1 text-[28px] font-bold leading-none tracking-tight ${cell.seed ? 'text-seed' : 'text-ink'}`}>{cell.value}</span>{cell.unit}
                <span className={`num ml-2 text-[13px] ${moved > 0 ? 'text-ink' : 'text-muted'}`}>{moved > 0 ? t(`+${moved} 오늘`, `+${moved} today`) : moved < 0 ? t(`${moved} 오늘`, `${moved} today`) : t('어제와 같음', 'Same as yesterday')}</span>
                <MiniTrend values={totals.map((day) => day[cell.key])} />
              </dd>
            </div>
          );
        })}
        <div className="border-l border-t border-outline-soft px-5 py-4 sm:border-t-0">
          <dt className="text-[13px] text-muted"><Link href="/news" className="underline-offset-4 hover:text-ink hover:underline">{t('오늘의 아티클', 'Today’s articles')}</Link></dt>
          <dd className="mt-1 text-sm text-muted"><span className="num mr-1 text-[28px] font-bold leading-none tracking-tight text-ink">{tiles.articles}</span>{t('편', '')}</dd>
        </div>
      </dl>

      {cards.length > 0 ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="text-[15px] font-semibold">{t(`달라진 문제 ${cards.length}개`, `${cards.length} problems changed`)}</h3>
            <span className="text-[13px] text-muted">{research.windowDays === 1 ? t('최근 1일', 'Past day') : t('조용한 날이라 최근 7일', 'A quiet day, so the past 7 days')}</span>
          </div>
          <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
            {cards.map(({ slug, kinds, detail, item }) => {
              const quote = [...item.evidence].sort((a, b) => b.score - a.score)[0];
              return (
                <li key={slug} className="flex w-72 shrink-0 snap-start lg:w-auto">
                  <Link href={`/opportunities/${encodeURIComponent(slug)}`} prefetch={false} className="card flex w-full flex-col p-4 transition-colors hover:border-outline-strong">
                    <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      {kinds.map((kind) => <span key={kind} className="chip">{kind}</span>)}
                      <span className="num ml-auto text-muted">{detail}</span>
                    </span>
                    <span className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{localizedOpportunity(item, lang).name}</span>
                    {quote && <span lang="en" className="mt-2 line-clamp-2 border-l-2 border-seed pl-2.5 text-[13px] leading-5 text-tertiary">“{quote.quote}”</span>}
                    <span className="mt-auto pt-3 text-[12px] text-muted">{item.platforms.map((platform) => PLATFORM_LABELS[platform]).join(', ')}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {research.fieldTrend.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              {t('원문이 는 분야', 'Fields gaining quotes')}
              {research.fieldTrend.slice(0, 6).map((field) => <span key={field.label} className="chip">{t(field.label, field.labelEn || field.label)} <span className="num ml-1">+{field.growth}</span></span>)}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{t('최근 7일 동안 달라진 문제는 없습니다. 위 숫자는 매일 아침 분석으로 갱신됩니다.', 'No problem changed in the past 7 days. The figures above update with each morning run.')}</p>
      )}
    </section>
  );
}

/** A verified problem as a card: who said it in their own words, where, and how crowded the space is. */
function ProblemCard({ item, lang }: { item: Opportunity; lang: Lang }) {
  const text = localizedOpportunity(item, lang);
  const quote = [...item.evidence].sort((a, b) => b.score - a.score)[0];
  const perPlatform = item.platforms.map((platform) => [platform, item.evidence.filter((row) => row.platform === platform).length] as const).sort((a, b) => b[1] - a[1]);
  return (
    <article className="card group relative flex w-full flex-col p-5 transition-colors hover:border-outline-strong">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"><StatusLabel status={item.status} lang={lang} /><span className="text-muted">{item.directCount ? `직접 경쟁 ${item.directCount}개` : '직접 경쟁 없음'}</span></p>
      <h3 className="mt-2 text-[17px] font-bold leading-snug tracking-tight">
        {/* The stretched link makes the whole card open the problem; the PRD link below sits above it. */}
        <Link href={`/opportunities/${item.slug}`} className="underline-offset-4 after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline">{text.name}</Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{text.problem}</p>
      {quote && (
        <blockquote className="mt-4 border-l-2 border-seed pl-3">
          <p lang="en" className="line-clamp-3 text-[14px] leading-6 text-ink [overflow-wrap:anywhere]">“{quote.quote}”</p>
          {lang === 'ko' && quote.quoteKo && <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">{quote.quoteKo}</p>}
          <footer className="mt-1 text-[12px] text-muted">{PLATFORM_LABELS[quote.platform]}</footer>
        </blockquote>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-5">
        <ul className="flex flex-wrap gap-1.5" aria-label="원문이 나온 곳">
          {perPlatform.map(([platform, count]) => <li key={platform} className="chip">{PLATFORM_LABELS[platform]} <span className="num ml-1">{count}</span></li>)}
        </ul>
        <Link href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="link-seed relative z-10 text-sm">PRD 만들기</Link>
      </div>
    </article>
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
