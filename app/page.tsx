import Link from 'next/link';
import { redirect } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getNewsItems } from '@/lib/data';
import { getOpportunities, summarizeFunnel } from '@/lib/opportunities/data';
import { MIN_EVIDENCE, MIN_PLATFORMS, PLATFORM_LABELS } from '@/lib/opportunities/types';
import { cached } from '@/lib/cache';
import { samplePrdSlug } from '@/lib/opportunities/prd-cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const STEPS = [
  ['01 발견', '매일 신호를 골라 매주 보냅니다.', '뉴스, 논문, 오픈소스, 개발자 커뮤니티에서 오늘 읽을 글을 고릅니다.'],
  ['02 검증', '실제 개발자의 말로 확인합니다.', `인용은 원문과 글자 단위로 맞아야 남고, 원문 ${MIN_EVIDENCE}건·플랫폼 ${MIN_PLATFORMS}곳을 넘어야 기회가 됩니다.`],
  ['03 설계', '근거가 붙은 PRD로 키웁니다.', '요구사항, 기능, 화면까지 이어지고 원문 없는 줄은 가설로 표시합니다.'],
  ['04 구현', '코딩 에이전트가 이어서 만듭니다.', 'MCP로 Claude Code, Cursor가 PRD를 직접 가져가거나 AGENTS.md로 내보냅니다.'],
];

