import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { Bot, Check, FileText, GitBranch, Lightbulb } from 'lucide-react';
import IdeaComposer from '@/components/IdeaComposer';
import RepoPicks, { rankRepos } from '@/components/RepoPicks';
import { getContentHref } from '@/lib/content-targets';
import { getGitHubTrends, getScrapKeySet, getScraps } from '@/lib/data';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { getOpportunities, getOpportunityEmbeddings } from '@/lib/opportunities/data';
import { dossierChanges, dossierHref } from '@/lib/opportunities/insight';
import { describeChange } from '@/lib/opportunities/merge';
import { PLATFORM_LABELS, localizedOpportunity } from '@/lib/opportunities/types';
import { forYou } from '@/lib/personal';
import NotInterestedButton from '@/components/NotInterestedButton';
import { recentReleases } from '@/lib/ingest/kept-repos';
import type { RepoRelease } from '@/lib/ingest/kept-repos';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type Dossier = { id: string; title: string; opportunity_slug: string | null; evidence_ids: string[]; prd_markdown: string | null; updated_at: string };

const TYPE_LABELS: Record<string, [string, string]> = {
  github: ['저장소', 'Repo'],
  news: ['글', 'Article'],
  paper: ['논문', 'Paper'],
  ai_product: ['AI 제품', 'AI product'],
  project: ['프로젝트', 'Project'],
  idea: ['아이디어', 'Idea'],
  trend: ['트렌드', 'Trend'],
};

const h2 = 'text-[17px] font-bold tracking-[-0.015em]';

/**
 * The signed-in front page, in the order a builder works: start something (first and widest), pick up what is in
 * progress, then what is worth a look. Problems worth building sit in the right column. New accounts get a short
 * setup list instead of empty sections.
 */
