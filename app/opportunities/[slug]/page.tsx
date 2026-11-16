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
import { getOpportunity } from '@/lib/opportunities/data';
import { koreaLens, scoreOpportunity, stackFit, whyNow } from '@/lib/opportunities/insight';
import { describeChange } from '@/lib/opportunities/merge';
import { createClient } from '@/lib/supabase/server';
import { PLATFORM_LABELS } from '@/lib/opportunities/types';
import type { Evidence, SupplyItem, SupplyKind } from '@/lib/opportunities/types';

const SUPPLY_LABELS: Record<SupplyKind, string> = { github: 'GitHub', npm: 'npm', show_hn: 'Show HN', vscode: 'VS Code' };

// Asked about what already happened, never about a hypothetical product, so the answers are not just politeness.
const FIRST_USER_QUESTIONS = [
  '이 문제를 가장 최근에 겪은 것이 언제였나요? 그때 무슨 작업을 하던 중이었나요?',
  '그때 어떻게 해결했나요? 그 방법에서 가장 번거로운 부분은 무엇이었나요?',
  '해결하려고 써 본 도구가 있나요? 계속 쓰지 않게 된 이유는 무엇인가요?',
  '이 문제 때문에 지금까지 들인 시간이나 돈은 어느 정도인가요?',
];

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
  return compact.format(item.popularity);
}

