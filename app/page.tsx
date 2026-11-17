import Link from 'next/link';
import { redirect } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import IdeaComposer from '@/components/IdeaComposer';
import OpportunityMap from '@/components/OpportunityMap';
import CopyCommand from '@/components/landing/CopyCommand';
import LeadChart from '@/components/landing/LeadChart';
import SignalToSpec from '@/components/landing/SignalToSpec';
import { cached } from '@/lib/cache';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { buildOpportunityDigest } from '@/lib/newsletter/opportunity-digest';
import { listIssues } from '@/lib/newsletter/issues';
import { getOpportunities } from '@/lib/opportunities/data';
import { DEMO_PRD } from '@/lib/opportunities/demo-prd';
import { trackRecord, trackRecordSummary } from '@/lib/opportunities/insight';
import { mapPoints } from '@/lib/opportunities/map';
import { localizedOpportunity } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const WEEK_MS = 7 * 86_400_000;

// Starting points for the closing band. Ideas only: what the workspace finds for them depends on the quotes stored that day.
const EXAMPLES = [
  { ko: '팀별로 LLM API 비용을 나눠 보는 대시보드', en: 'A dashboard that splits LLM API costs by team', short: ['LLM 비용 대시보드', 'LLM cost dashboard'], why: ['여러 모델을 쓰는 팀의 비용 문제', 'For teams paying for several models'] },
  { ko: '오픈소스 이슈를 자동으로 분류하는 봇', en: 'A bot that triages open-source issues', short: ['이슈 분류 봇', 'Issue triage bot'], why: ['이슈가 쌓이는 메인테이너의 문제', 'For maintainers buried in issues'] },
  { ko: '코딩 에이전트의 권한을 단계별로 정하는 도구', en: 'A tool that sets a coding agent’s permissions step by step', short: ['에이전트 권한 관리', 'Agent permissions'], why: ['에이전트에 일을 맡기는 개발자의 문제', 'For developers handing work to agents'] },
] as const;

/** Subscribing needs an account, so the address is handed to the sign-in page as the Google account hint, and the note says so. */
function SubscribeForm({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <form action="/login" className="flex w-full max-w-[30rem] flex-col gap-2.5 sm:flex-row sm:flex-wrap">
      <input type="hidden" name="next" value="/newsletter-preview" />
      <label htmlFor="subscribe-email" className="sr-only">{t('이메일 주소', 'Email address')}</label>
      <input id="subscribe-email" type="email" name="email" required autoComplete="email" placeholder={t('이메일 주소', 'Email address')} className="h-12 min-w-0 flex-1 border bg-white px-4 text-base text-ink placeholder:text-muted" />
      <button type="submit" className="btn-quiet h-12 shrink-0 whitespace-nowrap px-5 text-[15px]">{t('주간 신호 받기', 'Get the weekly signal')}</button>
      <p className="basis-full text-[13px] text-muted">{t('이 주소의 Google 계정으로 로그인하면 구독이 끝납니다.', 'Sign in with the Google account for this address to finish subscribing.')}</p>
    </form>
  );
}

// The four MCP tools, in the order an agent uses them.
const TOOLS = [
  ['search_opportunities', '원문 3건, 플랫폼 2곳 이상으로 확인된 문제를 찾습니다.', 'Finds problems backed by 3+ quotes from 2+ sites.'],
  ['generate_verified_prd', '원문이 붙은 PRD를 AGENTS.md, CLAUDE.md, .cursorrules로 받습니다.', 'Returns the evidence-traced PRD as AGENTS.md, CLAUDE.md or .cursorrules.'],
  ['get_build_checklist', '기능마다 완료 기준을 받아 하나씩 만듭니다.', 'Gives each feature its done criteria, one at a time.'],
  ['mark_feature_done', '끝난 기능을 표시하면 PRD 화면에 진행이 보입니다.', 'Marks a feature done; the PRD page shows the progress.'],
] as const;

