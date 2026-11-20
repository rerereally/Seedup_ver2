'use client';

// The standalone parts of the PRD screen: the feature-spec graph lines, the wireframes and the live writing view.
// They read only their props, so they live apart from PrdBuilder's state.
import { useRef, useState, useMemo, useLayoutEffect } from 'react';
import MarkdownContent from '@/components/MarkdownContent';
import AgentCursor, { type CursorTarget } from './AgentCursor';
import type { LivePhase, LiveStep } from '@/lib/opportunities/live-steps';
import { translator } from '@/lib/i18n';
import styles from './stage.module.css';
import type { Spec, SpecFeature, traceOf } from '@/lib/opportunities/spec';

type Trace = ReturnType<typeof traceOf>;

/** Lines between the columns of the feature spec, measured from the rendered boxes so they follow every resize. */
export function GraphEdges({ spec, evidenceCount, trace }: { spec: Spec; evidenceCount: number; trace: Trace | null }) {
  // The graph box is this svg's parent: a parent's ref is not attached yet when a child's layout effect runs.
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<Array<{ key: string; d: string; from: string; to: string; quote: boolean; guess: boolean }>>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const links = useMemo(() => {
    const hypotheses = new Set(spec.hypotheses.map((row) => row.id));
    return [
      ...spec.requirements.flatMap((row) => row.evidence.filter((n) => n <= evidenceCount).map((n) => ({ from: `E-${n}`, to: row.id, quote: true, guess: false }))),
      ...spec.features.flatMap((row) => row.requirementIds.map((rid) => ({ from: rid, to: row.id, quote: false, guess: hypotheses.has(rid) }))),
      ...spec.screens.flatMap((row) => row.featureIds.map((fid) => ({ from: fid, to: row.id, quote: false, guess: false }))),
    ];
  }, [spec, evidenceCount]);

  useLayoutEffect(() => {
    const box = svgRef.current?.parentElement;
    if (!box) return;
    const measure = () => {
      const origin = box.getBoundingClientRect();
      const rect = (id: string) => box.querySelector<HTMLElement>(`[data-node="${id}"]`)?.getBoundingClientRect();
      setPaths(links.flatMap((link) => {
        const a = rect(link.from);
        const b = rect(link.to);
        // On a narrow screen the columns stack; a line drawn backwards would only add noise.
        if (!a || !b || b.left <= a.right) return [];
        const x1 = a.right - origin.left + box.scrollLeft;
        const y1 = a.top + a.height / 2 - origin.top + box.scrollTop;
        const x2 = b.left - origin.left + box.scrollLeft;
        const y2 = b.top + b.height / 2 - origin.top + box.scrollTop;
        const mid = (x1 + x2) / 2;
        return [{ ...link, key: `${link.from}>${link.to}`, d: `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}` }];
      }));
      setSize({ w: box.scrollWidth, h: box.scrollHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [links]);

  const lit = (from: string, to: string) => (from.startsWith('E-') ? trace!.evidence.has(Number(from.slice(2))) : trace!.ids.has(from)) && trace!.ids.has(to);
  return (
    <svg ref={svgRef} aria-hidden="true" className={styles.specEdges} width={size.w} height={size.h}>
      {paths.map((path) => {
        const on = trace ? lit(path.from, path.to) : null;
        return <path key={path.key} d={path.d} fill="none" className={path.quote ? 'stroke-seed' : 'stroke-outline-strong'} strokeWidth={on ? 2.2 : 1.3} strokeDasharray={path.guess ? '4 4' : undefined} opacity={on === false ? 0.12 : 1} />;
      })}
    </svg>
  );
}

/** Lo-fi screens built from the spec: one numbered box per feature, each tracing back to its requirements and quotes. */
export function Wireframes({ spec, focus, pick, lang }: { spec: Spec; focus: string | null; pick: (id: string) => void; lang: 'ko' | 'en' }) {
  const t = translator(lang);
  const [current, setCurrent] = useState(spec.screens[0]?.id ?? '');
  const screen = spec.screens.find((row) => row.id === current) ?? spec.screens[0];
  if (!screen) return <p className="text-[15px] leading-7 text-muted">{t('정해진 화면이 없습니다. 수정 요청으로 화면을 추가해 보세요.', 'No screens yet. Ask for screens in a change request.')}</p>;

  const features = screen.featureIds.flatMap((id) => spec.features.find((row) => row.id === id) ?? []);
  const quotesOf = (feature: SpecFeature) => [...new Set(spec.requirements.filter((row) => feature.requirementIds.includes(row.id)).flatMap((row) => row.evidence))].sort((a, b) => a - b);
  return (
    <div>
      <div className="tabs" role="tablist" aria-label={t('화면', 'Screens')}>
        {spec.screens.map((row) => (
          <button key={row.id} type="button" role="tab" aria-selected={row.id === screen.id} className="tab" onClick={() => setCurrent(row.id)}>
            <span className="text-xs font-medium text-muted">{row.id}</span>{row.name}
          </button>
        ))}
      </div>
      {screen.does && <p className="mt-4 text-[15px] leading-7 text-tertiary">{screen.does}</p>}

      <div className={styles.wireFrame}>
        <div className={styles.wireBar} aria-hidden="true"><span>{screen.id}</span><span>{screen.name}</span></div>
        <div className={styles.wireBody}>
          <div className={styles.wireNav} aria-hidden="true"><i className={styles.wireLogo} /><i style={{ width: '16%' }} /><i style={{ width: '10%' }} /><i style={{ width: '10%' }} /></div>
          <div className={styles.wireGrid}>
            {features.map((feature, index) => (
              <button key={feature.id} type="button" aria-pressed={focus === feature.id} onClick={() => pick(feature.id)} className={`${styles.wireBlock} ${quotesOf(feature).length ? '' : styles.wireGuess}`}>
                <span className={styles.wirePin}>{index + 1}</span>
                <span className={styles.wireTitle}>{feature.title}</span>
                <i style={{ width: '88%' }} /><i style={{ width: '66%' }} />
                {index === 0 && <i className={styles.wireAction} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ol className="rows mt-6">
        {features.map((feature, index) => {
          const quotes = quotesOf(feature);
          return (
            <li key={feature.id}>
              <button type="button" onClick={() => pick(feature.id)} aria-pressed={focus === feature.id} className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 py-3.5 text-left text-[15px] leading-6 aria-pressed:bg-seed-soft">
                <span className={`${styles.wirePinStatic} ${quotes.length ? '' : styles.wirePinGuess}`}>{index + 1}</span>
                <span className="min-w-0">
                  <b className="font-semibold">{feature.title}</b>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
                    <span>{feature.id}</span>
                    <span>{t(`${feature.requirementIds.join(', ')} 충족`, `serves ${feature.requirementIds.join(', ')}`)}</span>
                    {quotes.length ? <span className="font-medium text-seed">{t('원문', 'Quotes')} {quotes.map((n) => `E${n}`).join(', ')}</span> : <span>{t('가설, 원문 없음', 'Hypothesis, no quote')}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[13px] text-muted">{t('번호를 누르면 그 기능의 명세가 오른쪽에 열립니다. 점선 상자는 원문이 받쳐 주지 않는 가설 기능입니다.', 'Click a number to open that feature on the right. Dashed boxes are features no quote backs.')}</p>
    </div>
  );
}

export type { LivePhase, LiveStep } from '@/lib/opportunities/live-steps';
export { liveStepsAfter } from '@/lib/opportunities/live-steps';

const PHASES: Record<LivePhase, [string, string]> = {
  waiting: ['모델에 연결하는 중', 'Connecting to the model'],
  thinking: ['모델이 쓰기 전에 생각하는 중', 'The model is thinking before it writes'],
  writing: ['PRD를 쓰는 중', 'Writing the PRD'],
  structuring: ['문서를 요구사항과 기능으로 나누는 중', 'Splitting the document into requirements and features'],
  checking: ['빠진 곳을 검사하고 보완하는 중', 'Checking for gaps and repairing'],
  auditing: ['P0 요구사항의 원문 근거를 대조하는 중', 'Auditing P0 requirements against cited quotes'],
  completing: ['P0 기능의 개발 준비 항목과 화면을 채우는 중', 'Filling readiness details and screens for P0 features'],
};

// The few words on the working pointer beside the document.
const CURSOR_LABELS: Record<LivePhase, [string, string]> = {
  waiting: ['연결 중', 'Connecting'],
  thinking: ['생각하는 중', 'Thinking'],
  writing: ['쓰는 중', 'Writing'],
  structuring: ['나누는 중', 'Structuring'],
  checking: ['점검 중', 'Checking'],
  auditing: ['근거 대조 중', 'Auditing'],
  completing: ['채우는 중', 'Completing'],
};

/**
 * What the reader sees while the PRD is made: the real step the server reports, and the document itself as the model
 * writes it. A generator that does not stream (live is null) shows only the step and the time.
 */
export function LivePrd({ live, elapsed, lang, title }: { live: { text: string; phase: LivePhase; restarted: boolean; steps?: LiveStep[] } | null; elapsed: number; lang: 'ko' | 'en'; title?: string }) {
  const t = translator(lang);
  const phase = live?.phase ?? 'writing';
  const page = useRef<HTMLDivElement>(null);
  const [showSteps, setShowSteps] = useState(false);
  const steps = live?.steps ?? [];
  // Before any text it waits where writing starts; while writing it rests on the newest section; the later steps go to
  // the section they work on (requirements for structuring and the evidence audit, features for the gap check).
  const target: CursorTarget = !live?.text || phase === 'waiting' || phase === 'thinking' ? { kind: 'first' }
    : phase === 'writing' ? { kind: 'latest' }
    : { kind: 'match', pattern: phase === 'checking' || phase === 'completing' ? /기능|Features/ : /요구사항|Requirements/ };
  const cursor = <AgentCursor rootRef={page} target={target} label={`Seedup · ${t(CURSOR_LABELS[phase][0], CURSOR_LABELS[phase][1])}`} tick={live?.text.length ?? 0} />;
  return (
    <div className="rise-in max-w-[52em]" role="status" aria-live="polite" aria-busy="true">
      {/* The title stays where the draft had it, so starting to write does not move the page. */}
      {title && <h2 className="mb-5 text-2xl font-bold tracking-tight">{title}</h2>}
      <div className="flex items-baseline justify-between gap-4 rounded-xl border border-outline-soft bg-white px-4 py-3">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-seed motion-reduce:animate-none" />
          {t(PHASES[phase][0], PHASES[phase][1])}
        </p>
        <div className="flex items-baseline gap-3">
          {steps.length > 0 && (
            <button type="button" className="text-[13px] font-semibold text-seed underline-offset-4 hover:underline" aria-expanded={showSteps} aria-controls="prd-live-steps" onClick={() => setShowSteps((open) => !open)}>
              {showSteps ? t('단계 숨기기', 'Hide steps') : t(`단계 보기 (${steps.length})`, `Show steps (${steps.length})`)}
            </button>
          )}
          <p className="num text-sm text-muted">{elapsed}{t('초', 's')}</p>
        </div>
      </div>
      {showSteps && steps.length > 0 && (
        <ol id="prd-live-steps" className="mt-2 grid gap-1.5 rounded-xl border border-outline-soft bg-white px-4 py-3 text-[13px]">
          {steps.map((step, index) => {
            const current = index === steps.length - 1;
            const took = (current ? elapsed : steps[index + 1].at) - step.at;
            const label = step.kind === 'phase' ? t(PHASES[step.phase][0], PHASES[step.phase][1])
              : step.kind === 'section' ? t(`"${step.title}" 쓰기`, `Writing "${step.title}"`)
              : t('첫 모델이 답하지 않아 다른 모델로 다시 시작', 'The first model did not answer; starting again with another');
            return (
              <li key={`${step.kind}${index}`} className={`flex items-baseline gap-2 ${step.kind === 'section' ? 'pl-5' : ''} ${current ? 'font-semibold text-ink' : 'text-tertiary'}`}>
                <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full ${current ? 'animate-pulse bg-seed motion-reduce:animate-none' : 'bg-outline-strong'}`} />
                <span className="min-w-0 flex-1">{label}{current && <span className="sr-only">{t(' (진행 중)', ' (in progress)')}</span>}</span>
                <span className="num shrink-0 text-muted">{Math.max(0, took)}{t('초', 's')}</span>
              </li>
            );
          })}
        </ol>
      )}
      {live?.restarted && <p className="mt-2 text-[13px] text-muted">{t('첫 모델이 답하지 않아 다른 모델로 다시 쓰고 있습니다.', 'The first model did not answer, so another one is writing it again.')}</p>}
      {live?.text ? (
        <div ref={page} className="relative mt-4 rounded-2xl border border-outline-soft bg-white px-5 py-4 [&_.article-markdown]:text-[15px]">
          {cursor}
          {/* The renderer knows ## and ### only; the PRD opens with "# 한 줄 요약". */}
          <MarkdownContent content={live.text.replace(/^# /gm, '## ')} />
        </div>
      ) : (
        <>
          <p className="mt-3 text-[13px] text-muted">{phase === 'thinking' ? t('무료 모델은 쓰기 전에 잠시 생각합니다. 글이 나오기 시작하면 여기에 바로 보입니다.', 'Free models think for a while before writing. The text shows up here as soon as it starts.') : t('곧 문서가 여기에 쓰이기 시작합니다.', 'The document will start appearing here shortly.')}</p>
          {/* The outline of what is coming, in the place the text will fill, instead of an empty page. */}
          <div ref={page} aria-hidden="true" className="relative mt-4 rounded-2xl border border-outline-soft bg-white px-5 py-5">
            {cursor}
            {[t('한 줄 요약', 'Summary'), t('배경', 'Background'), t('요구사항', 'Requirements'), t('기능', 'Features')].map((heading) => (
              <div key={heading} className="mb-5 last:mb-0">
                <p data-cursor-stop className="text-[15px] font-semibold text-muted">{heading}</p>
                <div className="mt-2.5 h-3 w-full animate-pulse rounded bg-surface-mid motion-reduce:animate-none" />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-surface-mid motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
