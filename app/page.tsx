import Link from 'next/link';
import { redirect } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getNewsItems } from '@/lib/data';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { getOpportunities, summarizeFunnel } from '@/lib/opportunities/data';
import { trackRecord, trackRecordSummary } from '@/lib/opportunities/insight';
import { MIN_EVIDENCE, MIN_PLATFORMS, PLATFORM_LABELS } from '@/lib/opportunities/types';
import { cached } from '@/lib/cache';
import { samplePrdSlug } from '@/lib/opportunities/prd-cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const STEPS = (t: ReturnType<typeof translator>) => [
  [t('01 발견', '01 Find'), t('매일 신호를 골라 매주 보냅니다.', 'Signals picked daily, sent weekly.'), t('뉴스, 논문, 오픈소스, 개발자 커뮤니티에서 오늘 읽을 글을 고릅니다.', 'Reads from news, papers, open source and developer communities.')],
  [t('02 검증', '02 Verify'), t('실제 개발자의 말로 확인합니다.', 'Checked against what developers actually wrote.'), t(`인용은 원문과 글자 단위로 맞아야 남고, 원문 ${MIN_EVIDENCE}건·플랫폼 ${MIN_PLATFORMS}곳을 넘어야 기회가 됩니다.`, `A quote stays only if it matches the source word for word; ${MIN_EVIDENCE} quotes on ${MIN_PLATFORMS} platforms make an opportunity.`)],
  [t('03 설계', '03 Design'), t('근거가 붙은 PRD로 키웁니다.', 'Grown into an evidence-traced PRD.'), t('요구사항, 기능, 화면까지 이어지고 원문 없는 줄은 가설로 표시합니다.', 'Requirements, features and screens stay linked; lines no quote backs are marked as hypotheses.')],
  [t('04 구현', '04 Build'), t('코딩 에이전트가 이어서 만듭니다.', 'A coding agent builds it.'), t('MCP로 Claude Code, Cursor가 PRD를 직접 가져가거나 AGENTS.md로 내보냅니다.', 'Claude Code or Cursor pull the PRD over MCP, or take it as AGENTS.md.')],
];

// The hero picture: one worked example of a quote becoming a requirement, a feature and a screen.
type Node = { x: number; y: number; w: number; h: number; tag: string; lines: string[]; kind?: 'quote' | 'guess'; en?: { tag?: string; lines?: string[] } };
const NODES: Node[] = [
  { x: 60, y: 40, w: 225, h: 92, tag: 'E1 · Hacker News', lines: ['“every time I wanted to try a', 'different LLM provider, I had to', 'rewrite…”'], kind: 'quote' },
  { x: 60, y: 152, w: 225, h: 74, tag: 'E2 · Hacker News', lines: ['“What is your AI harness that lets', 'you switch LLM models easily?”'], kind: 'quote' },
  { x: 60, y: 270, w: 225, h: 74, tag: 'E3 · Stack Overflow', lines: ['“Amazon Bedrock does not provide', 'an API that returns…”'], kind: 'quote' },
  { x: 345, y: 62, w: 215, h: 54, tag: 'R1 · 원문 3', lines: ['어느 제공사든 같은 요청 형식'], en: { tag: 'R1 · 3 quotes', lines: ['One request format for any provider'] } },
  { x: 345, y: 170, w: 215, h: 54, tag: 'R2 · 원문 1', lines: ['설정 한 줄로 모델 전환'], en: { tag: 'R2 · 1 quote', lines: ['Switch models in one line'] } },
  { x: 345, y: 297, w: 215, h: 56, tag: 'H1 · 가설', lines: ['쓸 수 있는 모델 목록'], kind: 'guess', en: { tag: 'H1 · hypothesis', lines: ['List of usable models'] } },
  { x: 615, y: 62, w: 195, h: 54, tag: 'F1', lines: ['통합 요청 스키마'], en: { lines: ['Unified request schema'] } },
  { x: 615, y: 170, w: 195, h: 54, tag: 'F2', lines: ['모델 전환 설정'], en: { lines: ['Model switch setting'] } },
  { x: 615, y: 297, w: 195, h: 56, tag: 'F3 · 가설', lines: ['제공사 탐색 API'], kind: 'guess', en: { tag: 'F3 · hypothesis', lines: ['Provider discovery API'] } },
  { x: 870, y: 100, w: 165, h: 54, tag: 'S1', lines: ['플레이그라운드'], en: { lines: ['Playground'] } },
  { x: 870, y: 230, w: 165, h: 54, tag: 'S2', lines: ['제공사 설정'], en: { lines: ['Provider settings'] } },
];
const EDGES: Array<[string, 'seed' | 'line' | 'guess']> = [
  ['M285 86H345', 'seed'],
  ['M285 190C318 190 312 96 345 96', 'seed'],
  ['M285 197H345', 'seed'],
  ['M285 307C322 307 308 104 345 104', 'seed'],
  ['M560 89H615', 'line'],
  ['M560 197H615', 'line'],
  ['M560 325H615', 'guess'],
  ['M810 89C842 89 838 127 870 127', 'line'],
  ['M810 197C842 197 838 127 870 127', 'line'],
  ['M810 197C842 197 838 257 870 257', 'line'],
  ['M810 325C848 325 836 264 870 264', 'guess'],
];
// Colours come from theme tokens (Tailwind fill-/stroke- classes), so the picture follows dark mode.

