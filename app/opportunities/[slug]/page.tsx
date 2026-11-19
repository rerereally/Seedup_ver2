import { getLang } from '@/lib/i18n-server';
import { translator } from '@/lib/i18n';
import { localizedOpportunity } from '@/lib/opportunities/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { StatusLabel } from '@/components/opportunity-stage/OpportunityTable';
import OpportunityPrd from './OpportunityPrd';
import { similarCompareSlugs } from '@/lib/opportunities/compare';
import { getOpportunities, getOpportunity } from '@/lib/opportunities/data';
import { koreaLens, scoreOpportunity, stackFit, whyNow } from '@/lib/opportunities/insight';
import { describeChange } from '@/lib/opportunities/merge';
import { createClient } from '@/lib/supabase/server';
import { builtExamples } from '@/lib/db/dossiers';
import { onboardingAnswers } from '@/lib/db/onboarding';
import { BUILD_LABELS, PLATFORM_LABELS } from '@/lib/opportunities/types';
import type { Evidence, SupplyItem, SupplyKind } from '@/lib/opportunities/types';

const SUPPLY_LABELS: Record<SupplyKind, string> = { github: 'GitHub', npm: 'npm', show_hn: 'Show HN', vscode: 'VS Code', appstore: 'App Store', web: 'Web' };

// Asked about what already happened, never about a hypothetical product, so the answers are not just politeness.
const FIRST_USER_QUESTIONS = [
  '이 문제를 가장 최근에 겪은 것이 언제였나요? 그때 무슨 작업을 하던 중이었나요?',
  '그때 어떻게 해결했나요? 그 방법에서 가장 번거로운 부분은 무엇이었나요?',
  '해결하려고 써 본 도구가 있나요? 계속 쓰지 않게 된 이유는 무엇인가요?',
  '이 문제 때문에 지금까지 들인 시간이나 돈은 어느 정도인가요?',
];

/** A first reply to a source post: it names the problem and asks, never pitches. */
const replyDraft = (problem: string) => `Thanks for writing this up. I'm looking into this problem: ${problem.replace(/\.$/, '')}.
Could I ask two quick questions?
1. When did this last happen to you, and how did you get around it?
2. Have you tried a tool for it? What made you stop using it?
No product to sell yet. I just want to understand it before building anything.`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = await getOpportunity(slug);
  return { title: opportunity?.name ?? '기회', description: opportunity?.problem };
}

const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });

/** Each market counts something different, so the unit is always written out. */
function supplyMetric(item: SupplyItem) {
  if (!item.popularity) return null;
  if (item.kind === 'github') return `★ ${compact.format(item.popularity)}`;
  if (item.kind === 'vscode') return `설치 ${compact.format(item.popularity)}`;
  if (item.kind === 'show_hn') return `${compact.format(item.popularity)}점`;
  if (item.kind === 'appstore') return `평가 ${compact.format(item.popularity)}`;
  return compact.format(item.popularity);
}

/** The stacks picked in the profile, or null for a visitor who is not signed in. */
async function preferredStack(): Promise<string[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const stack = ((await onboardingAnswers(supabase, data.user.id)) as { preferred_stack?: unknown } | null)?.preferred_stack;
  return Array.isArray(stack) ? stack.map(String) : [];
}

