import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { BookOpen, FileSearch, GitBranch } from 'lucide-react';
import AgentStart from '@/components/AgentStart';
import IdeaComposer from '@/components/IdeaComposer';
import PrdBuilder from '@/components/opportunity-stage/PrdBuilder';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { readBuildProgress } from '@/lib/opportunities/build-progress';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { loadPrdPolicy, prdModels } from '@/lib/opportunities/models';
import { PRD_MAX_EVIDENCE as MAX_EVIDENCE, readPrdCache, samplePrdSlug } from '@/lib/opportunities/prd-cache';
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
    const sample = await samplePrdSlug(service, [...qualified].sort((a, b) => Number(b.slug === 'llm-provider-schema-normalization') - Number(a.slug === 'llm-provider-schema-normalization'))).catch(() => null);
    const saved = new Set((await Promise.all(qualified.map(async (item) => ((await readPrdCache(service, item.evidence.slice(0, MAX_EVIDENCE).map((row) => row.id))) ? item.slug : null)))).filter(Boolean));
    return (
      <>
        <Header />
        <main id="main-content" className="page-shell grow">
          <section className="mx-auto flex max-w-[860px] flex-col items-center pt-6 text-center md:pt-14" aria-labelledby="prd-start-heading">
            <h1 id="prd-start-heading" className="text-[clamp(28px,4vw,44px)] font-bold leading-[1.2] tracking-[-0.035em] [text-wrap:balance]">{t('한 줄 아이디어면 PRD가 시작돼요', 'One line of an idea starts the PRD')}</h1>
            <p className="mt-3 max-w-[36em] text-[16px] leading-7 text-tertiary">{t('원문이 받쳐 주는 줄만 근거로 표시하고, 나머지는 가설로 남깁니다.', 'Only lines real quotes back count as evidence; the rest stay hypotheses.')}</p>
            <div className="mt-8 w-full"><IdeaComposer /></div>
          </section>

          <section className="mx-auto mt-16 max-w-[860px]" aria-labelledby="ways-heading">
            <h2 id="ways-heading" className="text-[15px] font-semibold text-tertiary">{t('다른 방법으로 시작하기', 'Other ways to start')}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {([
                [sample ? `/prd?opportunity=${encodeURIComponent(sample)}` : '#verified', t('예시 PRD 둘러보기', 'See an example PRD'), t('저장된 PRD로 문서·기능 명세·와이어프레임을 바로 봅니다', 'Open a saved PRD: document, feature graph, wireframes'), BookOpen],
                ['#verified', t('검증된 문제로 시작', 'Start from a verified problem'), t('원문 3건·플랫폼 2곳을 넘은 문제에서 근거 있는 PRD를 만듭니다', 'Build an evidence-backed PRD from a problem that passed the bar'), FileSearch],
                ['/seeds', t('내 저장소로 역기획', 'Reverse-spec my repo'), t('GitHub 레포를 읽고 빠진 기능을 원문 근거로 제안합니다', 'Read a GitHub repo and suggest missing features from quotes'), GitBranch],
              ] as const).map(([href, title, body, Icon]) => (
                <li key={title}>
                  <Link href={href} className="card flex h-full flex-col p-5 transition-colors hover:border-outline-strong">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-mid text-tertiary"><Icon aria-hidden="true" className="h-5 w-5" /></span>
                    <span className="mt-5 text-[16px] font-semibold text-ink">{title}</span>
                    <span className="mt-1.5 text-sm leading-6 text-muted">{body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <h2 id="verified" className="mx-auto mt-20 max-w-[860px] scroll-mt-24 text-xl font-bold tracking-tight">{t('기준을 통과한 문제로 시작하기', 'Start from a problem that passed the bar')}</h2>
          {qualified.length ? (
            <ul className="rows mx-auto mt-5 max-w-[860px]">
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
            <p className="empty-state mx-auto mt-10 max-w-[860px]">{t('아직 기준을 통과한 문제가 없습니다.', 'No problem has passed the bar yet.')}</p>
          )}
          <div className="mx-auto max-w-[860px]"><Link href="/opportunities" className="link-seed mt-6">{t('기회 전체 보기', 'See all opportunities')} ›</Link></div>
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
          <h1 className="text-[clamp(26px,3vw,34px)] font-bold leading-tight tracking-tight">{title} PRD</h1>
          <p className="mt-2 text-[15px] leading-7 text-muted">
            <span className="font-medium text-seed">{t(`개발자 원문 ${picked.length}건`, `${picked.length} developer quotes`)}</span>
            {slugs.length > 1 ? t(` · 기회 ${slugs.length}개`, ` · ${slugs.length} opportunities`) : ''}
            {' · '}
            {t('요구사항 → 기능 → 화면까지 이어진 PRD를 만듭니다. 항목을 누르면 그 항목이 기대는 원문이 함께 강조됩니다.', 'Build a PRD traced from requirements to features to screens. Click any item to light up the quotes behind it.')}
            {!ready && <> {t('원문이 기준(원문 3건, 플랫폼 2곳)에 못 미쳐 가설 초안으로 만듭니다.', 'The quotes are below the bar (3 quotes, 2 platforms), so it is made as a hypothesis draft.')}</>}
          </p>
          {/* MCP builds from the evidence-only PRD of an opportunity, so the hand-off is offered only for one. */}
          {opportunity && <AgentStart slug={opportunity.slug} name={title} className="mt-4" />}
        </header>
        <section className="mt-6" aria-label={t('PRD 작업 공간', 'PRD workspace')}>
          <PrdBuilder title={title} evidenceIds={pickedIds} ready={ready} loginNext={self} initial={saved} signedIn={Boolean(user)} progress={progress} models={prdModels(await loadPrdPolicy(createAdminClient()))} />
        </section>
      </main>
      <Footer />
    </>
  );
}
