import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { StatusLabel } from '@/components/opportunity-stage/OpportunityTable';
import OpportunityPrd from './OpportunityPrd';
import { getOpportunities, getOpportunity, opportunityColors } from '@/lib/opportunities/data';
import { describeChange } from '@/lib/opportunities/merge';
import { PLATFORM_LABELS } from '@/lib/opportunities/types';
import type { SupplyItem, SupplyKind } from '@/lib/opportunities/types';

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

function SupplyGroup({ title, items }: { title: string; items: SupplyItem[] }) {
  if (!items.length) return null;
  return (
    <div className="border-t border-outline-soft px-5 py-4 first:border-t-0">
      <h3 className="label">{title} <span className="num">{items.length}</span></h3>
      <ul className="mt-1">
        {items.map((item) => (
          <li key={item.url}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="group -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-low">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold group-hover:underline">{item.name.replace(/^Show HN:\s*/i, '')}</span>
                <span className="block text-xs text-muted">{SUPPLY_LABELS[item.kind]}</span>
              </span>
              <span className="num shrink-0 text-[13px] text-muted">{supplyMetric(item)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [opportunity, { opportunities }] = await Promise.all([getOpportunity(slug), getOpportunities()]);
  if (!opportunity) notFound();

  const color = opportunityColors(opportunities)[opportunity.slug]?.bg ?? '#62626a';
  const firstSeen = opportunity.firstSeenAt ? day.format(new Date(opportunity.firstSeenAt)) : null;
  const stats: Array<[string, number, string]> = [
    ['근거', opportunity.evidence.length, '건'],
    ['플랫폼', opportunity.platforms.length, '종'],
    ['직접 경쟁', opportunity.directCount, '개'],
    ['첫 증언 뒤 나온 도구', opportunity.followersAfterSignal, '개'],
  ];
  const points = opportunity.history ?? [];
  const history = points.map((entry, index) => ({ ...entry, changes: index ? describeChange(points[index - 1], entry) : [] }));
  const direct = opportunity.supply.filter((item) => item.relation === 'direct');
  const partial = opportunity.supply.filter((item) => item.relation !== 'direct');

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <Link href="/opportunities" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><span aria-hidden="true">←</span> 기회 목록</Link>
        <div className="mt-4 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span aria-hidden="true" className="h-3 w-8 rounded-full" style={{ background: color }} />
              <StatusLabel status={opportunity.status} />
              <span className="text-muted">{opportunity.qualified ? '근거 기준 통과' : '근거가 아직 부족합니다'}</span>
            </p>
            <h1 className="page-intro-title mt-3 md:text-[52px] md:leading-[1.08]">{opportunity.name}</h1>
            <p className="mt-4 max-w-[36em] text-lg leading-8 text-muted [text-wrap:pretty]">{opportunity.problem}</p>

            {opportunity.gap && (
              <div className="mt-7 max-w-[40em] border-l-[3px] pl-5" style={{ borderColor: color }}>
                <p className="label">남은 빈틈</p>
                <p className="mt-1 text-[17px] leading-8 [text-wrap:pretty]">{opportunity.gap}</p>
              </div>
            )}

            <dl className="card mt-8 grid grid-cols-2 overflow-hidden sm:grid-cols-4">
              {stats.map(([label, value, unit], index) => (
                <div key={label} className={`border-outline-soft px-5 py-4 ${index % 2 ? 'border-l' : ''} ${index > 1 ? 'border-t sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}>
                  <dt className="label">{label}</dt>
                  <dd className="mt-1 text-[15px] text-muted"><span className="num mr-0.5 text-[28px] font-semibold leading-none text-ink">{value}</span>{unit}</dd>
                </div>
              ))}
            </dl>
            {firstSeen && <p className="mt-3 text-[13px] text-muted">가장 이른 증언은 {firstSeen}에 나왔습니다.</p>}

            {history.length > 0 && (
              <section className="mt-12" aria-labelledby="growth-heading">
                <h2 id="growth-heading" className="text-2xl font-extrabold tracking-tight">성장 기록</h2>
                <p className="mt-1 text-sm text-muted">
                  {history.length > 1 ? '분석을 돌릴 때마다 달라진 점만 남깁니다.' : '아직 한 번 분석한 상태입니다. 다음 분석에서 증언이나 경쟁 도구가 달라지면 여기에 쌓입니다.'}
                </p>
                <ol className="card mt-5 overflow-hidden">
                  {[...history].reverse().map((entry, index) => (
                    <li key={entry.at} className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3.5 sm:px-6 ${index ? 'border-t border-outline-soft' : ''}`}>
                      <time dateTime={entry.at} className="num w-28 shrink-0 text-[13px] text-muted">{day.format(new Date(entry.at))}</time>
                      <span className="min-w-0 flex-1 text-sm leading-6">
                        {entry.changes.length ? entry.changes.join(' · ') : `증언 ${entry.evidence}건, 플랫폼 ${entry.platforms}종으로 처음 기록`}
                      </span>
                      <StatusLabel status={entry.status} />
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <h2 className="mt-12 flex items-baseline gap-2 text-2xl font-extrabold tracking-tight">현장 증언 <span className="num text-base font-medium text-muted">{opportunity.evidence.length}</span></h2>
            <p className="mt-1 text-sm text-muted">원문에 그대로 있는 문장만 실었습니다. 번역은 이해를 돕기 위한 것입니다.</p>
            <ul className="mt-5 grid gap-3">
              {opportunity.evidence.map((item) => (
                <li key={item.id} className="card p-5 sm:p-6">
                  <p className="flex items-center justify-between gap-3 text-[13px] text-muted">
                    <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{PLATFORM_LABELS[item.platform]}</span>
                    {item.postedAt && <time dateTime={item.postedAt} className="text-xs">{day.format(new Date(item.postedAt))}</time>}
                  </p>
                  <q lang="en" className="mt-3 block text-[17px] font-bold leading-7 [quotes:none] [text-wrap:pretty]">{item.quote}</q>
                  {item.quoteKo && <p className="mt-2 leading-7 text-muted [text-wrap:pretty]">{item.quoteKo}</p>}
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-9 items-center gap-1 text-sm font-bold text-ink underline-offset-4 hover:underline">원문 보기 <span aria-hidden="true">↗</span></a>
                </li>
              ))}
            </ul>

            <section className="mt-12" aria-labelledby="first-users-heading">
              <h2 id="first-users-heading" className="text-2xl font-extrabold tracking-tight">첫 10명 찾기</h2>
              <p className="mt-1 text-sm text-muted">이 문제를 직접 말한 사람들이 첫 사용자 후보입니다. 자동 댓글이나 쪽지는 보내지 않습니다. 글에 직접 답하며 대화를 시작하세요.</p>
              <div className="card mt-5 overflow-hidden">
                <div className="px-5 py-5 sm:px-6">
                  <h3 className="text-[15px] font-extrabold">이 사람들이 있는 곳</h3>
                  <ul className="mt-3 grid gap-2">
                    {opportunity.platforms.map((platform) => {
                      const threads = opportunity.evidence.filter((item) => item.platform === platform);
                      return (
                        <li key={platform} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                          <span className="font-bold text-ink">{PLATFORM_LABELS[platform]}</span>
                          <span className="text-muted">글 <span className="num">{threads.length}</span>개</span>
                          {threads.map((item, index) => (
                            <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4 hover:text-muted">{index + 1}번 글 <span aria-hidden="true">↗</span></a>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="border-t border-outline-soft px-5 py-5 sm:px-6">
                  <h3 className="text-[15px] font-extrabold">만나면 물어볼 것</h3>
                  <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted marker:text-muted">
                    {FIRST_USER_QUESTIONS.map((question) => <li key={question}>{question}</li>)}
                  </ol>
                  <p className="mt-3 text-[13px] leading-6 text-muted">내 해결책을 설명하기 전에 묻습니다. 미래에 쓸지 묻지 않고, 지난번에 실제로 어떻게 했는지를 묻습니다.</p>
                </div>
              </div>
            </section>
          </article>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <OpportunityPrd title={opportunity.name} evidenceIds={opportunity.evidence.map((item) => item.id)} ready={opportunity.qualified} slug={opportunity.slug} />
            <section className="card overflow-hidden" aria-labelledby="supply-heading">
              <h2 id="supply-heading" className="px-5 pt-5 text-lg font-extrabold">이미 있는 도구</h2>
              {opportunity.supply.length === 0
                ? <p className="px-5 pb-5 pt-2 text-sm leading-6 text-muted">조사한 범위에서 관련 도구를 찾지 못했습니다.</p>
                : (
                  <div className="mt-3">
                    <SupplyGroup title="직접 경쟁" items={direct} />
                    <SupplyGroup title="일부만 겹침" items={partial} />
                  </div>
                )}
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