/** The stacks picked in the profile, or null for a visitor who is not signed in. */
async function preferredStack(): Promise<string[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await supabase.from('user_onboarding').select('answers').eq('user_id', data.user.id).maybeSingle();
  const stack = (row?.answers as { preferred_stack?: unknown } | null)?.preferred_stack;
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
              <span className="block text-xs text-muted">{SUPPLY_LABELS[item.kind]}{supplyMetric(item) ? <> · <span className="num">{supplyMetric(item)}</span></> : null}</span>
            </span>
            <span className="shrink-0 text-sm text-muted">{title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// The sections below the quotes fold shut, so the page reads as: the problem, the proof, then the detail on demand.
const fold = 'group border-b border-outline-soft';
const foldSummary = 'flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 text-lg font-semibold tracking-tight [&::-webkit-details-marker]:hidden';
const chevron = <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">›</span>;

export default async function OpportunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const opportunity = await getOpportunity(slug);
  if (!opportunity) notFound();

  const lang = await getLang();
  const t = translator(lang);
  const text = localizedOpportunity(opportunity, lang);
  const firstSeen = opportunity.firstSeenAt ? day.format(new Date(opportunity.firstSeenAt)) : null;
  const score = scoreOpportunity(opportunity);
  const stats: Array<[string, number]> = [
    [t('개발자 원문', 'Developer quotes'), opportunity.evidence.length],
    [t('플랫폼', 'Platforms'), opportunity.platforms.length],
    [t('직접 경쟁 도구', 'Direct rivals'), opportunity.directCount],
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
  // How far this problem has grown. Design and build happen after this page, so they are never the current step here.
  const steps = [
    `${t('신호 발견', 'Signal found')}${firstSeen ? ` · ${firstSeen}` : ''}`,
    opportunity.qualified ? t('검증 통과', 'Verified') : t('검증', 'Verification'),
    t('설계', 'Design'),
    t('구현', 'Build'),
  ];
  const current = opportunity.qualified ? 1 : 0;
  const quote = (item: Evidence, index: number) => (
    <li key={item.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 py-6">
      <span className="num pt-0.5 text-[15px] font-semibold text-seed">{index + 1}</span>
      <div className="min-w-0">
        <q lang="en" className="block text-[17px] leading-7 text-ink [text-wrap:pretty]">{item.quote}</q>
        {lang === 'ko' && item.quoteKo && <p className="mt-1.5 text-[15px] leading-7 text-muted [text-wrap:pretty]">{item.quoteKo}</p>}
        <p className="mt-2 text-[13px] text-muted">
          {PLATFORM_LABELS[item.platform]}
          {item.postedAt && <> · <time dateTime={item.postedAt}>{day.format(new Date(item.postedAt))}</time></>}
          {' · '}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-seed underline-offset-4 hover:underline">{t('원문', 'Source')} ›</a>
        </p>
      </div>
    </li>
  );

  return (
    <>
      <Header />
      {/* The extra bottom padding on phones clears the fixed PRD bar. */}
      <main id="main-content" className="page-shell grow pb-24 lg:pb-12">
        <Link href="/opportunities" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><span aria-hidden="true">‹</span> {t('기회 목록', 'All opportunities')}</Link>
        <ol className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted" aria-label={t('진행 단계', 'Stage')}>
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-4" aria-current={index === current ? 'step' : undefined}>
              {index > 0 && <span aria-hidden="true" className="h-px w-8 bg-outline-strong" />}
              <span className={index === current ? 'font-semibold text-seed' : ''}>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0">
            <h1 className="page-intro-title">{text.name}</h1>
            <p className="mt-4 max-w-[36em] text-lg leading-8 text-tertiary [text-wrap:pretty]">{text.problem}</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <StatusLabel status={opportunity.status} lang={lang} />
              <span>{opportunity.qualified ? t('근거 기준 통과', 'Passed the evidence bar') : t('근거가 아직 부족합니다', 'Not enough evidence yet')}</span>
            </p>

            {text.gap && (
              <div className="mt-7 max-w-[40em] border-l-2 border-seed pl-5">
                <p className="label">{t('남은 빈틈', 'The gap')}</p>
                <p className="mt-1 text-[17px] leading-8 [text-wrap:pretty]">{text.gap}</p>
              </div>
            )}

            <dl className="mt-8 grid grid-cols-2 gap-y-6 border-y border-outline-soft py-6 sm:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt className="label">{label}</dt>
                  <dd className="mt-2 text-[28px] font-bold leading-none tracking-tight text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] text-muted">
              {firstSeen && <>{t(`가장 이른 증언은 ${firstSeen}에 나왔습니다.`, `First quote: ${firstSeen}.`)} </>}
              {t(`첫 증언 뒤 나온 도구 ${opportunity.followersAfterSignal}개.`, `Tools since first quote: ${opportunity.followersAfterSignal}.`)}
            </p>

            <section className="mt-12" aria-labelledby="quotes-heading">
              <h2 id="quotes-heading" className="text-2xl font-bold tracking-tight">{t('개발자 원문', 'Developer quotes')}</h2>
              <p className="mt-1 text-sm text-muted">{t('모두 공개 글 원문과 글자 단위로 일치합니다. 번역은 이해를 돕기 위한 것입니다.', 'Every quote matches its public source character by character.')}</p>
              <ol className="rows mt-5">{opportunity.evidence.slice(0, 3).map(quote)}</ol>
              {opportunity.evidence.length > 3 && (
                <details className="group">
                  <summary className="link-seed cursor-pointer list-none py-4 pl-10 group-open:hidden [&::-webkit-details-marker]:hidden">{t(`원문 ${opportunity.evidence.length - 3}건 더 보기`, `${opportunity.evidence.length - 3} more quotes`)} ›</summary>
                  <ol className="rows [&>:first-child]:border-t-0">{opportunity.evidence.slice(3).map((item, index) => quote(item, index + 3))}</ol>
                </details>
              )}
            </section>

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
                    {history.length > 1 ? '분석을 돌릴 때마다 달라진 점만 남깁니다.' : '아직 한 번 분석한 상태입니다. 다음 분석에서 증언이나 경쟁 도구가 달라지면 여기에 쌓입니다.'}
                  </p>
                  <ol className="rows mb-5 [&>:last-child]:border-b-0">
                    {[...history].reverse().map((entry) => (
                      <li key={entry.at} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                        <time dateTime={entry.at} className="num w-28 shrink-0 text-[13px] text-muted">{day.format(new Date(entry.at))}</time>
                        <span className="min-w-0 flex-1 text-sm leading-6">
                          {entry.changes.length ? entry.changes.join(' · ') : `증언 ${entry.evidence}건, 플랫폼 ${entry.platforms}종으로 처음 기록`}
                        </span>
                        <StatusLabel status={entry.status} lang={lang} />
                      </li>
                    ))}
                  </ol>
                </details>
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
                          <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="text-seed underline-offset-4 hover:underline">{index + 1}번 글 ›</a>
                        ))}
                      </li>
                    );
                  })}
                </ul>
                <h3 className="mt-6 text-[15px] font-semibold">{t('만나면 물어볼 것', 'What to ask them')}</h3>
                <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-tertiary marker:text-seed">
                  {FIRST_USER_QUESTIONS.map((question) => <li key={question}>{question}</li>)}
                </ol>
                <p className="mt-3 pb-5 text-[13px] leading-6 text-muted">내 해결책을 설명하기 전에 묻습니다. 미래에 쓸지 묻지 않고, 지난번에 실제로 어떻게 했는지를 묻습니다.</p>
              </details>
            </div>
          </article>

          <aside className="flex min-w-0 flex-col gap-10 lg:sticky lg:top-24 lg:self-start">
            <OpportunityPrd lang={lang} ready={opportunity.qualified} slug={opportunity.slug} evidenceCount={opportunity.evidence.length} />
            <section aria-labelledby="supply-heading">
              <h2 id="supply-heading" className="text-lg font-semibold tracking-tight">{t('이미 있는 도구', 'Existing tools')}</h2>
              <p className="mb-4 mt-1 text-[13px] text-muted">{opportunity.supply.length === 0 ? '조사한 범위에서 관련 도구를 찾지 못했습니다.' : t('GitHub, npm, Show HN, VS Code 마켓에서 찾았습니다.', 'Found on GitHub, npm, Show HN and the VS Code marketplace.')}</p>
              <div className="[&>ul+ul>:first-child]:border-t-0">
                <SupplyGroup title={t('직접 경쟁', 'Direct rival')} items={direct} />
                <SupplyGroup title={t('일부 겹침', 'Partial overlap')} items={partial} />
              </div>
            </section>
            <section aria-labelledby="fit-heading">
              <h2 id="fit-heading" className="text-lg font-semibold tracking-tight">{t('내 스택과 맞는가', 'Fit with your stack')}</h2>
              {!fit || !fit.chosen ? (
                <p className="mt-2 text-sm leading-6 text-muted">
                  <Link href={fit ? '/onboarding' : `/login?next=/opportunities/${opportunity.slug}`} className="font-medium text-seed underline underline-offset-4">{fit ? '프로필에서 기술 스택을 고르면' : '로그인하고 프로필에 기술 스택을 고르면'}</Link> 이 기회와 겹치는 스택을 보여 드립니다.
                </p>
              ) : fit.matched.length ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-muted">고른 스택 <span className="num text-ink">{fit.chosen}</span>개 중 <span className="num font-semibold text-ink">{fit.matched.length}</span>개가 이 문제의 증언과 도구 설명에 나옵니다.</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {fit.matched.map((name) => <li key={name} className="chip">{name}</li>)}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted">고른 스택 <span className="num text-ink">{fit.chosen}</span>개는 이 문제의 증언과 도구 설명에 나오지 않습니다. 못 만든다는 뜻은 아니고, 익숙한 영역과 거리가 있다는 뜻입니다.</p>
              )}
            </section>
            {lang === 'ko' && (
              <section aria-labelledby="korea-heading">
                <h2 id="korea-heading" className="text-lg font-semibold tracking-tight">한국에서도 그런가</h2>
                <p className="mb-4 mt-1 text-sm leading-6 text-muted">위 증언은 모두 영어권 커뮤니티에서 나왔습니다. 한국 커뮤니티 글은 아직 수집하지 않으니 직접 찾아보세요. 검색어는 <span className="font-semibold text-ink">{korea.query}</span>입니다.</p>
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