function TraceExample({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const en = lang === 'en';
  return (
    <svg viewBox="0 0 1100 380" className="block w-full min-w-[760px]" role="img" aria-label={t('예시: 개발자 원문 세 건이 요구사항, 기능, 화면으로 이어지고, 원문이 없는 줄은 점선 가설로 남습니다.', 'Example: three developer quotes lead to requirements, features and screens; lines with no quote stay dashed hypotheses.')}>
      {[t('개발자 원문', 'Developer quotes'), t('요구사항', 'Requirements'), t('기능', 'Features'), t('화면', 'Screens')].map((label, index) => (
        <text key={label} x={[60, 345, 615, 870][index]} y={18} fontSize="11" className="fill-muted">{label}</text>
      ))}
      {EDGES.map(([d, kind]) => (
        <path key={d} d={d} fill="none" className={kind === 'seed' ? 'stroke-seed' : 'stroke-outline-strong'} strokeWidth={kind === 'seed' ? 1.5 : 1.2} strokeDasharray={kind === 'guess' ? '4 4' : undefined} />
      ))}
      {NODES.map((node) => (
        <g key={node.tag}>
          <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="9" className={`fill-white ${node.kind === 'quote' ? 'stroke-seed' : node.kind === 'guess' ? 'stroke-outline-strong' : 'stroke-outline-soft'}`} strokeWidth={node.kind === 'quote' ? 1.6 : 1} strokeDasharray={node.kind === 'guess' ? '4 3' : undefined} />
          <text x={node.x + 12} y={node.y + 20} fontSize="10.5" fontWeight="600" className={node.kind === 'quote' ? 'fill-seed' : 'fill-muted'}>{(en && node.en?.tag) || node.tag}</text>
          {((en && node.en?.lines) || node.lines).map((line, index) => (
            <text key={line} x={node.x + 12} y={node.y + 39 + index * 18} fontSize="12.5" className={node.kind === 'quote' || !node.kind ? 'fill-ink' : 'fill-muted'}>{line}</text>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Subscribing needs an account, so the address is handed to the sign-in page as the Google account hint, and the note says so. */
function SubscribeForm({ label, onGreen = false, lang }: { label: string; onGreen?: boolean; lang: Lang }) {
  const t = translator(lang);
  return (
    <form action="/login" className="mx-auto flex w-full max-w-[520px] flex-col gap-2.5 sm:flex-row sm:flex-wrap">
      <input type="hidden" name="next" value="/newsletter-preview" />
      <input type="email" name="email" required autoComplete="email" aria-label={t('이메일 주소', 'Email address')} placeholder={t('이메일 주소', 'Email address')} className="h-[52px] min-w-0 flex-1 border bg-white px-4 text-base text-ink placeholder:text-muted" />
      <button type="submit" className={`h-[52px] shrink-0 rounded-[10px] px-6 text-base font-semibold transition-opacity hover:opacity-90 ${onGreen ? 'bg-ink text-white' : 'bg-seed text-on-seed'}`}>{label}</button>
      <p className={`basis-full text-center text-[13px] ${onGreen ? 'text-on-deep/75' : 'text-muted'}`}>{t('이 주소의 Google 계정으로 로그인하면 구독이 끝납니다.', 'Sign in with the Google account for this address to finish subscribing.')}</p>
    </form>
  );
}

const kicker = 'text-sm font-semibold text-seed';
const h2 = 'mt-3 text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.15] tracking-[-0.035em] [text-wrap:balance]';
const lead = 'mt-5 max-w-[26em] text-[17px] leading-8 text-tertiary';

export default async function Home() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  // Signed-in readers start from today's feed; this page is the front door.
  if (user) redirect('/news');
  const lang = await getLang();
  const t = translator(lang);

  const [{ opportunities }, news] = await Promise.all([getOpportunities(), getNewsItems()]);
  // The hero picture shows the schema problem, so its saved PRD is the first choice for the example link.
  const candidates = opportunities.filter((item) => item.qualified).sort((a, b) => Number(b.slug === 'llm-provider-schema-normalization') - Number(a.slug === 'llm-provider-schema-normalization'));
  const sample = await cached('sample-prd', () => samplePrdSlug(createAdminClient(), candidates), 10 * 60_000).catch(() => null);
  const funnel = summarizeFunnel(opportunities);
  const ranked = [...opportunities].sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.evidence.length - a.evidence.length);
  const passed = ranked.find((item) => item.qualified);
  // One readable sentence per problem: no shouting, no fragments cut off mid-sentence.
  const readable = (text: string) => text.length >= 40 && text.length <= 220 && text !== text.toUpperCase() && !/[:,]$/.test(text.trim());
  const quotes = ranked.flatMap((item) => item.evidence.filter((row) => readable(row.quote)).slice(0, 1).map((row) => ({ ...row, problem: item.name }))).slice(0, 2);
  const reads = news.filter((item) => Boolean(item.content?.trim())).sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0)).slice(0, 2);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com').replace(/\/+$/, '');
  const monthYear = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'long' });
  // Computed from stored dates every time: a problem counts when a related tool appeared after its earliest quote.
  const record = trackRecordSummary(trackRecord(opportunities), opportunities.length);

  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <section className="page-shell !pb-0 pt-16 text-center md:pt-24">
          <p className={kicker}>{t('개발자를 위한 신호 큐레이션 · 매주 월요일 발행', 'Signal curation for developers · every Monday')}</p>
          <h1 className="mt-5 text-[clamp(40px,7vw,84px)] font-bold leading-[1.08] tracking-[-0.045em] [text-wrap:balance]">{t('작은 신호를,', 'Small signals,')}<br />{t('만들 가치가 있는 제품으로.', 'grown into products worth building.')}</h1>
          <p className="mx-auto mt-7 max-w-[34em] text-[clamp(17px,1.6vw,20px)] leading-[1.7] text-tertiary">{t('매일 개발자 커뮤니티와 논문, 오픈소스에서 신호를 고르고, 실제 개발자의 말로 검증한 뒤, 근거가 붙은 PRD로 키워 코딩 에이전트에 넘깁니다.', 'Every day we pick signals from developer communities, papers and open source, verify them against what developers actually wrote, and grow them into evidence-traced PRDs your coding agent can build from.')}</p>
          <div className="mt-9"><SubscribeForm label={t('주간 신호 구독', 'Get the weekly signal')} lang={lang} /></div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            <Link href="/prd/new" className="link-seed">{t('내 아이디어로 PRD 만들기', 'Make a PRD from my idea')} ›</Link>
            <Link href={sample ? `/prd?opportunity=${encodeURIComponent(sample)}` : '/prd'} className="link-seed">{t('예시 PRD 둘러보기', 'See an example PRD')} ›</Link>
          </p>

          <figure className="mx-auto mt-16 max-w-[1100px] text-left">
            <div className="card overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.07)]">
              <div className="flex items-center gap-6 overflow-x-auto border-b border-outline-soft px-6 text-[13px] text-muted">
                <span className="shrink-0 py-4 font-semibold text-ink">{t('제공사별 모델 스키마 차이', 'Model schemas differ by provider')}</span>
                <span className="shrink-0">PRD</span>
                <span className="-mb-px shrink-0 border-b-2 border-ink py-4 font-semibold text-ink">{t('기능 명세', 'Feature spec')}</span>
                <span className="shrink-0">{t('와이어프레임', 'Wireframes')}</span>
                <span className="ml-auto shrink-0 font-medium text-seed">{t('기준 통과', 'Verified')}</span>
              </div>
              <div className="overflow-x-auto px-2 py-4"><TraceExample lang={lang} /></div>
            </div>
            <p className="mt-3 text-center text-[13px] text-muted sm:hidden">{t('옆으로 밀면 화면까지 이어진 전체 그림이 보입니다.', 'Swipe sideways to see the whole chain.')}</p>
            <figcaption className="mt-6 text-center text-[13px] text-muted">{t('모든 기능은 왼쪽의 개발자 원문에서 출발합니다. 원문이 없는 줄은 점선, 가설로 남습니다.', 'Every feature starts from a developer quote on the left. Lines with no quote stay dashed, as hypotheses.')}</figcaption>
          </figure>
        </section>

        <section className="page-shell pt-24 md:pt-36" aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-center text-[clamp(30px,4.4vw,56px)] font-bold tracking-[-0.04em]">{t('씨앗은 네 단계로 자랍니다.', 'A seed grows in four steps.')}</h2>
          <ol className="mt-14 grid gap-x-8 gap-y-10 border-t border-outline-soft pt-9 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS(t).map(([step, title, body]) => (
              <li key={step}>
                <p className={kicker}>{step}</p>
                <p className="mt-3 text-xl font-semibold tracking-tight">{title}</p>
                <p className="mt-3 text-[15px] leading-7 text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="page-shell grid items-center gap-x-16 gap-y-10 lg:grid-cols-2">
          <div>
            <p className={kicker}>{t('발견', 'Find')}</p>
            <h2 className={h2}>{t('월요일 아침,', 'Monday morning,')}<br />{t('읽을 것만 남겨 둡니다.', 'only what is worth reading.')}</h2>
            <p className={lead}>{t('관심 분야에 맞춰 고른 글과, 지켜보는 문제가 이번 주에 어떻게 움직였는지를 한 통의 메일로 받습니다.', 'Reads picked for your interests, and how the problems you watch moved this week, in one mail.')}</p>
            <Link href="/news" className="link-seed mt-5">{t('오늘의 신호 보기', 'See today’s signals')} ›</Link>
          </div>
          <div className="card p-7 shadow-[0_20px_60px_rgba(0,0,0,.06)] sm:p-9">
            <p className="text-[13px] text-muted">{t('Seedup 주간 신호', 'Seedup weekly signal')}</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">{passed ? t('이번 주, 기준을 통과한 문제가 있습니다.', 'A problem passed the bar this week.') : t('이번 주에 움직인 문제와 읽을거리입니다.', 'Problems that moved and reads for this week.')}</p>
            <ul className="mt-5 divide-y divide-outline-soft border-t border-outline-soft text-[15px]">
              {passed && <li className="flex items-baseline justify-between gap-4 py-3.5"><span className="min-w-0 truncate">{passed.name}</span><span className="shrink-0 text-sm font-medium text-seed">{t('기준 통과', 'Verified')}</span></li>}
              {reads.map((item) => (
                <li key={item.id} className="py-3.5">
                  <p className="line-clamp-1">{item.title}</p>
                  <p className="mt-1 text-[13px] text-muted">{[item.category, item.source].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="page-shell grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <ul className="order-last grid gap-7 lg:order-none">
            {quotes.map((quote) => (
              <li key={quote.id} className="border-l-2 border-seed pl-5">
                <p lang="en" className="text-xl leading-8">“{quote.quote}”</p>
                <p className="mt-1.5 text-[13px] text-muted">{[quote.problem, PLATFORM_LABELS[quote.platform], quote.postedAt ? monthYear.format(new Date(quote.postedAt)) : null, t('원문과 일치', 'verbatim')].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
          <div>
            <p className={kicker}>{t('검증', 'Verify')}</p>
            <h2 className={h2}>{t('요약이 아니라,', 'Not a summary,')}<br />{t('그 사람의 말 그대로.', 'their own words.')}</h2>
            <p className={lead}>{t(`모델이 찾은 인용은 원문과 한 글자라도 다르면 버려집니다. 그렇게 걸러 남은 인용이 지금 ${funnel.quotes}건입니다.`, `A quote the model finds is dropped if a single character differs from the source. ${funnel.quotes} quotes have survived that check.`)}</p>
            <Link href="/opportunities" className="link-seed mt-5">{t('기회 보기', 'See opportunities')} ›</Link>
          </div>
        </section>

        <section className="page-shell grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div>
            <p className={kicker}>{t('구현', 'Build')}</p>
            <h2 className={h2}>{t('기획서에서 멈추지 않고,', 'Not stopping at the spec,')}<br />{t('코드까지.', 'all the way to code.')}</h2>
            <p className={lead}>{t('Seedup은 MCP 서버로 동작합니다. 코딩 에이전트가 검증된 PRD를 직접 불러와 첫 기능부터 만듭니다.', 'Seedup is an MCP server. Your coding agent pulls the verified PRD and builds it, first feature first.')}</p>
            <Link href="/profile" className="link-seed mt-5">{t('에이전트 연결하기', 'Connect your agent')} ›</Link>
          </div>
          <pre className="terminal"><code>
            <span className="text-[#8b8b94]">$ </span>claude mcp add --transport http seedup {siteUrl}/api/mcp{'\n\n'}
            <span className="text-[#8b8b94]">&gt; </span>{t('"제공사별 모델 스키마 차이" PRD로 F1부터 만들어 줘', 'Build F1 from the "model schemas differ by provider" PRD')}{'\n\n'}
            <span className="text-[#7fd1a6]">seedup.generate_verified_prd</span>{'\n'}
            {'  R1 어느 제공사든 같은 요청 형식   원문 3\n'}
            {'  R2 설정 한 줄로 모델 전환         원문 1\n'}
            <span className="text-[#8b8b94]">{'  H1 쓸 수 있는 모델 목록          가설'}</span>
          </code></pre>
        </section>

        <section className="page-shell text-center" aria-labelledby="numbers-heading">
          <h2 id="numbers-heading" className="text-[clamp(30px,4.4vw,56px)] font-bold tracking-[-0.04em]">{t('많이 읽고, 적게 남기고, 먼저 봅니다.', 'Read a lot, keep little, see it first.')}</h2>
          <dl className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {([
              [t('원문과 일치한 인용', 'Verbatim quotes'), String(funnel.quotes), false],
              [t('기준을 통과한 기회', 'Verified opportunities'), String(funnel.qualified), false],
              [t('도구보다 먼저 짚은 문제', 'Problems seen before a tool'), `${record.rate}%`, true],
              [t('앞선 기간 (중간값)', 'Lead time (median)'), t(`${record.medianLeadDays}일`, `${record.medianLeadDays} days`), true],
            ] as const).map(([label, value, green]) => (
              <div key={label}>
                <dt className="text-[15px] text-muted">{label}</dt>
                <dd className={`mt-4 text-[clamp(48px,6vw,72px)] font-bold leading-none tracking-[-0.04em] ${green ? 'text-seed' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mx-auto mt-8 max-w-[44em] text-[13px] leading-6 text-muted">{t(`문제 ${record.total}개 중 ${record.hits}개는 Seedup이 가진 가장 이른 원문 뒤에 관련 도구가 나왔습니다(도구 ${record.tools}개, 가장 길게 ${record.maxLeadDays}일 앞섬). 더 이른 원문이 있었을 수 있어, 실제로 앞선 기간은 이보다 길 수 있습니다.`, `For ${record.hits} of ${record.total} problems, a related tool appeared after the earliest quote Seedup holds (${record.tools} tools, up to ${record.maxLeadDays} days later). Earlier quotes may exist, so the real lead can be longer.`)}</p>
          <Link href="/opportunities" className="link-seed mt-3">{t('적중 기록 자세히', 'See the track record')} ›</Link>
        </section>

        <section className="page-shell">
          <div className="rounded-[28px] bg-seed-deep px-6 py-16 text-center text-on-deep md:py-20">
            <h2 className="text-[clamp(32px,4.6vw,56px)] font-bold leading-[1.15] tracking-[-0.04em]">{t('매주 월요일,', 'Every Monday,')}<br />{t('자랄 신호만.', 'only the signals that grow.')}</h2>
            <div className="mt-9"><SubscribeForm label={t('구독하기', 'Subscribe')} onGreen lang={lang} /></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
