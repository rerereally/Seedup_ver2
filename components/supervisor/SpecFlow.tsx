'use client';

import { useMemo, useState } from 'react';
import { GraphEdges, Wireframes } from '@/components/opportunity-stage/PrdParts';
import styles from '@/components/opportunity-stage/stage.module.css';
import { translator, type Lang } from '@/lib/i18n';
import type { BuildProgress } from '@/lib/opportunities/build-progress';
import { traceOf, type Spec } from '@/lib/opportunities/spec';

type View = 'trace' | 'flow' | 'wire' | 'tree';
const VIEWS: Array<[View, string, string]> = [['trace', '기능 명세', 'Feature spec'], ['flow', '유저플로우', 'User flow'], ['wire', '와이어프레임', 'Wireframe'], ['tree', '구조 트리', 'IA tree']];
const DONE = new Set(['done']);
const WORKING = new Set(['in_progress', 'improving', 'needs_recheck']);

/**
 * The PRD's own views (the ones generate_verified_prd hands the agent), read-only on the supervisor page: quotes →
 * requirements → features → screens, the screen flow, wireframes and the tree. Features carry their build status.
 */
export default function SpecFlow({ spec, quotes, progress, lang }: { spec: Spec; quotes: Array<{ quote: string; platform: string }>; progress: BuildProgress; lang: Lang }) {
  const t = translator(lang);
  const [view, setView] = useState<View>('trace');
  const [focus, setFocus] = useState<string | null>(null);
  const trace = useMemo(() => (focus ? traceOf(spec, focus) : null), [spec, focus]);
  const tone = (id: string) => (!trace ? '' : trace.ids.has(id) ? styles.specOn : styles.specDim);
  const pick = (id: string) => setFocus((current) => (current === id ? null : id));
  const mark = (featureId: string) => {
    const status = progress[featureId]?.status;
    return status && DONE.has(status) ? ' ✓' : status && WORKING.has(status) ? ` · ${t('작업 중', 'in progress')}` : '';
  };
  const item = (id: string, body: React.ReactNode, className = '') => (
    <button key={id} type="button" data-node={id} className={`${styles.specItem} ${tone(id)} ${className}`} aria-pressed={focus === id} onClick={() => pick(id)}>
      <span className={styles.specId}>{id}</span>{body}
    </button>
  );

  return <section className="min-w-0" aria-labelledby="flow-heading">
    <h2 id="flow-heading" className="text-xl font-semibold text-ink">{t('PRD 흐름', 'PRD flow')}</h2>
    <p className="mt-2 text-[13px] text-muted">{t('generate_verified_prd가 에이전트에게 주는 명세를 그림으로 봅니다. 항목을 누르면 이어진 원문 · 요구사항 · 기능 · 화면이 강조됩니다.', 'The spec generate_verified_prd hands the agent, drawn. Pick an item to light up what it connects to.')}</p>
    <div className="tabs mt-4" role="tablist" aria-label={t('흐름 보기', 'Flow views')}>
      {VIEWS.map(([key, ko, en]) => <button key={key} type="button" role="tab" aria-selected={view === key} className="tab" onClick={() => setView(key)}>{t(ko, en)}</button>)}
    </div>
    <div className="mt-5">
      {view === 'trace' && <div className={styles.specCols}>
        <GraphEdges spec={spec} evidenceCount={quotes.length} trace={trace} />
        <div className={styles.specCol}>
          <h4>{t('원문', 'Quotes')}</h4>
          {quotes.map((row, index) => item(`E-${index + 1}`, <q lang="en">{row.quote.length > 140 ? `${row.quote.slice(0, 140)}…` : row.quote}</q>, styles.specQuote))}
        </div>
        <div className={styles.specCol}>
          <h4>{t('요구사항', 'Requirements')}</h4>
          {spec.requirements.map((row) => item(row.id, <><span>{row.title}</span><small>{row.evidence.map((n) => `E-${n}`).join(', ')}</small></>))}
          {spec.hypotheses.map((row) => item(row.id, <><span>{row.title}</span><small>{t('가설', 'Hypothesis')}</small></>, styles.specHypo))}
        </div>
        <div className={styles.specCol}>
          <h4>{t('기능', 'Features')}</h4>
          {spec.features.map((row) => item(row.id, <><span>{row.title}{mark(row.id)}</span><small>{row.requirementIds.join(', ')}</small></>))}
        </div>
        <div className={styles.specCol}>
          <h4>{t('화면', 'Screens')}</h4>
          {spec.screens.map((row) => item(row.id, <><span>{row.name}</span><small>{row.featureIds.join(', ')}</small></>))}
        </div>
      </div>}
      {(view === 'flow' || view === 'wire') && !spec.screens.length && <p className="text-sm text-muted">{t('이 PRD에는 화면이 없습니다.', 'This PRD has no screens.')}</p>}
      {view === 'flow' && spec.screens.length > 0 && <ol className={styles.flow}>
        {spec.screens.map((screen) => <li key={screen.id}><span className={styles.specId}>{screen.id}</span><span className="font-medium">{screen.name}</span>{screen.does && <small>{screen.does}</small>}</li>)}
      </ol>}
      {view === 'wire' && spec.screens.length > 0 && <Wireframes spec={spec} focus={focus} pick={pick} lang={lang} />}
      {view === 'tree' && <ul className={styles.specTree}>
        {[...spec.requirements, ...spec.hypotheses].map((requirement) => <li key={requirement.id}>
          <span className={styles.specId}>{requirement.id}</span> <b className="font-semibold">{requirement.title}</b>
          <ul>{spec.features.filter((feature) => feature.requirementIds.includes(requirement.id)).map((feature) => <li key={feature.id}>
            <span className={styles.specId}>{feature.id}</span> {feature.title}{mark(feature.id)}
            <ul>{spec.screens.filter((screen) => screen.featureIds.includes(feature.id)).map((screen) => <li key={screen.id}><span className={styles.specId}>{screen.id}</span> {screen.name}</li>)}</ul>
          </li>)}</ul>
        </li>)}
      </ul>}
    </div>
  </section>;
}
