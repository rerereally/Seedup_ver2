'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import type { DemoPrd } from '@/lib/opportunities/demo-prd';
import { traceOf } from '@/lib/opportunities/spec';
import type { Spec } from '@/lib/opportunities/spec';
import { MIN_EVIDENCE, MIN_PLATFORMS, PLATFORM_LABELS } from '@/lib/opportunities/types';
import type { Platform } from '@/lib/opportunities/types';

const REDUCED = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (onChange: () => void) => {
  const media = window.matchMedia(REDUCED);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

const STEPS = [
  { key: 'collect', ko: '신호', en: 'Signals' },
  { key: 'verify', ko: '검증', en: 'Verify' },
  { key: 'spec', ko: 'PRD', en: 'PRD' },
  { key: 'agent', ko: '에이전트', en: 'Agent' },
] as const;

/**
 * The hero's live demo: one real PRD walked from the posts it came from to the agent that builds it. A step advances
 * when its progress bar's CSS animation ends, so hover, focus, the pause button and reduced motion all stop it the
 * same way: by not running that animation.
 */
export default function SignalToSpec({ demo, siteUrl, step: shown, onStep, progress }: { demo: DemoPrd; siteUrl: string; step?: number; onStep?: (step: number) => void; progress?: number }) {
  const lang = useLang();
  const t = translator(lang);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  // Opens on the PRD graph, the result; the walkthrough then plays on through the agent and back to the source posts.
  const [own, setStep] = useState(2);
  // The scroll story drives the step from outside; then nothing advances by itself.
  const auto = shown === undefined;
  const step = shown ?? own;
  // null until the reader presses play or pause: then it plays by itself, unless they asked for less motion.
  const [choice, setChoice] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const playing = choice ?? !reduced;

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pick = (next: number) => {
    const wrapped = (next + STEPS.length) % STEPS.length;
    if (onStep) return onStep(wrapped);
    setChoice(false);
    setStep(wrapped);
  };
  const running = playing && visible;
  const platforms = [...new Set(demo.evidence.map((row) => row.platform))];
  const where = platforms.map((platform) => PLATFORM_LABELS[platform]).join(t('와 ', ' and '));

  return (
    <figure ref={root} className="stage frame min-w-0" aria-label={t('실제 PRD 한 건이 원문에서 에이전트까지 이어지는 과정', 'One real PRD, from the posts it came from to the agent that builds it')}>
      <div className="flex min-h-14 items-center gap-3 border-b border-outline-soft px-4 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{t(demo.name.ko, demo.name.en)}</p>
        <span className="shrink-0 text-[13px] font-semibold text-seed">{t(`원문 ${demo.evidence.length}건, ${platforms.length}곳에서 확인`, `${demo.evidence.length} quotes from ${platforms.length} sites`)}</span>
        {auto && <button
          type="button"
          onClick={() => setChoice(!playing)}
          aria-label={playing ? t('자동 진행 멈추기', 'Pause the walkthrough') : t('자동 진행 다시 시작', 'Play the walkthrough')}
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-tertiary transition-colors hover:bg-surface-low hover:text-ink"
        >
          {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
        </button>}
      </div>

      <div
        role="tablist"
        aria-label={t('PRD가 만들어지는 단계', 'How the PRD is made')}
        className="grid grid-cols-4 border-b border-outline-soft"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const next = (step + (event.key === 'ArrowRight' ? 1 : -1) + STEPS.length) % STEPS.length;
            pick(next);
            document.getElementById(`${id}-tab-${next}`)?.focus();
          }
        }}
      >
        {STEPS.map((item, index) => {
          const on = index === step;
          return (
            <button
              key={item.key}
              id={`${id}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${id}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(index)}
              className={`relative h-12 text-[14px] transition-colors ${on ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
            >
              {t(item.ko, item.en)}
              {on && !auto && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-seed transition-transform duration-150" style={{ transform: `scaleX(${progress ?? 1})` }} />}
              {on && auto && (
                <span
                  key={step}
                  aria-hidden="true"
                  className={`stage-progress absolute inset-x-0 bottom-0 h-[2px] origin-left bg-seed ${running ? '' : 'is-held'}`}
                  onAnimationEnd={() => setStep((current) => (current + 1) % STEPS.length)}
                />
              )}
            </button>
          );
        })}
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${step}`} className={`min-h-[468px] overflow-hidden sm:h-[452px] sm:min-h-0 ${step === 3 ? 'bg-term-bg' : 'p-4 sm:p-5'}`}>
        {step === 0 && <Collect demo={demo} where={where} p={progress} />}
        {step === 1 && <Verify demo={demo} platforms={platforms.length} p={progress} />}
        {step === 2 && <Trace demo={demo} running={running && progress === undefined} p={progress} />}
        {step === 3 && <Agent demo={demo} siteUrl={siteUrl} p={progress} />}
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-outline-soft px-4 py-3 text-[13px] text-muted sm:px-5">
        <span>{t(`${formatDay(demo.madeAt, lang)}에 실제로 만든 PRD`, `A PRD Seedup really made, on ${formatDay(demo.madeAt, lang)}`)}</span>
        <Link href={`/prd?opportunity=${encodeURIComponent(demo.slug)}`} className="link-seed min-h-0">{t('이 PRD 전체 보기', 'Open this PRD')}</Link>
      </figcaption>
    </figure>
  );
}

// Scroll progress (0 to 1) shows the first `count * p` items; without it everything shows.
const upTo = (p: number | undefined, count: number) => (p === undefined ? count : Math.max(1, Math.ceil(p * count)));
// Driven by scroll, items fade in as they are reached; playing by itself, they enter in turn on mount.
const enter = (p: number | undefined, on: boolean) => (p === undefined ? 'stage-in' : `transition-[opacity,transform] duration-300 ${on ? '' : 'translate-y-1 opacity-0'}`);

const quotes = (n: number) => `${n} quote${n === 1 ? '' : 's'}`;
const formatDay = (day: string, lang: 'ko' | 'en') => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${day}T00:00:00Z`));
const formatMonth = (day: string, lang: 'ko' | 'en') => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'short' }).format(new Date(`${day}T00:00:00Z`));