function SupplyGroup({ title, items }: { title: string; items: SupplyItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="rows">
      {items.map((item) => (
        <li key={item.url}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-14 items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-[15px] text-ink group-hover:underline group-hover:underline-offset-4">{item.name.replace(/^Show HN:\s*/i, '')}</span>
              <span className="block text-xs text-muted">{SUPPLY_LABELS[item.kind]}{supplyMetric(item) ? <span className="num ml-2">{supplyMetric(item)}</span> : null}</span>
            </span>
            <span className="shrink-0 text-sm text-muted">{title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// The side panel lists this many existing tools; the rest open on request.
const TOP_TOOLS = 3;

// The sections below the quotes fold shut, so the page reads as: the problem, the proof, then the detail on demand.
const fold = 'group border-b border-outline-soft';
const foldSummary = 'flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-semibold tracking-tight [&::-webkit-details-marker]:hidden';
const chevron = <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">›</span>;

export default async function OpportunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { opportunities } = await getOpportunities();
  const opportunity = opportunities.find((item) => item.slug === slug);
  if (!opportunity) notFound();
  const compareSlugs = similarCompareSlugs(opportunity, opportunities);

  const lang = await getLang();
  const t = translator(lang);
  const text = localizedOpportunity(opportunity, lang);
  const firstSeen = opportunity.firstSeenAt ? day.format(new Date(opportunity.firstSeenAt)) : null;
  const score = scoreOpportunity(opportunity);
  const stats: Array<[string, number]> = [
    [t('개발자 원문', 'Developer quotes'), opportunity.evidence.length],
    [t('플랫폼', 'Platforms'), opportunity.platforms.length],
    [t('직접 경쟁', 'Direct rivals'), opportunity.directCount],
    [t('점수', 'Score'), score.total],
  ];
  const timing = whyNow(opportunity);
  const korea = koreaLens(opportunity);
  const stack = await preferredStack();
  const fit = stack ? stackFit(opportunity, stack) : null;
  const points = opportunity.history ?? [];
  const history = points.map((entry, index) => ({ ...entry, changes: index ? describeChange(points[index - 1], entry) : [] }));
  const direct = opportunity.supply.filter((item) => item.relation === 'direct');
  const partial = opportunity.supply.filter((item) => item.relation !== 'direct');
  // What people built from this problem, from PRDs their owners made public with a link (20261118120947_built.sql).
  const builtRows = await builtExamples(opportunity.slug);
  // How far this problem has grown. Design and build happen after this page, so they are never the current step here.
  const steps = [
    `${t('발견', 'Found')}${firstSeen ? ` ${firstSeen}` : ''}`,
    opportunity.qualified ? t('검증됨', 'Verified') : t('검증', 'Verification'),
    t('설계', 'Design'),
    t('구현', 'Build'),
  ];
  const current = opportunity.qualified ? 1 : 0;
  const quote = (item: Evidence, index: number) => (
    <li key={item.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 py-4">
      <span className="num pt-0.5 text-[15px] font-semibold text-seed">{index + 1}</span>
      <div className="min-w-0">
        <q lang="en" className="block text-[16px] leading-7 text-ink [text-wrap:pretty]">{item.quote}</q>
        {lang === 'ko' && item.quoteKo && <p className="mt-1.5 text-[15px] leading-7 text-muted [text-wrap:pretty]">{item.quoteKo}</p>}
        <p className="mt-2 flex flex-wrap gap-x-3 text-[13px] text-muted">
          <span>{PLATFORM_LABELS[item.platform]}</span>
          {item.postedAt && <time dateTime={item.postedAt}>{day.format(new Date(item.postedAt))}</time>}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-seed underline-offset-4 hover:underline">{t('원문 보기', 'Open source')}</a>
        </p>
      </div>
    </li>
  );

  return (
    <>
      <Header />
      {/* The extra bottom padding on phones clears the fixed PRD bar. */}
      <main id="main-content" className="page-shell grow pb-24 lg:pb-12">
        <Link href="/opportunities" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><span aria-hidden="true">‹</span> {t('인사이트', 'Insights')}</Link>
        <ol className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted" aria-label={t('진행 단계', 'Stage')}>
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-4" aria-current={index === current ? 'step' : undefined}>
              {index > 0 && <span aria-hidden="true" className="h-px w-8 bg-outline-strong" />}
              <span className={index === current ? 'font-semibold text-seed' : ''}>{step}</span>
            </li>
          ))}
        </ol>

        <header className="mt-4">
          <h1 className="page-intro-title">{text.name}</h1>
          <p className="mt-3 max-w-[40em] text-[16px] leading-7 text-tertiary [text-wrap:pretty]">{text.problem}</p>
          {compareSlugs.length >= 2 && (
            <Link href={{ pathname: '/opportunities/compare', query: { slugs: compareSlugs.join(',') } }} className="btn-quiet mt-4 min-h-11 sm:min-h-10">
              {t('다른 후보와 비교', 'Compare with other candidates')}
            </Link>
          )}
        </header>
        <div className="mt-8 page-split">
          <article className="min-w-0">
            <section className="mt-8" aria-labelledby="quotes-heading">
              <h2 id="quotes-heading" className="text-[17px] font-bold tracking-[-0.015em]">{t('실제 원문', 'Real quotes')}</h2>
              <p className="mt-1 text-sm text-muted">{t('모두 공개 글 원문과 글자 단위로 일치합니다. 번역은 이해를 돕기 위한 것입니다.', 'Every quote matches its public source character by character.')}</p>
              <ol className="rows mt-3">{opportunity.evidence.slice(0, 3).map(quote)}</ol>
              {opportunity.evidence.length > 3 && (
                <details className="group">
                  <summary className="link-seed cursor-pointer list-none py-4 pl-10 group-open:hidden [&::-webkit-details-marker]:hidden">{t(`원문 ${opportunity.evidence.length - 3}건 더 보기`, `${opportunity.evidence.length - 3} more quotes`)}</summary>
                  <ol className="rows [&>:first-child]:border-t-0">{opportunity.evidence.slice(3).map((item, index) => quote(item, index + 3))}</ol>
                </details>
              )}
            </section>
            {text.gap && (
              <div className="mt-8 max-w-[40em] border-l-2 border-seed pl-5">
                <p className="label">{t('남은 빈틈', 'The gap')}</p>
                <p className="mt-1 text-[17px] leading-8 [text-wrap:pretty]">{text.gap}</p>
              </div>
            )}




            <div className="mt-10 border-t border-outline-soft">
              <details className={fold}>
                <summary className={foldSummary}>
                  <span>{t('점수 내역', 'Score breakdown')} <span className="num ml-2 text-base font-medium text-muted"><span className="font-semibold text-seed">{score.total}</span> / 100</span></span>
                  {chevron}
                </summary>
                <p className="text-sm text-muted">{t('저장된 수치만으로 계산합니다. AI가 매긴 점수가 아닙니다.', 'Computed from stored numbers only, not scored by AI.')}</p>
                <dl className="mt-2 pb-5">
                  {score.parts.map((part) => (
                    <div key={part.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3">
                      <dt className="text-sm font-semibold">{part.label}</dt>
                      <dd className="min-w-0">
                        <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-surface-high">
                          <span className="block h-full rounded-full bg-seed" style={{ width: `${(part.points / part.max) * 100}%` }} />
                        </span>
                        <span className="mt-1.5 block text-[13px] leading-5 text-muted">{part.reason}</span>
                      </dd>
                      <dd className="num text-sm text-muted"><span className="font-semibold text-ink">{part.points}</span> / {part.max}</dd>
                    </div>
                  ))}
                </dl>
              </details>

              <details className={fold}>
                <summary className={foldSummary}>{t('왜 지금인가', 'Why now')}{chevron}</summary>
                <p className="max-w-[40em] pb-4 text-sm leading-6 text-muted">{timing.headline}</p>
                {timing.events.length > 0 && (
                  <ol className="rows mb-5 [&>:last-child]:border-b-0">
                    {timing.events.map((event) => (
                      <li key={`${event.url}-${event.kind}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                        <time dateTime={event.at} className="num w-28 shrink-0 text-[13px] text-muted">{day.format(new Date(event.at))}</time>
                        <span className="inline-flex w-36 shrink-0 items-center gap-2 text-[13px] font-semibold">
                          <span aria-hidden="true" className={`h-2 w-2 ${event.kind === 'voice' ? 'rounded-full bg-seed' : 'rounded-[2px] bg-outline-strong'}`} />
                          {event.label}
                        </span>
                        <a href={event.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 basis-full truncate text-sm text-muted underline-offset-4 hover:text-ink hover:underline sm:basis-0">{event.detail}</a>
                      </li>
                    ))}
                  </ol>
                )}
              </details>

              {history.length > 0 && (
                <details className={fold}>
                  <summary className={foldSummary}>{t('성장 기록', 'Track record')}{chevron}</summary>
                  <p className="pb-4 text-sm text-muted">
                    {history.length > 1 ? t('분석을 돌릴 때마다 달라진 점만 남깁니다.', 'Only what changed between runs is kept.') : t('아직 한 번 분석한 상태입니다. 다음 분석에서 원문이나 이미 있는 도구가 달라지면 여기에 쌓입니다.', 'Analyzed once so far. Changes in quotes or rivals in later runs will appear here.')}
                  </p>
                  <ol className="rows mb-5 [&>:last-child]:border-b-0">
                    {[...history].reverse().map((entry) => (
                      <li key={entry.at} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                        <time dateTime={entry.at} className="num w-28 shrink-0 text-[13px] text-muted">{day.format(new Date(entry.at))}</time>
                        <span className="min-w-0 flex-1 text-sm leading-6">
                          {entry.changes.length ? entry.changes.join(', ') : t(`원문 ${entry.evidence}건, 플랫폼 ${entry.platforms}곳으로 처음 기록`, `First recorded with ${entry.evidence} quotes on ${entry.platforms} platforms`)}
                        </span>
                        <StatusLabel status={entry.status} lang={lang} />
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {builtRows.length > 0 && (
                <section aria-labelledby="built-heading">
                  <h2 id="built-heading" className="text-[17px] font-semibold">{t('이 문제로 만든 것', 'Built for this problem')}</h2>
                  <ul className="rows mt-2">
                    {builtRows.map((row) => (
                      <li key={row.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-sm">
                        <a href={row.built_url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-seed underline-offset-4 hover:underline">{new URL(row.built_url).host}</a>
                        {row.built_note && <span className="min-w-0 flex-1 text-muted">{row.built_note}</span>}
                        <Link href={`/spec/${row.id}`} className="text-tertiary underline-offset-4 hover:text-ink hover:underline">{t('PRD 보기', 'See the PRD')}</Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <details className={fold}>
                <summary className={foldSummary}>{t('첫 10명 찾기', 'Find your first 10 users')}{chevron}</summary>
                <p className="max-w-[44em] text-sm leading-6 text-muted">{t('이 문제를 직접 말한 사람들이 첫 사용자 후보입니다. 자동 댓글이나 쪽지는 보내지 않습니다. 글에 직접 답하며 대화를 시작하세요.', 'The people who described this problem are your first user candidates. Seedup sends nothing automatically; reply to their posts yourself.')}</p>
                <h3 className="mt-5 text-[15px] font-semibold">{t('이 사람들이 있는 곳', 'Where they are')}</h3>
                <ul className="mt-3 grid gap-2">
                  {opportunity.platforms.map((platform) => {
                    const threads = opportunity.evidence.filter((item) => item.platform === platform);
                    return (
                      <li key={platform} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                        <span className="font-semibold text-ink">{PLATFORM_LABELS[platform]}</span>
                        <span className="text-muted">글 <span className="num">{threads.length}</span>개</span>
                        {threads.map((item, index) => (
                          <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="text-seed underline-offset-4 hover:underline">{index + 1}번 글</a>
                        ))}
                      </li>
                    );
                  })}
                </ul>
                <h3 className="mt-6 text-[15px] font-semibold">{t('만나면 물어볼 것', 'What to ask them')}</h3>
                <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-tertiary marker:text-seed">
                  {FIRST_USER_QUESTIONS.map((question) => <li key={question}>{question}</li>)}
                </ol>
                <p className="mt-3 text-[13px] leading-6 text-muted">내 해결책을 설명하기 전에 묻습니다. 미래에 쓸지 묻지 않고, 지난번에 실제로 어떻게 했는지를 묻습니다.</p>
                <h3 className="mt-6 text-[15px] font-semibold">{t('답글 초안', 'Reply draft')}</h3>
                <p className="mt-1 text-[13px] leading-6 text-muted">{t('원문이 영어라 영어로 둡니다. 홍보를 막는 커뮤니티가 많으니 링크 없이 질문만 남기세요.', 'Many communities ban promotion, so leave questions only, no links.')}</p>
                <pre className="terminal mb-5 mt-2 whitespace-pre-wrap">{replyDraft(opportunity.problemEn ?? opportunity.problem)}</pre>
              </details>
            </div>
          </article>

          <aside className="page-side">
            <OpportunityPrd lang={lang} ready={opportunity.qualified} slug={opportunity.slug} evidenceCount={opportunity.evidence.length} />
            <section aria-label={t('속성', 'Properties')} className="card p-5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {/* Verdict first (enough quotes?), then the market (how many rivals), so the two never read as one mixed signal. */}
              <span className={opportunity.qualified ? 'font-semibold text-seed' : ''}>{opportunity.qualified ? t('원문 3건, 2곳 이상 확인', 'Backed by 3+ quotes from 2+ sites') : t('원문이 아직 부족합니다', 'Not enough quotes yet')}</span>
              <StatusLabel status={opportunity.status} lang={lang} />
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-y-4 border-y border-outline-soft py-4">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt className="label">{label}</dt>
                  <dd className="num mt-1 text-[22px] font-bold leading-none tracking-tight text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] text-muted">
              {firstSeen && <>{t(`가장 이른 원문은 ${firstSeen}에 나왔습니다.`, `First quote: ${firstSeen}.`)} </>}
              {t(`첫 원문 뒤 나온 도구 ${opportunity.followersAfterSignal}개.`, `Tools since first quote: ${opportunity.followersAfterSignal}.`)}
            </p>
            </section>
            {opportunity.build && (
              <section aria-labelledby="build-heading">
                <h2 id="build-heading" className="text-[16px] font-bold">{t('혼자 만들면', 'Building it solo')}</h2>
                <p className="mt-1 text-[13px] text-muted">{t('AI 코딩 도구로 첫 버전을 혼자 만들 때의 AI 추정입니다.', 'An AI estimate for one person shipping a first version with AI coding tools.')}</p>
                <p className="mt-3 text-sm"><span className="font-semibold text-ink">{BUILD_LABELS[opportunity.build.size][lang === 'en' ? 1 : 0]}</span><span className="ml-2 text-muted">{t(`약 ${opportunity.build.days}일`, `about ${opportunity.build.days} days`)}</span></p>
                {opportunity.build.stack.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{opportunity.build.stack.map((name) => <li key={name} className="chip">{name}</li>)}</ul>}
                {opportunity.build.hard.length > 0 && <p className="mt-3 text-sm leading-6 text-muted">{t('막히기 쉬운 곳', 'Likely blockers')}: <span className="text-ink">{opportunity.build.hard.join(', ')}</span></p>}
              </section>
            )}
            <section aria-labelledby="supply-heading">
              <h2 id="supply-heading" className="text-[16px] font-bold">{t('이미 있는 도구', 'Existing tools')}</h2>
              <p className="mb-4 mt-1 text-[13px] text-muted">{opportunity.supply.length === 0 ? t('조사한 범위에서 관련 도구를 찾지 못했습니다.', 'No related tools were found in the sources searched.') : t('웹 검색, GitHub, npm, Show HN, VS Code 마켓, App Store에서 찾았습니다. 직접 경쟁인지 일부 겹치는지는 AI가 판정했습니다.', 'Found through web search, GitHub, npm, Show HN, the VS Code marketplace and the App Store. Whether each is a direct rival or a partial overlap was judged by AI.')}</p>
              <div className="[&>ul+ul>:first-child]:border-t-0">
                <SupplyGroup title={t('직접 경쟁 (AI 판정)', 'Direct rivals (AI judged)')} items={direct.slice(0, TOP_TOOLS)} />
                <SupplyGroup title={t('일부 겹침 (AI 판정)', 'Partial overlap (AI judged)')} items={partial.slice(0, Math.max(0, TOP_TOOLS - direct.length))} />
              </div>
              {opportunity.supply.length > TOP_TOOLS && (
                <details className="group">
                  <summary className="link-seed cursor-pointer list-none py-3 group-open:hidden [&::-webkit-details-marker]:hidden">{t(`도구 ${opportunity.supply.length - TOP_TOOLS}개 더 보기`, `${opportunity.supply.length - TOP_TOOLS} more tools`)}</summary>
                  <div className="[&>ul+ul>:first-child]:border-t-0 [&>ul:first-child>:first-child]:border-t-0">
                    <SupplyGroup title={t('직접 경쟁 (AI 판정)', 'Direct rivals (AI judged)')} items={direct.slice(TOP_TOOLS)} />
                    <SupplyGroup title={t('일부 겹침 (AI 판정)', 'Partial overlap (AI judged)')} items={partial.slice(Math.max(0, TOP_TOOLS - direct.length))} />
                  </div>
                </details>
              )}
            </section>
            <section aria-labelledby="fit-heading">
              <h2 id="fit-heading" className="text-[16px] font-bold">{t('내 스택과 맞는가', 'Fit with your stack')}</h2>
              {!fit || !fit.chosen ? (
                <p className="mt-2 text-sm leading-6 text-muted">
                  <Link href={fit ? '/onboarding' : `/login?next=/opportunities/${opportunity.slug}`} className="font-medium text-seed underline underline-offset-4">{fit ? '프로필에서 기술 스택을 고르면' : '로그인하고 프로필에 기술 스택을 고르면'}</Link> 이 기회와 겹치는 스택을 보여 드립니다.
                </p>
              ) : fit.matched.length ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-muted">고른 스택 <span className="num text-ink">{fit.chosen}</span>개 중 <span className="num font-semibold text-ink">{fit.matched.length}</span>개가 이 문제의 원문과 도구 설명에 나옵니다.</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {fit.matched.map((name) => <li key={name} className="chip">{name}</li>)}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted">고른 스택 <span className="num text-ink">{fit.chosen}</span>개는 이 문제의 원문과 도구 설명에 나오지 않습니다. 못 만든다는 뜻은 아니고, 익숙한 영역과 거리가 있다는 뜻입니다.</p>
              )}
            </section>
            {lang === 'ko' && (
              <section aria-labelledby="korea-heading">
                <h2 id="korea-heading" className="text-[16px] font-bold">한국에서도 그런가</h2>
                <p className="mb-4 mt-1 text-sm leading-6 text-muted">위 원문은 모두 영어권 커뮤니티에서 나왔습니다. 한국 커뮤니티 글은 아직 수집하지 않으니 직접 찾아보세요. 검색어는 <span className="font-semibold text-ink">{korea.query}</span>입니다.</p>
                <ul className="rows">
                  {korea.places.map((place) => (
                    <li key={place.name}>
                      <a href={place.href} target="_blank" rel="noopener noreferrer" className="group flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block text-[15px] group-hover:underline group-hover:underline-offset-4">{place.name}</span>
                          <span className="block text-xs text-muted">{place.note}</span>
                        </span>
                        <span aria-hidden="true" className="text-muted">›</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
