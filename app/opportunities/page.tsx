import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import OpportunityTable, { FunnelStrip, STATUS_LABELS } from '@/components/opportunity-stage/OpportunityTable';
import PageIntro from '@/components/PageIntro';
import { getOpportunities, opportunityColors, summarizeFunnel } from '@/lib/opportunities/data';
import { trackRecord } from '@/lib/opportunities/insight';
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
            <h2 id="record-heading" className="text-2xl font-extrabold tracking-tight">적중 기록</h2>
            <p className="mt-1 max-w-[46em] text-sm leading-6 text-muted">불만이 먼저 나오고, 그 뒤에 도구가 나온 문제입니다. 가지고 있는 가장 이른 증언 날짜와 도구가 만들어진 날짜를 비교했습니다. 더 이른 증언이 있었을 수 있습니다.</p>
            <ul className="card mt-5 overflow-hidden">
              {record.map((row, index) => (
                <li key={row.slug} className={`grid gap-x-8 gap-y-2 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] ${index ? 'border-t border-outline-soft' : ''}`}>
                  <div className="min-w-0">
                    <Link href={`/opportunities/${row.slug}`} className="text-[15px] font-bold underline-offset-4 hover:underline">{row.name}</Link>
                    <p className="mt-0.5 text-[13px] text-muted">첫 증언 <time dateTime={row.firstSeenAt} className="num">{day.format(new Date(row.firstSeenAt))}</time></p>
                  </div>
                  <ul className="grid min-w-0 gap-1">
                    {row.followers.slice(0, 3).map((tool) => (
                      <li key={tool.url} className="flex items-baseline justify-between gap-3 text-sm">
                        <a href={tool.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-muted underline-offset-4 hover:text-ink hover:underline">{tool.name}</a>
                        <span className="num shrink-0 text-[13px] text-ink">{tool.leadDays.toLocaleString('ko-KR')}일 뒤</span>
                      </li>
                    ))}
                    {row.followers.length > 3 && <li className="text-[13px] text-muted">외 <span className="num">{row.followers.length - 3}</span>개</li>}
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