/** Step 1: the posts, as they were found. */
// Where the engine reads every morning (lib/opportunities/actors.ts), in the order the labels are shown.
const SOURCES: Platform[] = ['hn', 'github', 'stackoverflow', 'devto', 'lobsters', 'stackexchange', 'forum'];

function Collect({ demo, where, p }: { demo: DemoPrd; where: string; p?: number }) {
  const lang = useLang();
  const t = translator(lang);
  const found = new Set(demo.evidence.map((row) => row.platform));
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5" aria-label={t('매일 읽는 곳', 'Read every morning')}>
        {SOURCES.map((platform, index) => (
          <li key={platform} className={`stage-in rounded-full px-2.5 py-1 text-[12.5px] ${found.has(platform) ? 'bg-seed-soft font-semibold text-seed' : 'bg-surface-mid text-muted'}`} style={{ animationDelay: `${index * 50}ms` }}>
            {platform === 'forum' ? t('사용자 포럼 11곳', '11 user forums') : PLATFORM_LABELS[platform]}
          </li>
        ))}
      </ul>
      <ol className="rows mt-4" aria-label={t(`${where}에서 같은 문제를 말한 글 ${demo.evidence.length}건`, `${demo.evidence.length} posts on ${where}, one problem`)}>
        {demo.evidence.map((row, index) => (
          <li key={row.id} className={`py-2.5 ${enter(p, index < upTo(p, demo.evidence.length))}`} style={{ animationDelay: `${index * 110}ms` }}>
            <p className="flex justify-between gap-3 text-[12.5px] text-muted">
              <span>{PLATFORM_LABELS[row.platform]}</span>
              <time dateTime={row.postedAt}>{formatMonth(row.postedAt, lang)}</time>
            </p>
            <p lang="en" className="mt-0.5 line-clamp-1 text-[14px] text-ink">“{row.quote}”</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Step 2: every quote matched against its source, and the bar it has to clear. */
function Verify({ demo, platforms, p }: { demo: DemoPrd; platforms: number; p?: number }) {
  const t = translator(useLang());
  const meters = [
    { label: t('원문', 'Quotes'), value: demo.evidence.length, bar: MIN_EVIDENCE },
    { label: t('플랫폼', 'Platforms'), value: platforms, bar: MIN_PLATFORMS },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {meters.map((meter) => (
          <div key={meter.label}>
            <p className="flex items-baseline justify-between text-[13px] text-muted">
              <span>{meter.label}</span>
              <span><b className="num text-[15px] font-semibold text-ink">{meter.value}</b>{t(` / 기준 ${meter.bar}`, ` / bar ${meter.bar}`)}</span>
            </p>
            <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-high">
              <span className="stage-fill block h-full origin-left rounded-full bg-seed" style={{ transform: `scaleX(${Math.min(1, meter.value / (meter.bar * 1.7)) * (p ?? 1)})`, transition: 'transform 150ms' }} />
            </span>
          </div>
        ))}
      </div>
      <ol className="mt-4 grid gap-1.5 border-t border-outline-soft pt-1">
        {demo.evidence.map((row, index) => (
          <li key={row.id} className={`flex items-start gap-2.5 border-b border-outline-soft py-2 last:border-b-0 ${enter(p, index < upTo(p, demo.evidence.length))}`} style={{ animationDelay: `${index * 140}ms` }}>
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-seed" strokeWidth={2.5} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[14px] text-ink">{t(row.quoteKo, row.quote)}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {t('원문과 글자 단위로 일치', 'Matches the source word for word')}
                {row.url && <> <a href={row.url} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-seed underline-offset-4 hover:underline">{t('원문', 'Source')}</a></>}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Graph geometry. Columns sit at fixed percentages of the width; rows at fixed pixel heights, so the lines can be
// drawn without measuring the DOM.
const COLS = [0, 29, 56, 82];
const COL_WS = [23, 21, 20, 18];
const ROW_H = 64;
const ROW_GAP = 6;
// Box text is cut in code, not with line-clamp, so no hidden overflow sits under the next box.
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const rowY = (index: number, count: number, most: number) => ((most - count) * (ROW_H + ROW_GAP)) / 2 + index * (ROW_H + ROW_GAP) + ROW_H / 2;

/**
 * Step 3: the PRD as a graph. One chain is always lit, so the claim reads at a glance: this quote, this requirement,
 * this feature, this screen. While the walkthrough plays the lit chain moves from requirement to requirement; pointing
 * at any box lights that box's chain instead.
 */
function Trace({ demo, running, p }: { demo: DemoPrd; running: boolean; p?: number }) {
  const lang = useLang();
  const t = translator(lang);
  const [hovered, setHovered] = useState<string | null>(null);
  const [auto, setAuto] = useState(1);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setAuto((index) => (index + 1) % demo.requirements.length), 1800);
    return () => window.clearInterval(timer);
  }, [running, demo.requirements.length]);
  const step = p === undefined ? auto : upTo(p, demo.requirements.length) - 1;
  const active = hovered ?? demo.requirements[step].id;
  const spec = useMemo(() => ({
    requirements: demo.requirements.map((row) => ({ id: row.id, title: row.title.ko, detail: '', evidence: row.evidence })),
    features: demo.features.map((row) => ({ id: row.id, title: row.title.ko, detail: '', requirementIds: row.requirementIds, slots: null })),
    screens: demo.screens.map((row) => ({ id: row.id, name: row.name.ko, does: '', featureIds: row.featureIds })),
  }) as unknown as Spec, [demo]);
  const trace = traceOf(spec, active);
  const lit = (nodeId: string) => trace.ids.has(nodeId) || (nodeId.startsWith('E-') && trace.evidence.has(Number(nodeId.slice(2))));
  // The caption shows the lit chain in words: its first quote in full and the requirement it backs.
  const shownQuote = Math.min(...trace.evidence);
  const quoteRow = demo.evidence[shownQuote - 1];
  const backed = demo.requirements.find((row) => trace.ids.has(row.id) && row.evidence.includes(shownQuote));

  const columns = [
    demo.evidence.map((row, index) => ({ id: `E-${index + 1}`, tag: `E${index + 1}`, sub: PLATFORM_LABELS[row.platform], text: clip(row.quote, 24), full: row.quote, en: true })),
    demo.requirements.map((row) => ({ id: row.id, tag: row.id, sub: t(`원문 ${row.evidence.length}`, quotes(row.evidence.length)), text: clip(t(row.title.ko, row.title.en), lang === 'en' ? 30 : 16), full: t(row.title.ko, row.title.en), en: false })),
    demo.features.map((row) => ({ id: row.id, tag: row.id, sub: '', text: clip(t(row.title.ko, row.title.en), lang === 'en' ? 30 : 16), full: t(row.title.ko, row.title.en), en: false })),
    demo.screens.map((row) => ({ id: row.id, tag: row.id, sub: '', text: clip(t(row.name.ko, row.name.en), lang === 'en' ? 26 : 14), full: t(row.name.ko, row.name.en), en: false })),
  ];
  const most = Math.max(...columns.map((column) => column.length));
  const height = most * (ROW_H + ROW_GAP) - ROW_GAP;
  const at = (col: number, nodeId: string) => rowY(columns[col].findIndex((node) => node.id === nodeId), columns[col].length, most);
  const edges = [
    ...demo.requirements.flatMap((row) => row.evidence.map((n) => ({ from: `E-${n}`, to: row.id, col: 0 }))),
    ...demo.features.flatMap((row) => row.requirementIds.map((rid) => ({ from: rid, to: row.id, col: 1 }))),
    ...demo.screens.flatMap((row) => row.featureIds.map((fid) => ({ from: fid, to: row.id, col: 2 }))),
  ];
  const hover = (nodeId: string | null) => () => setHovered(nodeId);

  return (
    <div>
      {/* Phones get the same chain as a list: each requirement with the quotes under it and the features over it. */}
      <ol className="rows sm:hidden">
        {demo.requirements.map((row, index) => (
          <li key={row.id} className="stage-in py-3" style={{ animationDelay: `${index * 90}ms` }}>
            <p className="text-[15px] font-semibold"><span className="mr-2 font-mono text-[13px] text-muted">{row.id}</span>{t(row.title.ko, row.title.en)}</p>
            <p className="mt-1.5 flex flex-wrap gap-1.5 text-[12.5px]">
              {row.evidence.map((n) => <span key={n} className="rounded-md bg-seed-soft px-1.5 py-0.5 font-medium text-seed">E{n}</span>)}
              {demo.features.filter((feature) => feature.requirementIds.includes(row.id)).map((feature) => <span key={feature.id} className="rounded-md bg-surface-mid px-1.5 py-0.5 text-tertiary">{feature.id}</span>)}
            </p>
          </li>
        ))}
      </ol>

      <div className="hidden sm:block">
        <div className="relative h-5 text-[12.5px] text-muted">
          {[t('원문', 'Quotes'), t('요구사항', 'Requirements'), t('기능', 'Features'), t('화면', 'Screens')].map((label, col) => <span key={label} className="absolute top-0" style={{ left: `${COLS[col]}%` }}>{label}</span>)}
        </div>
        <div className="relative mt-2" style={{ height }} onMouseLeave={hover(null)}>
          <svg aria-hidden="true" data-kind="diagram" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            {edges.map((edge, index) => {
              const x1 = COLS[edge.col] + COL_WS[edge.col];
              const x2 = COLS[edge.col + 1];
              const y1 = at(edge.col, edge.from);
              const y2 = at(edge.col + 1, edge.to);
              const mid = (x1 + x2) / 2;
              const on = lit(edge.from) && lit(edge.to);
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                  strokeWidth={on ? 1.75 : 1.1}
                  className={`stage-draw transition-opacity duration-300 ${on ? 'stroke-seed opacity-100' : 'stroke-outline-strong opacity-25'}`}
                  style={{ animationDelay: `${200 + edge.col * 260 + index * 12}ms` }}
                />
              );
            })}
          </svg>
          {columns.map((column, col) => column.map((node, index) => {
            const on = lit(node.id);
            const quote = col === 0;
            return (
              <button
                key={node.id}
                type="button"
                onMouseEnter={hover(node.id)}
                onFocus={hover(node.id)}
                onBlur={hover(null)}
                aria-pressed={active === node.id}
                aria-label={`${node.tag} ${node.full}`}
                className={`stage-in absolute flex flex-col justify-center overflow-hidden rounded-[10px] border px-2 text-left transition-opacity duration-200 ${on ? 'border-seed bg-seed-soft opacity-100' : 'border-outline-soft bg-white opacity-40'}`}
                style={{ left: `${COLS[col]}%`, width: `${COL_WS[col]}%`, top: rowY(index, column.length, most) - ROW_H / 2, height: ROW_H, animationDelay: `${col * 260 + index * 50}ms` }}
              >
                <span className="flex items-baseline gap-1.5 text-[12px]">
                  <span className={`font-mono font-semibold ${quote ? 'text-seed' : 'text-muted'}`}>{node.tag}</span>
                  {node.sub && <span className="truncate text-muted">{node.sub}</span>}
                </span>
                <span lang={node.en ? 'en' : undefined} className="mt-0.5 text-[12.5px] leading-[1.35] text-ink">{node.en ? `“${node.text}”` : node.text}</span>
              </button>
            );
          }))}
        </div>
        {quoteRow && backed && (
          <p className="mt-3 min-h-10 text-[13px] leading-5 text-muted" aria-live="polite">
            <span className="font-mono font-semibold text-seed">E{shownQuote}</span> <span lang="en" className="text-ink">“{quoteRow.quote}”</span>
            <span className="mx-1.5" aria-hidden="true">→</span>
            <span className="font-mono font-semibold text-ink">{backed.id}</span> {t(backed.title.ko, backed.title.en)}
          </p>
        )}
      </div>
    </div>
  );
}

/** Step 4: what the coding agent sees over MCP: the PRD, saved as AGENTS.md, then the checklist, one feature at a time. */
function Agent({ demo, siteUrl, p }: { demo: DemoPrd; siteUrl: string; p?: number }) {
  const t = translator(useLang());
  const [first] = demo.features;
  type Line = { kind: 'cmd' | 'ask' | 'tool' | 'row' | 'note' | 'gap'; text: string; meta?: string; seed?: boolean };
  const lines: Line[] = [
    { kind: 'cmd', text: `claude mcp add --transport http seedup ${siteUrl}/api/mcp` },
    { kind: 'ask', text: t(`"${demo.name.ko}" PRD로 ${first.id}부터 만들어 줘`, `Build ${first.id} from the "${demo.name.en}" PRD`) },
    { kind: 'gap', text: '' },
    { kind: 'tool', text: 'seedup.generate_verified_prd', meta: demo.slug },
    ...demo.requirements.map((row): Line => ({ kind: 'row', text: `${row.id}  ${t(row.title.ko, row.title.en)}`, meta: t(`원문 ${row.evidence.length}`, quotes(row.evidence.length)) })),
    { kind: 'note', text: t(`AGENTS.md 저장: 요구사항 ${demo.requirements.length}, 기능 ${demo.features.length}, 화면 ${demo.screens.length}`, `Saved AGENTS.md: ${demo.requirements.length} requirements, ${demo.features.length} features, ${demo.screens.length} screens`) },
    { kind: 'gap', text: '' },
    { kind: 'tool', text: 'seedup.get_build_checklist' },
    ...demo.features.map((row, index): Line => ({ kind: 'row', text: `${row.id}  ${t(row.title.ko, row.title.en)}`, meta: index === 0 ? t('지금 만들 기능', 'building now') : row.requirementIds.join(' '), seed: index === 0 })),
    { kind: 'gap', text: '' },
    { kind: 'tool', text: 'seedup.mark_feature_done', meta: t(`${first.id} 완료, 진행 1/${demo.features.length}`, `${first.id} done, 1 of ${demo.features.length}`), seed: true },
  ];
  return (
    <div className="h-full overflow-hidden px-4 py-4 font-mono text-[12.5px] leading-[1.7] text-term-ink sm:px-5">
      {lines.map((line, index) => line.kind === 'gap'
        ? <div key={`gap-${index}`} aria-hidden="true" className="h-2.5" />
        : (
          <p key={`${line.kind}-${index}`} className={`flex min-w-0 gap-3 ${enter(p, index < upTo(p, lines.length))}`} style={{ animationDelay: `${index * 150}ms` }}>
            <span className="line-clamp-1 min-w-0 flex-1 break-all">
              {line.kind === 'cmd' && <span className="text-term-muted">$ </span>}
              {line.kind === 'ask' && <span className="text-term-muted">&gt; </span>}
              <span className={line.kind === 'tool' ? 'text-term-seed' : line.kind === 'row' ? 'pl-4' : line.kind === 'note' ? 'pl-4 text-term-muted' : ''}>{line.text}</span>
            </span>
            {line.meta && <span className={`shrink-0 ${line.seed ? 'text-term-seed' : 'text-term-muted'}`}>{line.meta}</span>}
          </p>
        ))}
    </div>
  );
}
