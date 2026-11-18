import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import HomeDesk from '@/components/home/HomeDesk';
import CopyCommand from '@/components/landing/CopyCommand';
import CountUp from '@/components/landing/CountUp';
import LeadChart from '@/components/landing/LeadChart';
import QuoteMarquee from '@/components/landing/QuoteMarquee';
import StepStory from '@/components/landing/StepStory';
import TryIdea, { StartAgain } from '@/components/landing/TryIdea';
import type { PoolItem } from '@/components/IdeaWorkspace';
import { cached } from '@/lib/cache';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { buildOpportunityDigest } from '@/lib/newsletter/opportunity-digest';
import { listIssues } from '@/lib/newsletter/issues';
import { getOpportunities } from '@/lib/opportunities/data';
import { DEMO_PRD } from '@/lib/opportunities/demo-prd';
import { trackRecord, trackRecordSummary } from '@/lib/opportunities/insight';
import { PLATFORM_LABELS, localizedOpportunity } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

const WEEK_MS = 7 * 86_400_000;

// The hero's example chips. Ideas only: what the workspace finds for them depends on the quotes stored that day.
const EXAMPLES = [
  { ko: '팀별로 LLM API 비용을 나눠 보는 대시보드', en: 'A dashboard that splits LLM API costs by team', short: ['LLM 비용 대시보드', 'LLM cost dashboard'] },
  { ko: '오픈소스 이슈를 자동으로 분류하는 봇', en: 'A bot that triages open-source issues', short: ['이슈 분류 봇', 'Issue triage bot'] },
  { ko: '코딩 에이전트의 권한을 단계별로 정하는 도구', en: 'A tool that sets a coding agent’s permissions step by step', short: ['에이전트 권한 관리', 'Agent permissions'] },
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

// The three rules the engine enforces in code: [Korean title, Korean body, English title, English body].
const PRINCIPLES: Array<[string, string, string, string]> = [
  ['원문이 없으면 가설', '어느 원문도 받쳐 주지 않는 요구사항은 서버가 가설로 옮깁니다. 지우지 않고, 확인할 거리로 남깁니다.', 'No quote, no requirement', 'A requirement no quote backs is moved to hypotheses by the server. It stays, as something to check.'],
  ['모델은 쓰고, 서버가 판정', '인용은 원문과 글자 단위로 대조하고, 기준(원문 3건, 2곳)은 코드가 셉니다. 모델의 점수는 근거로 쓰지 않습니다.', 'The model drafts, the server decides', 'Quotes are matched to the post letter by letter, and the bar (3 quotes, 2 sites) is counted in code. No model score counts as evidence.'],
  ['에이전트까지 끊기지 않음', '같은 PRD가 AGENTS.md, CLAUDE.md, Cursor 규칙, MCP로 그대로 넘어갑니다. 근거 번호도 함께 갑니다.', 'Straight through to the agent', 'The same PRD goes out as AGENTS.md, CLAUDE.md, Cursor rules or over MCP, quote numbers included.'],
];

export default async function Home() {
  const supabase = await createClient();
  const user = supabase ? await getCurrentUser() : null;
  const lang = await getLang();
  // Signed-in people start from their own desk; everyone else gets the front door.
  if (user) {
    return (
      <>
        <Header />
        <HomeDesk user={user} lang={lang} />
        <Footer />
      </>
    );
  }
  const t = translator(lang);

  const { opportunities, generatedAt } = await getOpportunities();
  const counted = new Date(generatedAt);
  // The run's own time stands in for "now": the page describes that run, and rendering stays pure.
  const now = counted.getTime();
  const latest = await cached('landing-issue', async () => (await listIssues(createAdminClient(), 1))[0] ?? null, 10 * 60_000).catch(() => null);
  // The archived Monday issue when there is one; otherwise the same builder the Monday job uses, run on today's data.
  const issue = latest?.issue ?? buildOpportunityDigest(opportunities, new Date(now - WEEK_MS).toISOString(), '', 'weekly', now);
  const rows = trackRecord(opportunities);
  const record = trackRecordSummary(rows, opportunities.length);
  const names = Object.fromEntries(opportunities.map((item) => [item.slug, localizedOpportunity(item, lang).name]));
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com').replace(/\/+$/, '');
  const day = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
  const asOf = day.format(counted);
  const issueDay = latest ? day.format(new Date(`${latest.period}T00:00:00+09:00`)) : day.format(counted);
  const lead = issue?.top[0];

  const quoteCount = opportunities.reduce((sum, item) => sum + item.evidence.length, 0);
  const sourceCount = new Set(opportunities.flatMap((item) => item.evidence.map((row) => row.platform))).size;
  const qualifiedCount = opportunities.filter((item) => item.qualified).length;
  const figures: Array<[number, string, string]> = [
    [quoteCount, '원문과 글자까지 일치한 인용', 'Quotes matched to the source'],
    [opportunities.length, '같은 불만끼리 묶은 문제', 'Problems grouped from them'],
    [qualifiedCount, '원문 3건, 2곳 이상으로 확인된 문제', 'Backed by 3+ quotes from 2+ sites'],
    [sourceCount, '원문이 나온 곳', 'Sites the quotes came from'],
  ];
  const sampleHref = `/prd?opportunity=${encodeURIComponent(DEMO_PRD.slug)}`;
  // What the hero's "try it now" matches against in the browser: names, keywords and two quotes per problem.
  const pool: PoolItem[] = opportunities.map((item) => {
    const text = localizedOpportunity(item, lang);
    return { slug: item.slug, name: text.name, problem: text.problem, keywords: item.keywords, qualified: item.qualified, quotes: item.evidence.slice(0, 2).map((row) => ({ id: row.id, platform: row.platform, quote: row.quote, quoteKo: row.quoteKo, url: row.url })) };
  });
  // One real quote per problem for the band under the hero, problems that passed the bar first.
  const drifting = [...opportunities].sort((a, b) => Number(b.qualified) - Number(a.qualified)).flatMap((item) => {
    const row = item.evidence[0];
    return row ? [{ id: row.id, text: row.quote.slice(0, 180), source: `${PLATFORM_LABELS[row.platform]}, ${names[item.slug]}` }] : [];
  }).slice(0, 14);
  const stepHead = (n: string, label: string, title: string, body: string, link?: { href: string; text: string }, extra?: React.ReactNode) => (
    <div className="min-w-0">
      <p className="site-label"><span className="text-seed">{n}</span> {label}</p>
      <h2 className="t-section mt-3 text-[clamp(28px,3vw,40px)]">{title}</h2>
      <p className="t-lead mt-4 max-w-[30em]">{body}</p>
      {link && <Link href={link.href} className="link-seed mt-3">{link.text}</Link>}
      {extra}
    </div>
  );

  return (
    <>
      <Header variant="site" />
      <main id="main-content" className="grow">
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          {/* The one soft light on the page, behind the hero only. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-[1100px] rounded-full bg-glow blur-3xl" />
          <TryIdea
            pool={pool}
            examples={EXAMPLES.map((row) => ({ label: t(row.short[0], row.short[1]), idea: t(row.ko, row.en) }))}
            head={(
              <>
                <h1 id="hero-heading" className="t-display mx-auto max-w-[14em]">
                  <span className="rise block">{t('만들기 전에,', 'Before you build,')}</span>
                  {/* The underline is the evidence colour: what people said is the evidence. */}
                  <span className="rise block" style={{ animationDelay: '80ms' }}><span className="underline decoration-seed/40 decoration-[0.08em] underline-offset-[0.14em]">{t('사람들의 말', 'hear what people said')}</span>{t('부터.', '.')}</span>
                </h1>
                <p className="rise t-lead mx-auto mb-10 mt-6 max-w-[32em]" style={{ animationDelay: '160ms' }}>{t('만들고 싶은 것을 한 줄 적으면, 개발자들이 실제로 쓴 글이 바로 아래에 뜹니다. 그 원문으로 PRD를 만들어 코딩 에이전트에 넘기세요.', 'Type one line about what you want to build and real developer posts appear right below. Turn them into a PRD for your coding agent.')}</p>
              </>
            )}
            note={(
              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span>{t('초안은 로그인 없이, PRD는 하루 10개까지 무료', 'Drafts need no account; 10 PRDs a day free')}</span>
                <Link href={sampleHref} className="font-semibold text-seed underline-offset-4 hover:underline">{t('PRD 예시 보기', 'See a sample PRD')}</Link>
              </p>
            )}
          />
        </section>

        {drifting.length > 0 && (
          <section className="rise pt-6" style={{ animationDelay: '520ms' }} aria-label={t('개발자들이 실제로 쓴 글', 'What developers actually wrote')}>
            <QuoteMarquee quotes={drifting} />
          </section>
        )}

        <section className="mx-auto w-full max-w-[1280px] px-5 pt-16 sm:px-6 md:px-8" aria-label={t('오늘의 숫자', 'Today in numbers')}>
          <dl className="reveal grid grid-cols-2 border-y border-outline-soft lg:grid-cols-4">
            {figures.map(([value, ko, en], index) => (
              <div key={ko} className={`flex flex-col-reverse px-1 py-6 sm:px-5 ${index % 2 ? 'border-l border-outline-soft' : ''} ${index >= 2 ? 'border-t border-outline-soft lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l' : ''}`}>
                <dt className="mt-2 text-[14px] text-muted">{t(ko, en)}</dt>
                <dd className={`num text-[clamp(32px,3.4vw,44px)] font-bold leading-none tracking-[-0.04em] ${index === 2 ? 'text-seed' : 'text-ink'}`}><CountUp value={value} /></dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13px] text-muted">{t(`${asOf} 분석 기준. 매일 아침 다시 셉니다.`, `As of ${asOf}. Counted again every morning.`)}</p>
        </section>

        <header id="features" className="section reveal scroll-mt-20 text-center">
          <p className="site-label">How it works</p>
          <h2 className="t-section mx-auto mt-3 max-w-[16em]">{t('불만 원문에서 에이전트까지, 네 단계', 'From a complaint to your agent, in four steps')}</h2>
        </header>

        <div className="pb-8 md:pb-16">
          <StepStory
            demo={DEMO_PRD}
            siteUrl={siteUrl}
            steps={[
              { id: 'step-signal', head: stepHead('01', 'Signal', t('같은 불만이 여러 곳에서 나오면 문제가 됩니다.', 'A complaint heard in several places becomes a problem.'), t('매일 아침 GitHub 이슈, Hacker News, Stack Overflow, 사용자 포럼을 읽고 같은 불만끼리 묶습니다.', 'Every morning Seedup reads GitHub issues, Hacker News, Stack Overflow and user forums, and groups the same complaint together.'), { href: '/newsletter-preview', text: t('인사이트 전체 보기', 'See all insights') }) },
              { id: 'step-evidence', head: stepHead('02', 'Evidence', t('AI가 뽑은 인용은 원문과 글자까지 대조합니다.', 'Every quote an AI picks is checked against the post, letter by letter.'), t('원문에 없는 문장은 여기서 떨어집니다. 남은 인용은 링크와 날짜를 달고, 원문 3건과 2곳을 넘어야 확인된 문제가 됩니다.', 'A sentence that is not in the post drops out here. What stays carries its link and date, and a problem counts only past 3 quotes from 2 sites.')) },
              { id: 'step-spec', head: stepHead('03', 'Spec', t('요구사항마다 어느 원문에서 나왔는지 붙습니다.', 'Every requirement says which quote it came from.'), t('요구사항, 기능, 화면이 사슬로 이어지고, 원문이 받쳐 주지 않는 줄은 가설로 떨어집니다. 옆은 실제로 만든 PRD입니다.', 'Requirements, features and screens link up in one chain, and any line no quote backs drops to a hypothesis. That is a PRD Seedup really made.'), { href: sampleHref, text: t('이 PRD 전체 보기', 'Open this PRD') }) },
              { id: 'step-agent', head: stepHead('04', 'Agent', t('기획서에서 끝나지 않습니다.', 'It doesn’t stop at the spec.'), t('Seedup은 MCP 서버입니다. Claude Code나 Cursor가 검증된 PRD를 직접 받아, 기능을 하나씩 만들고 끝난 기능을 표시합니다.', 'Seedup is an MCP server. Claude Code or Cursor pulls the verified PRD, builds it one feature at a time and marks each one done.'), { href: '/profile', text: t('MCP 연동하기', 'Connect your agent') }, <div className="mt-6 max-w-[34rem]"><CopyCommand command={`claude mcp add --transport http seedup ${siteUrl}/api/mcp`} /></div>) },
            ]}
          />
        </div>

        <section className="section reveal" aria-labelledby="principles-heading">
          <h2 id="principles-heading" className="t-section max-w-[18em]">{t('AI가 쓰고, 서버가 판정합니다.', 'The AI drafts. The server decides.')}</h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 border-t border-outline-soft pt-8 md:grid-cols-3">
            {PRINCIPLES.map(([ko, koBody, en, enBody]) => (
              <li key={ko}>
                <h3 className="text-[18px] font-semibold">{t(ko, en)}</h3>
                <p className="mt-2 text-[15px] leading-7 text-tertiary">{t(koBody, enBody)}</p>
              </li>
            ))}
          </ul>
        </section>

        {rows.length > 0 && (
          <section className="section reveal grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="record-heading">
            <div>
              <p className="site-label">Record</p>
              <h2 id="record-heading" className="t-section mt-3 text-[clamp(28px,3vw,40px)]">{t('도구가 나오기 전에 먼저 봤습니다.', 'We saw it before the tools shipped.')}</h2>
              <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-outline-soft py-6">
                <div><dt className="text-[14px] text-muted">{t('앞선 기간 (중간값)', 'Median lead')}</dt><dd className="num mt-1 text-[clamp(36px,3.6vw,52px)] font-bold leading-none tracking-[-0.04em] text-seed">{t(`${record.medianLeadDays}일`, `${record.medianLeadDays}d`)}</dd></div>
                <div><dt className="text-[14px] text-muted">{t('도구보다 먼저 본 문제', 'Seen before a tool')}</dt><dd className="num mt-1 text-[clamp(36px,3.6vw,52px)] font-bold leading-none tracking-[-0.04em]">{record.hits}<span className="text-[0.45em] font-semibold text-muted"> / {record.total}</span></dd></div>
              </dl>
              <p className="mt-4 text-[13px] leading-6 text-muted">{t(`Seedup이 가진 가장 이른 원문과, 그 뒤에 처음 나온 관련 도구 사이의 날짜를 ${asOf} 기준으로 셌습니다. 더 이른 원문이 있었을 수 있습니다.`, `Counted as of ${asOf} from the earliest quote Seedup holds to the first related tool after it. Earlier quotes may exist.`)}</p>
              <Link href="/opportunities" className="link-seed mt-2">{t('적중 기록 자세히', 'The full track record')}</Link>
            </div>
            <LeadChart rows={rows} names={names} lang={lang} />
          </section>
        )}

        <section className="section reveal grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="weekly-heading">
          <div className="min-w-0">
            <p className="site-label">Weekly</p>
            <h2 id="weekly-heading" className="t-section mt-3 text-[clamp(28px,3vw,40px)]">{t('월요일 아침, 읽을 것만.', 'Monday morning, only what matters.')}</h2>
            <p className="t-lead mt-4 max-w-[28em]">{t('기준을 통과한 문제와 이번 주에 움직인 문제, 관심 분야에 맞춘 읽을거리를 메일 한 통으로 보냅니다.', 'Problems that passed the bar, problems that moved this week, and reads picked for your interests, in one mail.')}</p>
            <div className="mt-8"><SubscribeForm lang={lang} /></div>
          </div>
          {issue && (
            <article className="frame min-w-0">
              <p className="frame-bar"><span className="text-seed">{t('Seedup 주간 신호', 'Seedup weekly signal')}</span><span className="ml-auto">{issueDay}</span></p>
              <div className="p-6 sm:p-7">
                <h3 className="text-[21px] font-bold leading-snug tracking-[-0.02em] [text-wrap:balance]">{issue.headline}</h3>
                {lead && (
                  <div className="mt-5 border-t border-outline-soft pt-5">
                    <p className="text-[13px] text-muted">{t('지금 근거가 가장 탄탄한 문제', 'The best-backed problem right now')}</p>
                    <Link href={`/opportunities/${lead.slug}`} className="mt-1 block text-[17px] font-semibold leading-snug underline-offset-4 hover:underline">{names[lead.slug] ?? lead.name}</Link>
                    {lead.quote && (
                      <blockquote className="mt-4 border-l-2 border-seed pl-4">
                        <p lang="en" className="text-[15px] leading-7">“{lead.quote.text}”</p>
                        <footer className="mt-1 text-[13px] text-muted">{lead.quote.source}</footer>
                      </blockquote>
                    )}
                  </div>
                )}
                <Link href="/newsletter-preview?view=issue" className="link-seed mt-4">{t('이번 호 전체 보기', 'Read the whole issue')}</Link>
                {lang === 'en' && <p className="mt-2 text-[13px] text-muted">Issues are written in Korean for now.</p>}
              </div>
            </article>
          )}
        </section>

        <section className="section-wide reveal relative pb-24 text-center md:pb-36" aria-labelledby="start-heading">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[320px] max-w-[760px] -translate-y-1/2 rounded-full bg-glow blur-3xl" />
          <div className="relative">
            <h2 id="start-heading" className="t-section mx-auto max-w-[16em]">{t('내 아이디어에는 어떤 원문이 있을까요?', 'What have developers said about your idea?')}</h2>
            <p className="t-lead mx-auto mt-4 max-w-[30em]">{t('한 줄이면 됩니다. 초안까지는 로그인도 필요 없습니다.', 'One line is enough. Drafts need no account.')}</p>
            <div className="mt-8"><StartAgain label={t('지금 시작하기', 'Start now')} /></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
