import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PrdBuilder from '@/components/opportunity-stage/PrdBuilder';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { localizedOpportunity } from '@/lib/opportunities/types';

export const metadata: Metadata = { title: 'PRD' };

const MAX_EVIDENCE = 12;

/**
 * The PRD workspace at full width: one opportunity (?opportunity=slug) or quotes collected on the home stage
 * (?evidence=id1,id2). The trace view needs room for its four columns, so it lives here, not in a sidebar.
 */
export default async function PrdPage({ searchParams }: { searchParams: Promise<{ opportunity?: string; evidence?: string }> }) {
  const params = await searchParams;
  const lang = await getLang();
  const t = translator(lang);
  const { opportunities } = await getOpportunities();

  const opportunity = params.opportunity ? opportunities.find((item) => item.slug === params.opportunity) : null;
  const requestedIds = opportunity
    ? opportunity.evidence.map((item) => item.id)
    : (params.evidence ?? '').split(',').map((id) => id.trim()).filter((id) => /^[\w.:-]{1,120}$/.test(id));
  const picked = findEvidence(opportunities, requestedIds.slice(0, MAX_EVIDENCE));
  if (!picked.length) notFound();

  const ready = meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
  const slugs = [...new Set(picked.map((item) => item.slug))];
  const lead = opportunity ?? opportunities.find((item) => item.slug === slugs[0]) ?? null;
  const title = lead ? localizedOpportunity(lead, lang).name : t('담은 근거', 'Collected evidence');
  const self = opportunity ? `/prd?opportunity=${encodeURIComponent(opportunity.slug)}` : `/prd?evidence=${encodeURIComponent(picked.map((item) => item.evidence.id).join(','))}`;

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        {lead && (
          <Link href={`/opportunities/${lead.slug}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink">
            <span aria-hidden="true">←</span> {t('기회로 돌아가기', 'Back to the opportunity')}
          </Link>
        )}
        <header className="mt-4 max-w-[52em]">
          <p className="label">{t('근거 추적 PRD 작업 화면', 'Evidence-traced PRD workspace')}</p>
          <h1 className="page-intro-title mt-2">{title}</h1>
          <p className="page-intro-description">
            {t(
              `증언 ${picked.length}건${slugs.length > 1 ? `(기회 ${slugs.length}개)` : ''}으로 요구사항 → 기능 → 화면까지 이어진 PRD를 만듭니다. 항목을 누르면 그 항목이 기대는 원문이 함께 강조됩니다.`,
              `Turn ${picked.length} quotes${slugs.length > 1 ? ` from ${slugs.length} opportunities` : ''} into a PRD traced from requirements to features to screens. Click any item to light up the source quotes behind it.`,
            )}
            {!ready && <> {t('근거가 기준(증언 3건, 플랫폼 2종)에 못 미쳐 가설 초안으로 만듭니다.', 'The evidence is below the bar (3 quotes, 2 platforms), so it is made as a hypothesis draft.')}</>}
          </p>
        </header>
        <section className="mt-8 rounded-[24px] bg-[#fbfbfa] p-5 text-[#111113] md:p-8" aria-label={t('PRD 작업 공간', 'PRD workspace')}>
          <PrdBuilder title={title} evidenceIds={picked.map((item) => item.evidence.id)} ready={ready} loginNext={self} />
        </section>
      </main>
      <Footer />
    </>
  );
}
