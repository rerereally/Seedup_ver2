import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import IdeaComposer from '@/components/IdeaComposer';
import RepoPicks, { rankRepos } from '@/components/RepoPicks';
import { getContentHref } from '@/lib/content-targets';
import { getGitHubTrends, getScrapKeySet, getScraps } from '@/lib/data';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { getOpportunities } from '@/lib/opportunities/data';
import { dossierChanges } from '@/lib/opportunities/insight';
import { describeChange } from '@/lib/opportunities/merge';
import { MIN_EVIDENCE, MIN_PLATFORMS, PLATFORM_LABELS, localizedOpportunity } from '@/lib/opportunities/types';
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

/**
 * The signed-in front page: what this person is working on (their PRDs and the problems they watch, with what changed
 * since they saved them), what is worth a look today, and what they kept for their coding agent.
 */
export default async function HomeDesk({ user, lang }: { user: User; lang: Lang }) {
  const t = translator(lang);
  const supabase = await createClient();
  const [{ opportunities, generatedAt }, scraps, keptKeys, trends, dossierRows, token] = await Promise.all([
    getOpportunities(),
    getScraps(),
    getScrapKeySet(),
    getGitHubTrends(),
    supabase ? supabase.from('evidence_dossiers').select('*').order('updated_at', { ascending: false }).limit(6).then(({ data, error }) => (error ? [] : (data ?? []) as Dossier[])) : Promise.resolve([] as Dossier[]),
    createAdminClient()?.from('mcp_tokens').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => Boolean(data)) ?? Promise.resolve(false),
  ]);

  const dossiers = dossierRows.map((dossier) => {
    const opportunity = opportunities.find((item) => item.slug === dossier.opportunity_slug);
    return { ...dossier, opportunity, notes: opportunity ? dossierChanges(dossier.evidence_ids, dossier.updated_at, opportunity, describeChange).notes : [] };
  });
  // Today's picks: verified problems seen most recently, then the ones with the most quotes.
  const signals = [...opportunities]
    .filter((item) => item.qualified)
    .sort((a, b) => String(b.lastSeenAt ?? b.firstSeenAt ?? '').localeCompare(String(a.lastSeenAt ?? a.firstSeenAt ?? '')) || b.evidence.length - a.evidence.length)
    .slice(0, 3);
  const repos = rankRepos(trends);
  const day = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' });
  const date = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { dateStyle: 'medium' });
  const h2 = 'text-[22px] font-bold tracking-[-0.02em]';

  return (
    <main id="main-content" className="page-shell grow">
      <header>
        <p className="text-sm text-muted">{day.format(new Date(generatedAt))}</p>
        <h1 className="page-intro-title mt-2">{t('내 작업대', 'Your desk')}</h1>
        <p className="mt-3 max-w-[40em] text-[15px] leading-7 text-tertiary">{t('만들던 PRD와 지켜보는 문제, 오늘 볼 신호, 킵해 둔 것이 여기 모입니다.', 'Your PRDs and watched problems, today’s signals, and what you kept, in one place.')}</p>
        <div className="mt-6 max-w-[44rem]"><IdeaComposer compact id="home-idea" placeholder={t('새 아이디어를 한 줄로 적으면 PRD 작업 공간이 열립니다', 'Write a new idea in one line to open the PRD workspace')} /></div>
      </header>

      <div className="mt-16 grid gap-x-14 gap-y-16 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <section aria-labelledby="desk-prds">
            <h2 id="desk-prds" className={h2}>{t('내 PRD와 지켜보는 문제', 'Your PRDs and watched problems')}</h2>
            {dossiers.length ? (
              <ul className="rows mt-4">
                {dossiers.map((dossier) => (
                  <li key={dossier.id} className="py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <Link href={dossier.opportunity_slug ? `/prd?opportunity=${encodeURIComponent(dossier.opportunity_slug)}` : '/scrap'} className="text-[17px] font-semibold leading-snug underline-offset-4 hover:underline">
                        {dossier.opportunity ? localizedOpportunity(dossier.opportunity, lang).name : dossier.title}
                      </Link>
                      <time dateTime={dossier.updated_at} className="text-[13px] text-muted">{t(`${date.format(new Date(dossier.updated_at))} 저장`, `Saved ${date.format(new Date(dossier.updated_at))}`)}</time>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-muted">
                      <span>{t(`원문 ${dossier.evidence_ids.length}건`, `${dossier.evidence_ids.length} quotes`)}</span>
                      <span>{dossier.prd_markdown ? t('PRD 있음', 'PRD saved') : t('PRD 아직 없음', 'No PRD yet')}</span>
                    </p>
                    {dossier.notes.length > 0 && (
                      <div className="mt-3 border-l-2 border-seed pl-4">
                        <p className="text-[13px] font-semibold text-seed">{t('저장한 뒤 달라진 것', 'Changed since you saved it')}</p>
                        <ul className="mt-1 grid gap-0.5 text-[14px] leading-6">{dossier.notes.slice(0, 3).map((note) => <li key={note}>{note}</li>)}</ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-outline-strong px-6 py-8">
                <p className="text-[15px] font-semibold">{t('아직 저장한 PRD가 없습니다', 'No saved PRD yet')}</p>
                <p className="mt-1 text-[14px] leading-6 text-muted">{t('PRD를 보관함에 저장하면 여기서 이어서 볼 수 있고, 새 원문이나 경쟁 도구가 생기면 바뀐 점을 알려 드립니다.', 'Save a PRD to pick it up here; when new quotes or rival tools appear, this shows what changed.')}</p>
                <Link href="/prd#verified" className="link-seed mt-3">{t('검증된 문제로 PRD 만들기', 'Make a PRD from a verified problem')}</Link>
              </div>
            )}
          </section>

          <section className="mt-16" aria-labelledby="desk-signals">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="desk-signals" className={h2}>{t('오늘 볼 신호', 'Signals for today')}</h2>
              <Link href="/newsletter-preview" className="link-seed">{t('오늘의 신호 전체', 'All of today’s signals')}</Link>
            </div>
            <ol className="rows mt-4">
              {signals.map((item) => {
                const text = localizedOpportunity(item, lang);
                const quote = item.evidence.find((row) => row.quote.length >= 30 && row.quote.length <= 220) ?? item.evidence[0];
                return (
                  <li key={item.slug} className="py-6">
                    <p className="flex flex-wrap gap-x-3 text-[13px] text-muted">
                      <span className="font-semibold text-seed">{t(`원문 ${MIN_EVIDENCE}건, ${MIN_PLATFORMS}곳 이상`, `${MIN_EVIDENCE}+ quotes, ${MIN_PLATFORMS}+ sites`)}</span>
                      <span>{t(`원문 ${item.evidence.length}건`, `${item.evidence.length} quotes`)}</span>
                      <span>{item.directCount ? t(`직접 경쟁 ${item.directCount}개`, `${item.directCount} direct rivals`) : t('직접 경쟁 없음', 'No direct rival')}</span>
                    </p>
                    <Link href={`/opportunities/${item.slug}`} className="mt-1.5 block text-[18px] font-semibold leading-snug underline-offset-4 hover:underline">{text.name}</Link>
                    <p className="mt-1 line-clamp-2 text-[15px] leading-7 text-tertiary">{text.problem}</p>
                    {quote && (
                      <blockquote className="mt-3 border-l-2 border-seed pl-4">
                        <p lang="en" className="line-clamp-2 text-[15px] leading-7">“{quote.quote}”</p>
                        <footer className="mt-0.5 text-[13px] text-muted">{PLATFORM_LABELS[quote.platform]}</footer>
                      </blockquote>
                    )}
                    <Link href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="btn-quiet mt-4 h-10">{t('이 문제로 PRD 만들기', 'Make a PRD from this')}</Link>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-14">
          <section aria-labelledby="desk-kept">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="desk-kept" className={h2}>{t('킵한 것', 'Kept')}</h2>
              <Link href="/scrap" className="link-seed">{t('보관함', 'Library')}</Link>
            </div>
            {scraps.length ? (
              <ul className="rows mt-4">
                {scraps.slice(0, 5).map((item) => (
                  <li key={item.id} className="py-3.5">
                    <p className="text-[12.5px] text-muted">{t(...(TYPE_LABELS[item.item_type] ?? [item.item_type, item.item_type]))}</p>
                    <Link href={getContentHref(item.item_type, item.item_id)} className="mt-0.5 block truncate text-[15px] font-semibold underline-offset-4 hover:underline">{item.title}</Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-[14px] leading-6 text-muted">{t('글이나 저장소에서 킵하기를 누르면 여기에 모입니다.', 'Press Keep on an article or a repository and it lands here.')}</p>}
            <p className="mt-4 rounded-xl bg-surface-low px-4 py-3 text-[13px] leading-5 text-tertiary">
              {token
                ? t('에이전트가 연결되어 있습니다. 코딩 에이전트가 MCP get_kept_items로 킵한 것을 가져갑니다.', 'Your agent is connected; it reads what you kept through MCP get_kept_items.')
                : <>{t('에이전트를 연결하면 코딩 에이전트가 킵한 저장소와 글을 바로 가져갑니다. ', 'Connect your agent and it can read what you kept. ')}<Link href="/profile" className="font-semibold text-seed underline-offset-4 hover:underline">{t('에이전트 연결', 'Connect')}</Link></>}
            </p>
          </section>

          {repos.length > 0 && (
            <section aria-labelledby="desk-repos">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="desk-repos" className={h2}>{t('이번 주 오픈소스', 'Open source this week')}</h2>
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
