import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import OpportunityTable, { FunnelStrip, STATUS_LABELS } from '@/components/opportunity-stage/OpportunityTable';
import PageIntro from '@/components/PageIntro';
import { getOpportunities, opportunityColors, summarizeFunnel } from '@/lib/opportunities/data';
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
      </main>
      <Footer />
    </>
  );
}