export default async function Home() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  // Signed-in readers start from today's feed; this page is the front door.
  if (user) redirect('/newsletter-preview');
  const lang = await getLang();
  const t = translator(lang);

  const { opportunities, generatedAt } = await getOpportunities();
  const counted = new Date(generatedAt);
  // The run's own time stands in for "now": the page describes that run, and rendering stays pure.
  const now = counted.getTime();
  const latest = await cached('landing-issue', async () => (await listIssues(createAdminClient(), 1))[0] ?? null, 10 * 60_000).catch(() => null);
  // The archived Monday issue when there is one; otherwise the same builder the Monday job uses, run on today's data.
  const issue = latest?.issue ?? buildOpportunityDigest(opportunities, new Date(now - WEEK_MS).toISOString(), '', 'weekly', now);
  const points = mapPoints(opportunities, counted.getTime(), lang);
  const rows = trackRecord(opportunities);
  const record = trackRecordSummary(rows, opportunities.length);
  const names = Object.fromEntries(opportunities.map((item) => [item.slug, localizedOpportunity(item, lang).name]));
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com').replace(/\/+$/, '');
  const day = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
  const asOf = day.format(counted);
  const issueDay = latest ? day.format(new Date(`${latest.period}T00:00:00+09:00`)) : day.format(counted);
  const lead = issue?.top[0];

  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <section className="mx-auto grid w-full max-w-[1200px] items-center gap-x-12 gap-y-10 px-5 pb-4 pt-10 sm:px-6 md:px-8 lg:min-h-[min(calc(100svh-120px),780px)] lg:grid-cols-[minmax(0,10fr)_minmax(0,14fr)] lg:py-10" aria-labelledby="hero-heading">
          <div className="min-w-0">
            <h1 id="hero-heading" className="t-display lg:text-[clamp(40px,4vw,58px)]">{t('개발자가 쓴 글로', 'PRDs from what')}<br />{t('PRD를 만듭니다.', 'developers wrote.')}</h1>
            <p className="t-lead mt-6 max-w-[29em]">{t('요구사항마다 원문이 연결되고, 코딩 에이전트가 그 PRD로 바로 만들기 시작합니다.', 'Every requirement links to its source, and your coding agent builds straight from it.')}</p>
            <div className="mt-8 max-w-[34rem]">
              <IdeaComposer compact id="hero-idea" placeholder={t('예: Tenor 대신 쓸 GIF 검색 API', 'e.g. A GIF search API to replace Tenor')} examples={EXAMPLES.map((row) => ({ label: t(row.short[0], row.short[1]), idea: t(row.ko, row.en) }))} />
            </div>
            <p className="mt-3 text-[13px] text-muted">{t('초안까지는 로그인 없이, PRD 생성은 로그인 후 하루 10개까지 무료.', 'Draft without an account; sign in to generate, free for 10 a day.')}</p>
          </div>
          <SignalToSpec demo={DEMO_PRD} siteUrl={siteUrl} />
        </section>

        <section className="section" aria-labelledby="map-heading">
          <div className="grid items-end gap-x-16 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div>
              <h2 id="map-heading" className="t-section">{t('오늘, 근거가 쌓이고 있는 문제', 'Problems gathering evidence today')}</h2>
              <p className="t-lead mt-4 max-w-[36em]">{t('매일 아침 개발자 커뮤니티와 GitHub, 사용자 포럼을 읽습니다. 같은 불만이 여러 곳에서 나오면 지도에 올라갑니다.', 'Every morning Seedup reads developer communities, GitHub and user forums. When the same complaint shows up in several places, it lands on the map.')}</p>
            </div>
            <p className="text-[13px] text-muted lg:text-right">{t(`${asOf} 기준, 문제 ${opportunities.length}개`, `${opportunities.length} problems as of ${asOf}`)}<br /><Link href="/newsletter-preview" className="link-seed">{t('오늘의 신호 전체 보기', 'See all of today’s signals')}</Link></p>
          </div>
          <div className="mt-10"><OpportunityMap points={points} /></div>
        </section>

        {rows.length > 0 && (
          <section className="section grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="record-heading">
            <div>
              <h2 id="record-heading" className="t-section">{t('도구가 나오기 전에 먼저 봤습니다.', 'We saw it before the tools shipped.')}</h2>
              <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-outline-soft py-6">
                <div><dt className="text-[14px] text-muted">{t('앞선 기간 (중간값)', 'Median lead')}</dt><dd className="num mt-1 text-[clamp(40px,4vw,56px)] font-bold leading-none tracking-[-0.04em] text-seed">{t(`${record.medianLeadDays}일`, `${record.medianLeadDays}d`)}</dd></div>
                <div><dt className="text-[14px] text-muted">{t('도구보다 먼저 본 문제', 'Seen before a tool')}</dt><dd className="num mt-1 text-[clamp(40px,4vw,56px)] font-bold leading-none tracking-[-0.04em]">{record.hits}<span className="text-[0.45em] font-semibold text-muted"> / {record.total}</span></dd></div>
              </dl>
              <p className="t-lead mt-6">{t('Seedup이 가진 가장 이른 원문과, 그 뒤에 처음 나온 관련 도구 사이의 날짜를 셌습니다.', 'Counted from the earliest quote Seedup holds to the first related tool that shipped after it.')}</p>
              <p className="mt-4 text-[13px] leading-6 text-muted">{t(`${asOf} 기준으로 저장된 날짜에서 계산했습니다. 더 이른 원문이 있었을 수 있어 실제로 앞선 기간은 더 길 수 있습니다.`, `Computed from stored dates as of ${asOf}. Earlier quotes may exist, so the real lead can be longer.`)}</p>
              <Link href="/opportunities" className="link-seed mt-3">{t('적중 기록 자세히', 'The full track record')}</Link>
            </div>
            <LeadChart rows={rows} names={names} lang={lang} />
          </section>
        )}

        <section className="section-wide grid items-start gap-x-16 gap-y-10 lg:grid-cols-2" aria-labelledby="agent-heading">
          <div className="min-w-0">
            <h2 id="agent-heading" className="t-section">{t('기획서에서 끝나지 않습니다.', 'It doesn’t stop at the spec.')}</h2>
            <p className="t-lead mt-4 max-w-[30em]">{t('Seedup은 MCP 서버입니다. Claude Code나 Cursor가 검증된 PRD를 직접 받아, 기능을 하나씩 만들고 끝난 기능을 표시합니다.', 'Seedup is an MCP server. Claude Code or Cursor pulls the verified PRD, builds it one feature at a time and marks each one done.')}</p>
            <div className="mt-8"><CopyCommand command={`claude mcp add --transport http seedup ${siteUrl}/api/mcp`} /></div>
            <Link href="/profile" className="link-seed">{t('에이전트 연결하기', 'Connect your agent')}</Link>
          </div>
          <dl className="rows min-w-0">
            {TOOLS.map(([name, ko, en]) => (
              <div key={name} className="py-5">
                <dt className="font-mono text-[14px] font-semibold text-seed">{name}</dt>
                <dd className="mt-1.5 text-[16px] leading-7 text-tertiary">{t(ko, en)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="section grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="weekly-heading">
          <div className="min-w-0">
            <h2 id="weekly-heading" className="t-section">{t('월요일 아침, 읽을 것만.', 'Monday morning, only what matters.')}</h2>
            <p className="t-lead mt-4 max-w-[28em]">{t('기준을 통과한 문제와 이번 주에 움직인 문제, 관심 분야에 맞춘 읽을거리를 메일 한 통으로 보냅니다.', 'Problems that passed the bar, problems that moved this week, and reads picked for your interests, in one mail.')}</p>
            <div className="mt-8"><SubscribeForm lang={lang} /></div>
          </div>
          {issue && (
            <article className="card min-w-0 p-6 sm:p-8">
              <p className="flex justify-between gap-4 text-[13px] text-muted">
                <span className="font-semibold text-seed">{t('Seedup 주간 신호', 'Seedup weekly signal')}</span>
                <span>{issueDay}</span>
              </p>
              <h3 className="mt-4 text-[22px] font-bold leading-snug tracking-[-0.02em] [text-wrap:balance]">{issue.headline}</h3>
              {lead && (
                <div className="mt-6 border-t border-outline-soft pt-5">
                  <p className="text-[13px] text-muted">{t('지금 근거가 가장 탄탄한 문제', 'The best-backed problem right now')}</p>
                  <Link href={`/opportunities/${lead.slug}`} className="mt-1 block text-[18px] font-semibold leading-snug underline-offset-4 hover:underline">{names[lead.slug] ?? lead.name}</Link>
                  {lead.quote && (
                    <blockquote className="mt-4 border-l-2 border-seed pl-4">
                      <p lang="en" className="text-[16px] leading-7">“{lead.quote.text}”</p>
                      <footer className="mt-1 text-[13px] text-muted">{lead.quote.source}</footer>
                    </blockquote>
                  )}
                </div>
              )}
              {issue.lines.some((line) => line.slug !== lead?.slug) && (
                <ul className="rows mt-6">
                  {issue.lines.filter((line) => line.slug !== lead?.slug).slice(0, 2).map((line) => (
                    <li key={line.slug} className="py-3.5">
                      <p className="text-[15px] font-semibold">{names[line.slug] ?? line.name}</p>
                      <p className={`mt-0.5 text-[14px] ${line.important ? 'text-seed' : 'text-muted'}`}>{line.note}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/newsletter-preview" className="link-seed mt-4">{t('이번 호 전체 보기', 'Read the whole issue')}</Link>
              {lang === 'en' && <p className="mt-2 text-[13px] text-muted">Issues are written in Korean for now.</p>}
            </article>
          )}
        </section>

        <section className="section-wide pb-24 md:pb-36" aria-labelledby="start-heading">
          <div className="mx-auto max-w-[60rem]">
            <h2 id="start-heading" className="t-section text-center">{t('내 아이디어에는 어떤 원문이 있을까요?', 'What have developers said about your idea?')}</h2>
            <div className="mx-auto mt-8 max-w-[44rem]"><IdeaComposer compact id="closing-idea" placeholder={t('만들고 싶은 것을 한 줄로 적어 주세요', 'Describe what you want to build in one line')} /></div>
            <ul className="mt-10 grid gap-3 md:grid-cols-3" aria-label={t('이렇게 시작해 볼 수 있습니다', 'Ideas to start from')}>
              {EXAMPLES.map((row) => (
                <li key={row.ko}>
                  <Link href={`/prd/new?idea=${encodeURIComponent(t(row.ko, row.en))}`} className="card flex h-full flex-col p-5 transition-colors hover:border-outline-strong">
                    <span className="text-[16px] font-semibold leading-snug">{t(row.ko, row.en)}</span>
                    <span className="mt-2 text-[14px] leading-6 text-muted">{t(row.why[0], row.why[1])}</span>
                    <span className="link-seed mt-auto pt-4">{t('이 아이디어로 시작', 'Start from this idea')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
