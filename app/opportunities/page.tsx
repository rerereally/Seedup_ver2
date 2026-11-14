import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import OpportunityTable, { FunnelStrip, STATUS_LABELS } from '@/components/opportunity-stage/OpportunityTable';
import PageIntro from '@/components/PageIntro';
import { getOpportunities, opportunityColors, summarizeFunnel } from '@/lib/opportunities/data';
import { trackRecord, trackRecordSummary } from '@/lib/opportunities/insight';
import { getLang } from '@/lib/i18n-server';
import { translator } from '@/lib/i18n';
import { MIN_EVIDENCE, MIN_PLATFORMS } from '@/lib/opportunities/types';
import type { OpportunityStatus } from '@/lib/opportunities/types';

export const metadata: Metadata = {
  title: '기회',
  description: '개발자들의 실제 불만과 이미 있는 도구를 대조해 찾은 제품 기회입니다.',
};

const STATUSES: OpportunityStatus[] = ['open', 'narrowing', 'closed'];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { opportunities, generatedAt } = await getOpportunities();
  const active = STATUSES.find((item) => item === status);
  const visible = active ? opportunities.filter((item) => item.status === active) : opportunities;
  const record = trackRecord(opportunities);
  const summary = trackRecordSummary(record, opportunities.length);
  const lang = await getLang();
  const t = translator(lang);
  const day = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });
  const updated = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(generatedAt));

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <PageIntro title="살펴볼 기회" description="개발자들이 공개적으로 남긴 불만을 원문과 대조하고, 이미 있는 도구를 확인해 정리했습니다." meta={`${updated}에 분석했습니다`} />
        <FunnelStrip funnel={summarizeFunnel(opportunities)} />
        <div className="flex flex-col gap-3">
          <nav className="tabs self-start" aria-label="상태로 걸러 보기">
            <Link href="/opportunities" className="tab" aria-current={active ? undefined : 'page'}>전체 <span className="num">{opportunities.length}</span></Link>
            {STATUSES.map((item) => (
              <Link key={item} href={`/opportunities?status=${item}`} className="tab" aria-current={active === item ? 'page' : undefined}>
                {STATUS_LABELS[item]} <span className="num">{opportunities.filter((row) => row.status === item).length}</span>
              </Link>
            ))}
          </nav>
          <OpportunityTable opportunities={visible} colors={opportunityColors(opportunities)} />
          <p className="max-w-[62em] text-[13px] leading-6 text-muted">
            막대가 다 차면 기준을 넘은 것입니다. 기준은 서로 다른 게시글 {MIN_EVIDENCE}건 이상, 플랫폼 {MIN_PLATFORMS}종 이상입니다. 기존 도구는 GitHub, npm, Show HN, VS Code 마켓만 조사했고, 직접 경쟁인지는 무료 AI 모델이 판정했습니다.
          </p>
        </div>
        {!active && record.length > 0 && (
          <section aria-labelledby="record-heading">
            <h2 id="record-heading" className="text-2xl font-extrabold tracking-tight">{t('적중 기록', 'Track record')}</h2>
            <p className="mt-1 max-w-[46em] text-sm leading-6 text-muted">{t('불만이 먼저 나오고, 그 뒤에 관련 도구가 나온 문제입니다. 가지고 있는 가장 이른 증언 날짜와 도구가 만들어진 날짜를 비교했습니다. 더 이른 증언이 있었을 수 있습니다.', 'Problems where the complaint came first and a related tool appeared later. We compare the earliest quote we hold with the date each tool was created; earlier complaints may exist.')}</p>
            <dl className="card mt-5 grid grid-cols-2 overflow-hidden sm:grid-cols-4">
              {([
                [t('먼저 짚은 문제', 'Called early'), `${summary.hits}/${summary.total}`, `${summary.rate}%`],
                [t('뒤에 나온 도구', 'Tools that followed'), String(summary.tools), t('개', 'tools')],
                [t('앞선 기간 중간값', 'Median lead'), summary.medianLeadDays.toLocaleString('en-US'), t('일', 'days')],
                [t('가장 길게 앞선 기간', 'Longest lead'), summary.maxLeadDays.toLocaleString('en-US'), t('일', 'days')],
              ] as const).map(([label, value, unit], index) => (
                <div key={label} className={`border-outline-soft px-5 py-4 ${index % 2 ? 'border-l' : ''} ${index > 1 ? 'border-t sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}>
                  <dt className="label">{label}</dt>
                  <dd className="mt-1 text-[15px] text-muted"><span className="num mr-1 text-[28px] font-semibold leading-none text-ink">{value}</span>{unit}</dd>
                </div>
              ))}
            </dl>
            <ul className="card mt-5 overflow-hidden">
              {record.map((row, index) => (
                <li key={row.slug} className={`grid gap-x-8 gap-y-2 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] ${index ? 'border-t border-outline-soft' : ''}`}>
                  <div className="min-w-0">
                    <Link href={`/opportunities/${row.slug}`} className="text-[15px] font-bold underline-offset-4 hover:underline">{row.name}</Link>
                    <p className="mt-0.5 text-[13px] text-muted">{t('첫 증언', 'First quote')} <time dateTime={row.firstSeenAt} className="num">{day.format(new Date(row.firstSeenAt))}</time></p>
                  </div>
                  <ul className="grid min-w-0 gap-1">
                    {row.followers.slice(0, 3).map((tool) => (
                      <li key={tool.url} className="grid gap-1 text-sm">
                        <span className="flex items-baseline justify-between gap-3">
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-muted underline-offset-4 hover:text-ink hover:underline">{tool.name}</a>
                          <span className="num shrink-0 text-[13px] text-ink">{t(`${tool.leadDays.toLocaleString('ko-KR')}일 뒤`, `${tool.leadDays.toLocaleString('en-US')} days later`)}</span>
                        </span>
                        {/* How far ahead the complaint was, on one scale for the whole list. */}
                        <span aria-hidden="true" className="h-1.5 rounded-full bg-surface-high"><span className="block h-full rounded-full bg-hot" style={{ width: `${Math.max(4, Math.round((tool.leadDays / Math.max(1, summary.maxLeadDays)) * 100))}%` }} /></span>
                      </li>
                    ))}
                    {row.followers.length > 3 && <li className="text-[13px] text-muted">{t(`외 ${row.followers.length - 3}개`, `and ${row.followers.length - 3} more`)}</li>}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