// The hero picture: one worked example of a quote becoming a requirement, a feature and a screen.
type Node = { x: number; y: number; w: number; h: number; tag: string; lines: string[]; kind?: 'quote' | 'guess' };
const NODES: Node[] = [
  { x: 60, y: 40, w: 225, h: 92, tag: 'E1 · Hacker News', lines: ['“every time I wanted to try a', 'different LLM provider, I had to', 'rewrite…”'], kind: 'quote' },
  { x: 60, y: 152, w: 225, h: 74, tag: 'E2 · Hacker News', lines: ['“What is your AI harness that lets', 'you switch LLM models easily?”'], kind: 'quote' },
  { x: 60, y: 270, w: 225, h: 74, tag: 'E3 · Stack Overflow', lines: ['“Amazon Bedrock does not provide', 'an API that returns…”'], kind: 'quote' },
  { x: 345, y: 62, w: 215, h: 54, tag: 'R1 · 원문 3', lines: ['어느 제공사든 같은 요청 형식'] },
  { x: 345, y: 170, w: 215, h: 54, tag: 'R2 · 원문 1', lines: ['설정 한 줄로 모델 전환'] },
  { x: 345, y: 297, w: 215, h: 56, tag: 'H1 · 가설', lines: ['쓸 수 있는 모델 목록'], kind: 'guess' },
  { x: 615, y: 62, w: 195, h: 54, tag: 'F1', lines: ['통합 요청 스키마'] },
  { x: 615, y: 170, w: 195, h: 54, tag: 'F2', lines: ['모델 전환 설정'] },
  { x: 615, y: 297, w: 195, h: 56, tag: 'F3 · 가설', lines: ['제공사 탐색 API'], kind: 'guess' },
  { x: 870, y: 100, w: 165, h: 54, tag: 'S1', lines: ['플레이그라운드'] },
  { x: 870, y: 230, w: 165, h: 54, tag: 'S2', lines: ['제공사 설정'] },
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
const GREEN = '#1f6b4a';

function TraceExample() {
  return (
    <svg viewBox="0 0 1100 380" className="block w-full min-w-[760px]" role="img" aria-label="예시: 개발자 원문 세 건이 요구사항, 기능, 화면으로 이어지고, 원문이 없는 줄은 점선 가설로 남습니다.">
      {['개발자 원문', '요구사항', '기능', '화면'].map((label, index) => (
        <text key={label} x={[60, 345, 615, 870][index]} y={18} fontSize="11" fill="#6b6b72">{label}</text>
      ))}
      {EDGES.map(([d, kind]) => (
        <path key={d} d={d} fill="none" stroke={kind === 'seed' ? GREEN : '#b4b4bb'} strokeWidth={kind === 'seed' ? 1.5 : 1.2} strokeDasharray={kind === 'guess' ? '4 4' : undefined} />
      ))}
      {NODES.map((node) => (
        <g key={node.tag}>
          <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="9" fill="#fff" stroke={node.kind === 'quote' ? GREEN : node.kind === 'guess' ? '#a1a1a8' : '#e4e4e7'} strokeWidth={node.kind === 'quote' ? 1.6 : 1} strokeDasharray={node.kind === 'guess' ? '4 3' : undefined} />
          <text x={node.x + 12} y={node.y + 20} fontSize="10.5" fontWeight="600" fill={node.kind === 'quote' ? GREEN : '#6b6b72'}>{node.tag}</text>
          {node.lines.map((line, index) => (
            <text key={line} x={node.x + 12} y={node.y + 39 + index * 18} fontSize="12.5" fill={node.kind === 'quote' || !node.kind ? '#151517' : '#6b6b72'}>{line}</text>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Subscribing needs an account, so the address is handed to the sign-in page as the Google account hint, and the note says so. */
function SubscribeForm({ label, onGreen = false }: { label: string; onGreen?: boolean }) {
  return (
    <form action="/login" className="mx-auto flex w-full max-w-[520px] flex-col gap-2.5 sm:flex-row sm:flex-wrap">
      <input type="hidden" name="next" value="/newsletter-preview" />
      <input type="email" name="email" required autoComplete="email" aria-label="이메일 주소" placeholder="이메일 주소" className="h-[52px] min-w-0 flex-1 border bg-white px-4 text-base text-ink placeholder:text-muted" />
      <button type="submit" className={`h-[52px] shrink-0 rounded-[10px] px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 ${onGreen ? 'bg-ink' : 'bg-seed'}`}>{label}</button>
      <p className={`basis-full text-center text-[13px] ${onGreen ? 'text-white/75' : 'text-muted'}`}>이 주소의 Google 계정으로 로그인하면 구독이 끝납니다.</p>
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
  const monthYear = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' });

  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <section className="page-shell !pb-0 pt-16 text-center md:pt-24">
          <p className={kicker}>개발자를 위한 신호 큐레이션 · 매주 월요일 발행</p>
          <h1 className="mt-5 text-[clamp(40px,7vw,84px)] font-bold leading-[1.08] tracking-[-0.045em] [text-wrap:balance]">작은 신호를,<br />만들 가치가 있는 제품으로.</h1>
          <p className="mx-auto mt-7 max-w-[34em] text-[clamp(17px,1.6vw,20px)] leading-[1.7] text-tertiary">매일 개발자 커뮤니티와 논문, 오픈소스에서 신호를 고르고, 실제 개발자의 말로 검증한 뒤, 근거가 붙은 PRD로 키워 코딩 에이전트에 넘깁니다.</p>
          <div className="mt-9"><SubscribeForm label="주간 신호 구독" /></div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            <Link href="/prd/new" className="link-seed">내 아이디어로 PRD 만들기 ›</Link>
            <Link href={sample ? `/prd?opportunity=${encodeURIComponent(sample)}` : '/prd'} className="link-seed">예시 PRD 둘러보기 ›</Link>
          </p>

          <figure className="mx-auto mt-16 max-w-[1100px] text-left">
            <div className="card overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.07)]">
              <div className="flex items-center gap-6 overflow-x-auto border-b border-outline-soft px-6 text-[13px] text-muted">
                <span className="shrink-0 py-4 font-semibold text-ink">제공사별 모델 스키마 차이</span>
                <span className="shrink-0">PRD</span>
                <span className="-mb-px shrink-0 border-b-2 border-ink py-4 font-semibold text-ink">기능 명세</span>
                <span className="shrink-0">와이어프레임</span>
                <span className="ml-auto shrink-0 font-medium text-seed">기준 통과</span>
              </div>
              <div className="overflow-x-auto px-2 py-4"><TraceExample /></div>
            </div>
            <p className="mt-3 text-center text-[13px] text-muted sm:hidden">옆으로 밀면 화면까지 이어진 전체 그림이 보입니다.</p>
            <figcaption className="mt-6 text-center text-[13px] text-muted">모든 기능은 왼쪽의 개발자 원문에서 출발합니다. 원문이 없는 줄은 점선, 가설로 남습니다.</figcaption>
          </figure>
        </section>

        <section className="page-shell pt-24 md:pt-36" aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-center text-[clamp(30px,4.4vw,56px)] font-bold tracking-[-0.04em]">씨앗은 네 단계로 자랍니다.</h2>
          <ol className="mt-14 grid gap-x-8 gap-y-10 border-t border-outline-soft pt-9 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([step, title, body]) => (
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
            <p className={kicker}>발견</p>
            <h2 className={h2}>월요일 아침,<br />읽을 것만 남겨 둡니다.</h2>
            <p className={lead}>관심 분야에 맞춰 고른 글과, 지켜보는 문제가 이번 주에 어떻게 움직였는지를 한 통의 메일로 받습니다.</p>
            <Link href="/news" className="link-seed mt-5">오늘의 신호 보기 ›</Link>
          </div>
          <div className="card p-7 shadow-[0_20px_60px_rgba(0,0,0,.06)] sm:p-9">
            <p className="text-[13px] text-muted">Seedup 주간 신호</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">{passed ? '이번 주, 기준을 통과한 문제가 있습니다.' : '이번 주에 움직인 문제와 읽을거리입니다.'}</p>
            <ul className="mt-5 divide-y divide-outline-soft border-t border-outline-soft text-[15px]">
              {passed && <li className="flex items-baseline justify-between gap-4 py-3.5"><span className="min-w-0 truncate">{passed.name}</span><span className="shrink-0 text-sm font-medium text-seed">기준 통과</span></li>}
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
                <p className="mt-1.5 text-[13px] text-muted">{[quote.problem, PLATFORM_LABELS[quote.platform], quote.postedAt ? monthYear.format(new Date(quote.postedAt)) : null, '원문과 일치'].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
          <div>
            <p className={kicker}>검증</p>
            <h2 className={h2}>요약이 아니라,<br />그 사람의 말 그대로.</h2>
            <p className={lead}>모델이 찾은 인용은 원문과 한 글자라도 다르면 버려집니다. 그렇게 걸러 남은 인용이 지금 {funnel.quotes}건입니다.</p>
            <Link href="/opportunities" className="link-seed mt-5">기회 보기 ›</Link>
          </div>
        </section>

        <section className="page-shell grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div>
            <p className={kicker}>구현</p>
            <h2 className={h2}>기획서에서 멈추지 않고,<br />코드까지.</h2>
            <p className={lead}>Seedup은 MCP 서버로 동작합니다. 코딩 에이전트가 검증된 PRD를 직접 불러와 첫 기능부터 만듭니다.</p>
            <Link href="/profile" className="link-seed mt-5">에이전트 연결하기 ›</Link>
          </div>
          <pre className="terminal"><code>
            <span className="text-[#8b8b94]">$ </span>claude mcp add --transport http seedup {siteUrl}/api/mcp{'\n\n'}
            <span className="text-[#8b8b94]">&gt; </span>&quot;제공사별 모델 스키마 차이&quot; PRD로 F1부터 만들어 줘{'\n\n'}
            <span className="text-[#7fd1a6]">seedup.generate_verified_prd</span>{'\n'}
            {'  R1 어느 제공사든 같은 요청 형식   원문 3\n'}
            {'  R2 설정 한 줄로 모델 전환         원문 1\n'}
            <span className="text-[#8b8b94]">{'  H1 쓸 수 있는 모델 목록          가설'}</span>
          </code></pre>
        </section>

        <section className="page-shell text-center" aria-labelledby="numbers-heading">
          <h2 id="numbers-heading" className="text-[clamp(30px,4.4vw,56px)] font-bold tracking-[-0.04em]">많이 읽고, 적게 남깁니다.</h2>
          <dl className="mt-12 grid gap-10 sm:grid-cols-3">
            {([['원문과 일치한 인용', funnel.quotes, false], ['묶인 문제', funnel.problems, false], ['기준을 통과한 기회', funnel.qualified, true]] as const).map(([label, value, green]) => (
              <div key={label}>
                <dt className="text-[15px] text-muted">{label}</dt>
                <dd className={`mt-4 text-[clamp(48px,6vw,72px)] font-bold leading-none tracking-[-0.04em] ${green ? 'text-seed' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="page-shell">
          <div className="rounded-[28px] bg-seed px-6 py-16 text-center text-white md:py-20">
            <h2 className="text-[clamp(32px,4.6vw,56px)] font-bold leading-[1.15] tracking-[-0.04em]">매주 월요일,<br />자랄 신호만.</h2>
            <div className="mt-9"><SubscribeForm label="구독하기" onGreen /></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
