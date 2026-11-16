import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PrdBuilder from '@/components/opportunity-stage/PrdBuilder';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { PRD_MAX_EVIDENCE as MAX_EVIDENCE, readPrdCache } from '@/lib/opportunities/prd-cache';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { localizedOpportunity } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'PRD' };

/**
 * The PRD workspace at full width: one opportunity (?opportunity=slug) or quotes collected elsewhere
 * (?evidence=id1,id2). With neither, it lists the problems that are ready for a PRD.
 */
export default async function PrdPage({ searchParams }: { searchParams: Promise<{ opportunity?: string; evidence?: string }> }) {
  const params = await searchParams;
  const lang = await getLang();
  const t = translator(lang);
  const { opportunities } = await getOpportunities();

  if (!params.opportunity && !params.evidence) {
    const qualified = opportunities.filter((item) => item.qualified);
    // Saved PRDs open at once for anyone, so the list says which ones are ready to read.
    const service = createAdminClient();
    const saved = new Set((await Promise.all(qualified.map(async (item) => ((await readPrdCache(service, item.evidence.slice(0, MAX_EVIDENCE).map((row) => row.id))) ? item.slug : null)))).filter(Boolean));
    return (
      <>
        <Header />
        <main id="main-content" className="page-shell grow">
          <h1 className="page-intro-title">PRD</h1>
          <p className="page-intro-description">{t('기준을 통과한 문제에서 시작합니다. 원문만 근거로 요구사항, 기능, 화면까지 이어진 PRD를 만들어 코딩 에이전트에 넘깁니다.', 'Start from a verified problem. The PRD traces requirements, features and screens back to developer quotes, ready for a coding agent.')}</p>
          {qualified.length ? (
            <ul className="rows mt-10">
              {qualified.map((item) => {
                const text = localizedOpportunity(item, lang);
                return (
                  <li key={item.slug}>
                    <Link href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="group flex min-h-20 items-center justify-between gap-6 py-4">
                      <span className="min-w-0">
                        <span className="block text-[17px] font-semibold text-ink underline-offset-4 group-hover:underline">{text.name}</span>
                        <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{text.problem}</span>
                      </span>
                      <span className="shrink-0 text-right text-sm text-muted">{t(`원문 ${item.evidence.length}건`, `${item.evidence.length} quotes`)}<span className={`mt-0.5 block font-medium ${saved.has(item.slug) ? 'text-seed' : ''}`}>{saved.has(item.slug) ? t('PRD 바로 보기', 'Read the PRD') : t('PRD 만들기', 'Make a PRD')} ›</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state mt-10">{t('아직 기준을 통과한 문제가 없습니다.', 'No problem has passed the bar yet.')}</p>
          )}
          <Link href="/opportunities" className="link-seed mt-6">{t('기회 전체 보기', 'See all opportunities')} ›</Link>
        </main>
        <Footer />
      </>
    );
  }

  const opportunity = params.opportunity ? opportunities.find((item) => item.slug === params.opportunity) : null;
  const requestedIds = opportunity
    ? opportunity.evidence.map((item) => item.id)
    : (params.evidence ?? '').split(',').map((id) => id.trim()).filter((id) => /^[\w.:-]{1,120}$/.test(id));
  const picked = findEvidence(opportunities, requestedIds.slice(0, MAX_EVIDENCE));
  if (!picked.length) notFound();

  const pickedIds = picked.map((item) => item.evidence.id);
  const supabase = await createClient();
  const [user, saved] = await Promise.all([
    supabase ? supabase.auth.getUser().then(({ data }) => data.user) : null,
    readPrdCache(createAdminClient(), pickedIds),
  ]);
  const ready = meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
  const slugs = [...new Set(picked.map((item) => item.slug))];
  const lead = opportunity ?? opportunities.find((item) => item.slug === slugs[0]) ?? null;
  const title = lead ? localizedOpportunity(lead, lang).name : t('담은 근거', 'Collected evidence');
  const self = opportunity ? `/prd?opportunity=${encodeURIComponent(opportunity.slug)}` : `/prd?evidence=${encodeURIComponent(picked.map((item) => item.evidence.id).join(','))}`;

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <nav className="text-sm text-muted" aria-label={t('위치', 'Breadcrumb')}>
          <Link href="/opportunities" className="hover:text-ink">{t('기회', 'Opportunities')}</Link>
          {lead && <> <span aria-hidden="true">›</span> <Link href={`/opportunities/${lead.slug}`} className="hover:text-ink">{title}</Link></>}
        </nav>
        <header className="mt-3 max-w-[52em]">
          <h1 className="text-[clamp(26px,3vw,34px)] font-bold leading-tight tracking-tight">{title} PRD</h1>
          <p className="mt-2 text-[15px] leading-7 text-muted">
            <span className="font-medium text-seed">{t(`개발자 원문 ${picked.length}건`, `${picked.length} developer quotes`)}</span>
            {slugs.length > 1 ? t(` · 기회 ${slugs.length}개`, ` · ${slugs.length} opportunities`) : ''}
            {' · '}
            {t('요구사항 → 기능 → 화면까지 이어진 PRD를 만듭니다. 항목을 누르면 그 항목이 기대는 원문이 함께 강조됩니다.', 'Build a PRD traced from requirements to features to screens. Click any item to light up the quotes behind it.')}
            {!ready && <> {t('원문이 기준(원문 3건, 플랫폼 2곳)에 못 미쳐 가설 초안으로 만듭니다.', 'The quotes are below the bar (3 quotes, 2 platforms), so it is made as a hypothesis draft.')}</>}
          </p>
        </header>
        <section className="mt-6" aria-label={t('PRD 작업 공간', 'PRD workspace')}>
          <PrdBuilder title={title} evidenceIds={pickedIds} ready={ready} loginNext={self} initial={saved} signedIn={Boolean(user)} />
        </section>
      </main>
      <Footer />
    </>
  );
}
