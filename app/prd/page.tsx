import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import IdeaComposer from '@/components/IdeaComposer';
import PrdBuilder from '@/components/opportunity-stage/PrdBuilder';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { readBuildProgress } from '@/lib/opportunities/build-progress';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { loadPrdPolicy, prdModels } from '@/lib/opportunities/models';
import { PRD_MAX_EVIDENCE as MAX_EVIDENCE, readPrdCache, samplePrdSlug } from '@/lib/opportunities/prd-cache';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { PLATFORM_LABELS, localizedOpportunity } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'PRD' };

// One-line ideas to start from: what the workspace finds for them depends on the quotes stored that day.
const IDEAS: Array<[string, string]> = [
  ['LLM 제공사를 코드 수정 없이 바꾸는 도구', 'Switch LLM providers without code changes'],
  ['AI 에이전트의 DB 접근을 막는 가드레일', 'Guardrails between AI agents and databases'],
  ['Tenor 대신 쓸 GIF 검색 API', 'A GIF search API to replace Tenor'],
];

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
    const sample = await samplePrdSlug(service, [...qualified].sort((a, b) => Number(b.slug === 'llm-provider-schema-normalization') - Number(a.slug === 'llm-provider-schema-normalization'))).catch(() => null);
    const saved = new Set((await Promise.all(qualified.map(async (item) => ((await readPrdCache(service, item.evidence.slice(0, MAX_EVIDENCE).map((row) => row.id))) ? item.slug : null)))).filter(Boolean));
    return (
      <>
        <Header />
        <main id="main-content" className="page-shell grow">
          <section className="mx-auto flex max-w-[860px] flex-col items-center justify-center text-center lg:min-h-[min(calc(100svh-120px),780px)]" aria-labelledby="prd-start-heading">
            <h1 id="prd-start-heading" className="t-display text-[clamp(32px,4vw,48px)]">{t('한 줄 아이디어면 PRD가 시작돼요', 'One line of an idea starts the PRD')}</h1>
            <div className="mt-8 w-full"><IdeaComposer examples={IDEAS.map(([ko, en]) => ({ label: t(ko, en), idea: t(ko, en) }))} /></div>
            {sample && <Link href={`/prd?opportunity=${encodeURIComponent(sample)}`} className="link-seed mt-4">{t('먼저 예시 PRD 보기', 'See an example PRD first')}</Link>}
          </section>

          <section className="mx-auto mt-32 max-w-[860px] pb-16" aria-labelledby="verified">
            <h2 id="verified" className="t-section scroll-mt-24">{t('기준을 통과한 문제로 시작하기', 'Start from a problem that passed the bar')}</h2>
            <p className="mt-2 text-[15px] text-muted">{t('원문 3건, 플랫폼 2곳을 넘은 문제입니다. 저장된 PRD가 있으면 바로 열립니다.', 'Problems with 3+ quotes from 2+ sites. A saved PRD opens right away.')}</p>
            {qualified.length ? (
              <ul className="rows mt-5">
                {qualified.map((item) => {
                  const text = localizedOpportunity(item, lang);
                  return (
                    <li key={item.slug}>
                      <Link href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="group flex min-h-20 items-center justify-between gap-6 py-4">
                        <span className="min-w-0">
                          <span className="block text-[17px] font-semibold text-ink underline-offset-4 group-hover:underline">{text.name}</span>
                          <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{text.problem}</span>
                        </span>
                        <span className="shrink-0 text-right text-sm text-muted">{t(`원문 ${item.evidence.length}건`, `${item.evidence.length} quotes`)}<span className={`mt-0.5 block font-semibold ${saved.has(item.slug) ? 'text-seed' : ''}`}>{saved.has(item.slug) ? t('PRD 바로 보기', 'Read the PRD') : t('PRD 만들기', 'Make a PRD')}</span></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="empty-state mt-10">{t('아직 기준을 통과한 문제가 없습니다.', 'No problem has passed the bar yet.')}</p>
            )}
            <div><Link href="/opportunities" className="link-seed mt-6">{t('기회 전체 보기', 'See all opportunities')}</Link></div>
          </section>
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
    supabase ? getCurrentUser() : null,
    readPrdCache(createAdminClient(), pickedIds),
  ]);
  // What a coding agent marked done through MCP. Only an opportunity's own PRD has it, since that is what MCP builds from.
  const progress = opportunity && user ? await readBuildProgress(supabase, user.id, opportunity.slug) : undefined;
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
          <h1 className="text-[clamp(28px,3.2vw,40px)] font-bold leading-tight tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 text-[15px] leading-7 text-tertiary">
            {t(`개발자 원문 ${picked.length}건에서 요구사항, 기능, 화면까지 이어진 PRD입니다.`, `A PRD traced from ${picked.length} developer quotes to requirements, features and screens.`)}
            {slugs.length > 1 && t(` 기회 ${slugs.length}개의 원문을 함께 썼습니다.`, ` It draws on ${slugs.length} opportunities.`)}
            {!ready && <> {t('원문이 기준(원문 3건, 플랫폼 2곳)에 못 미쳐 가설 초안으로 만듭니다.', 'The quotes are below the bar (3 quotes, 2 platforms), so it is made as a hypothesis draft.')}</>}
          </p>
        </header>
        <section className="mt-6" aria-label={t('PRD 작업 공간', 'PRD workspace')}>
          {/* MCP builds from the evidence-only PRD of an opportunity, so its start prompt is offered only for one. */}
          <PrdBuilder title={title} evidenceIds={pickedIds} ready={ready} loginNext={self} initial={saved} signedIn={Boolean(user)} progress={progress} models={prdModels(await loadPrdPolicy(createAdminClient()))} showTitle={false} agentSlug={opportunity?.slug}>
            {/* Before a PRD exists, show the quotes it will stand on and what it will contain. */}
            <div className="mt-8 grid max-w-[52rem] gap-8 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_20rem]">
              <section aria-labelledby="prd-sources">
                <h2 id="prd-sources" className="text-[15px] font-semibold">{t(`이 원문 ${picked.length}건으로 만듭니다`, `Built from these ${picked.length} quotes`)}</h2>
                <ol className="mt-3 grid gap-2">
                  {picked.map(({ evidence }, index) => (
                    <li key={evidence.id} className="rounded-xl border border-outline-soft bg-white px-4 py-3">
                      <p className="flex items-baseline justify-between gap-3 text-[12.5px] text-muted">
                        <span><b className="mr-1.5 font-semibold text-seed">E{index + 1}</b>{PLATFORM_LABELS[evidence.platform]}</span>
                        <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center underline-offset-4 hover:text-ink hover:underline">{t('원문', 'Source')}</a>
                      </p>
                      <q lang="en" className="mt-0.5 block text-[15px] leading-7 text-ink [overflow-wrap:anywhere]">{evidence.quote}</q>
                      {lang === 'ko' && evidence.quoteKo && <span className="mt-0.5 block text-[13px] leading-6 text-muted">{evidence.quoteKo}</span>}
                    </li>
                  ))}
                </ol>
              </section>
              <section aria-labelledby="prd-contents">
                <h2 id="prd-contents" className="text-[15px] font-semibold">{t('PRD에 들어가는 것', 'What the PRD contains')}</h2>
                <ul className="rows mt-3 text-[14px] leading-6">
                  {[
                    [t('요구사항', 'Requirements'), t('원문이 받쳐 주는 것만 근거로, 나머지는 가설로', 'Backed by quotes, or marked as hypotheses')],
                    [t('기능 명세', 'Feature spec'), t('요구사항, 기능, 화면이 이어진 그래프', 'A graph linking requirements, features and screens')],
                    [t('유저플로우와 와이어프레임', 'User flow and wireframes'), t('화면 순서와 화면별 기능 배치', 'Screen order and what each screen holds')],
                    [t('에이전트 파일', 'Agent file'), t('AGENTS.md, CLAUDE.md, .cursorrules로 내보내기', 'Export as AGENTS.md, CLAUDE.md or .cursorrules')],
                  ].map(([name, what]) => (
                    <li key={name} className="py-3"><b className="block font-semibold">{name}</b><span className="text-muted">{what}</span></li>
                  ))}
                </ul>
              </section>
            </div>
          </PrdBuilder>
        </section>
      </main>
      <Footer />
    </>
  );
}