export default async function HomeDesk({ user, lang }: { user: User; lang: Lang }) {
  const t = translator(lang);
  const supabase = await createClient();
  const [{ opportunities, generatedAt }, scraps, keptKeys, trends, dossierRows, token, answers, embeddings] = await Promise.all([
    getOpportunities(),
    getScraps(),
    getScrapKeySet(),
    getGitHubTrends(),
    supabase ? supabase.from('evidence_dossiers').select('*').order('updated_at', { ascending: false }).limit(6).then(({ data, error }) => (error ? [] : (data ?? []) as Dossier[])) : Promise.resolve([] as Dossier[]),
    createAdminClient()?.from('mcp_tokens').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => Boolean(data)) ?? Promise.resolve(false),
    supabase ? supabase.from('user_onboarding').select('answers').eq('user_id', user.id).maybeSingle().then(({ data }) => (data?.answers ?? null) as unknown) : Promise.resolve(null),
    getOpportunityEmbeddings().catch(() => ({} as Record<string, number[]>)),
  ]);

  const dossiers = dossierRows.map((dossier) => {
    const opportunity = opportunities.find((item) => item.slug === dossier.opportunity_slug);
    return { ...dossier, opportunity, notes: opportunity ? dossierChanges(dossier.evidence_ids, dossier.updated_at, opportunity, describeChange).notes : [] };
  });
  const onboarded = Boolean(answers && Object.keys(answers as object).length);
  const picks = await forYou(user.id, {
    answers,
    kept: scraps,
    keptKeys,
    planTitles: dossiers.map((item) => (item.opportunity ? item.opportunity.name : item.title)),
    opportunities,
    opportunityEmbeddings: embeddings,
  }).catch(() => []);
  // The day's shared picks: verified problems seen most recently.
  const signals = [...opportunities]
    .filter((item) => item.qualified)
    .sort((a, b) => String(b.lastSeenAt ?? b.firstSeenAt ?? '').localeCompare(String(a.lastSeenAt ?? a.firstSeenAt ?? '')) || b.evidence.length - a.evidence.length)
    .slice(0, 5);
  const repos = rankRepos(trends);
  const keptRepoIds = scraps.filter((item) => item.item_type === 'github' && item.item_id).map((item) => String(item.item_id));
  const keptRepoRows = keptRepoIds.length && supabase
    ? await supabase.from('github_trends').select('id,repo_full_name,latest_release').in('id', keptRepoIds).then(({ data, error }) => (error ? [] : (data ?? []) as Array<{ id: string; repo_full_name: string; latest_release: RepoRelease | null }>))
    : [];
  const releases = recentReleases(keptRepoRows).slice(0, 4);
  const day = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' });
  const date = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { dateStyle: 'medium' });

  const setup = [
    { done: onboarded, label: t('관심 분야와 스택 고르기', 'Pick your interests and stack'), hint: t('추천이 내 관심사로 바뀝니다', 'Recommendations follow your interests'), href: '/onboarding' },
    { done: dossiers.length > 0, label: t('첫 PRD 만들기', 'Make your first PRD'), hint: t('한 줄 아이디어면 됩니다', 'One line of an idea is enough'), href: '/prd' },
    { done: token, label: t('코딩 에이전트 연결', 'Connect your coding agent'), hint: t('Claude Code·Cursor가 PRD를 직접 가져갑니다', 'Claude Code and Cursor read your PRDs'), href: '/agents' },
  ];
  const setupLeft = setup.filter((step) => !step.done).length;
  const actions = [
    { icon: FileText, label: t('아이디어로 PRD', 'PRD from an idea'), href: '/prd' },
    { icon: GitBranch, label: t('레포 분석', 'Repo analysis'), href: '/seeds' },
    { icon: Lightbulb, label: t('아이디어 검증', 'Idea validation'), href: '/ideas' },
    { icon: Bot, label: token ? t('MCP 연동됨', 'MCP connected') : t('MCP 연동', 'MCP'), href: '/agents' },
  ];

  return (
    <main id="main-content" className="page-shell grow">
      {/* The desk's one job sits first and widest: start something. */}
      <header>
            <h1 className="page-intro-title md:text-[38px]">{t('무엇을 만들고 싶나요?', 'What do you want to build?')}</h1>
            <p className="mt-1 text-[13px] text-muted">{day.format(new Date(generatedAt))}</p>
            <div className="mt-4"><IdeaComposer compact id="home-idea" placeholder={t('한 줄로 적으면 PRD 작업 공간이 열립니다', 'One line opens the PRD workspace')} /></div>
            <nav aria-label={t('바로 가기', 'Shortcuts')} className="mt-3 flex flex-wrap gap-2">
              {actions.map(({ icon: Icon, label, href }) => (
                <Link key={href} href={href} className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-soft px-3 text-[13px] text-tertiary hover:border-outline-strong hover:text-ink">
                  <Icon aria-hidden="true" className="h-4 w-4" />{label}
                </Link>
              ))}
            </nav>
          </header>
      <div className="page-split mt-10">
        <div className="min-w-0 space-y-10">

          {setupLeft > 0 && (
            <section aria-labelledby="desk-setup">
              <h2 id="desk-setup" className={h2}>{t(`시작하기 ${setup.length - setupLeft}/${setup.length}`, `Get started ${setup.length - setupLeft}/${setup.length}`)}</h2>
              <ol className="mt-3 grid gap-2 sm:grid-cols-3">
                {setup.map((step) => (
                  <li key={step.href}>
                    <Link href={step.href} className="card flex h-full min-h-14 items-start gap-3 px-4 py-3 hover:border-outline-strong">
                      <span aria-hidden="true" className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${step.done ? 'border-seed bg-seed text-on-seed' : 'border-outline-strong'}`}>{step.done && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                      <span className="min-w-0">
                        <span className={`block text-[15px] font-semibold ${step.done ? 'text-muted line-through' : ''}`}>{step.label}</span>
                        <span className="block text-[13px] text-muted">{step.hint}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {dossiers.length > 0 && (
            <section aria-labelledby="desk-prds">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="desk-prds" className={h2}>{t('이어서 하기', 'Pick up where you left off')}</h2>
                <Link href="/scrap" className="link-seed">{t('북마크', 'Bookmarks')}</Link>
              </div>
              <ul className="rows mt-2">
                {dossiers.map((dossier) => (
                  <li key={dossier.id} className="py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <Link href={dossierHref(dossier, opportunities)} className="text-[15px] font-semibold leading-snug underline-offset-4 hover:underline">
                        {dossier.opportunity ? localizedOpportunity(dossier.opportunity, lang).name : dossier.title}
                      </Link>
                      <span className="flex flex-wrap gap-x-3 text-[13px] text-muted">
                        <span>{t(`원문 ${dossier.evidence_ids.length}건`, `${dossier.evidence_ids.length} quotes`)}</span><span>{dossier.prd_markdown ? t('PRD 있음', 'PRD saved') : t('PRD 아직 없음', 'No PRD yet')}</span><time dateTime={dossier.updated_at}>{date.format(new Date(dossier.updated_at))}</time>
                      </span>
                    </div>
                    {dossier.notes.length > 0 && <p className="mt-1 text-[13px] text-seed">{t('저장한 뒤 달라짐', 'Changed since saved')}: {dossier.notes.slice(0, 2).join(', ')}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="desk-kept">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="desk-kept" className={h2}>{t('최근 킵한 것', 'Recently kept')}</h2>
              <Link href="/scrap" className="link-seed">{t('북마크', 'Bookmarks')}</Link>
            </div>
            {scraps.length ? (
              <ul className="rows mt-2">
                {scraps.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-baseline gap-3 py-3">
                    <span className="w-16 shrink-0 text-[13px] text-muted">{t(...(TYPE_LABELS[item.item_type] ?? [item.item_type, item.item_type]))}</span>
                    <Link href={getContentHref(item.item_type, item.item_id)} className="min-w-0 truncate text-[15px] font-semibold underline-offset-4 hover:underline">{item.title}</Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[14px] leading-6 text-muted">{t('글이나 저장소에서 킵하기를 누르면 여기에 모이고, 연결된 코딩 에이전트도 가져갈 수 있습니다.', 'Press Keep on an article or repo and it lands here, where your connected agent can read it too.')}</p>}
          </section>

          <section aria-labelledby="desk-for-you">
            <h2 id="desk-for-you" className={h2}>{t('나를 위한 추천', 'For you')}</h2>
            {picks.length ? (
              <>
                <p className="mt-1 text-[13px] text-muted">
                  {onboarded || scraps.length
                    ? t('고른 관심 분야, 킵한 것, 만들고 있는 PRD와 가까운 순서입니다. 관심 없음을 누른 것은 빠집니다.', 'Ordered by your interests, what you kept and the PRDs you are making; anything you marked not interested drops out.')
                    : <>{t('아직 관심 분야가 없어 이번 주 많이 볼 만한 것을 골랐습니다. ', 'No interests yet, so these are this week’s strongest picks. ')}<Link href="/onboarding" className="font-semibold text-seed underline-offset-4 hover:underline">{t('관심 분야 고르기', 'Pick interests')}</Link></>}
                </p>
                <ul className="rows mt-2">
                  {picks.map((item) => (
                    <li key={item.key} className="py-3">
                      <p className="flex flex-wrap gap-x-3 text-[12.5px] text-muted"><span className="font-semibold text-seed">{item.kind}</span>{item.source && <span>{item.source}</span>}<span>{item.reason}</span></p>
                      <Link href={item.href} className="mt-0.5 block text-[15px] font-semibold leading-snug underline-offset-4 hover:underline">{item.title}</Link>
                      {item.target && <div className="mt-1"><NotInterestedButton itemType={item.target.type} itemId={item.target.id} /></div>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-[14px] leading-6 text-muted">
                {onboarded
                  ? t('추천을 준비하는 중입니다. 글이나 저장소를 킵하면 더 정확해집니다.', 'Recommendations are warming up. Keeping articles or repos makes them sharper.')
                  : <>{t('관심 분야를 고르면 이 자리에 나에게 맞는 문제, 글, 저장소가 모입니다. ', 'Pick your interests and this fills with problems, reads and repos that fit you. ')}<Link href="/onboarding" className="font-semibold text-seed underline-offset-4 hover:underline">{t('관심 분야 고르기', 'Pick interests')}</Link></>}
              </p>
            )}
          </section>
        </div>

        <aside className="page-side">
          <section aria-labelledby="desk-signals" className="card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="desk-signals" className="text-[16px] font-bold">{t('만들 만한 문제', 'Worth building')}</h2>
              <Link href="/newsletter-preview" className="link-seed">{t('전체', 'All')}</Link>
            </div>
            <p className="text-[13px] text-muted">{t('원문 3건, 2곳 이상으로 확인됨', 'Backed by 3+ quotes from 2+ sites')}</p>
            <ol className="rows mt-3">
              {signals.map((item) => (
                <li key={item.slug} className="py-3">
                  <Link href={`/opportunities/${item.slug}`} className="text-[14px] font-semibold leading-snug underline-offset-4 hover:underline">{localizedOpportunity(item, lang).name}</Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                    <span>{t(`원문 ${item.evidence.length}건`, `${item.evidence.length} quotes`)}</span>
                    <span>{item.platforms.slice(0, 2).map((platform) => PLATFORM_LABELS[platform]).join(', ')}</span>
                    <Link href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="ml-auto font-semibold text-seed underline-offset-4 hover:underline">{t('PRD 만들기', 'Make a PRD')}</Link>
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {releases.length > 0 && (
            <section aria-labelledby="desk-releases">
              <h2 id="desk-releases" className={h2}>{t('킵한 저장소 새 소식', 'New in repos you kept')}</h2>
              <ul className="rows mt-3">
                {releases.map((repo) => (
                  <li key={repo.id} className="py-3">
                    <p className="flex flex-wrap gap-x-3 text-[12.5px] text-muted"><span className="font-semibold text-seed">{repo.latest_release?.tag}</span><span>{date.format(new Date(String(repo.latest_release?.publishedAt)))}</span></p>
                    <a href={repo.latest_release?.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[15px] font-semibold underline-offset-4 hover:underline">{repo.repo_full_name}</a>
                    {repo.latest_release?.note && <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted">{repo.latest_release.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {repos.length > 0 && (
            <section aria-labelledby="desk-repos">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="desk-repos" className="text-[16px] font-bold">{t('이번 주 오픈소스', 'Open source this week')}</h2>
                <Link href="/news?tab=github" className="link-seed">{t('전체', 'All')}</Link>
              </div>
              <div className="mt-2"><RepoPicks repos={repos} kept={keptKeys} limit={3} /></div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
