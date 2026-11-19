'use client';

import { useEffect, useState } from 'react';
import ScrapButton from '@/components/ScrapButton';
import { findScrap } from '@/lib/db/scraps';
import { createClient } from '@/lib/supabase/client';

export type RecentIdea = {
  id: string;
  idea_text: string;
  status: string;
  score: number | null;
  result: unknown;
};

type ScoreBreakdown = Partial<Record<'feasibility' | 'differentiation' | 'market' | 'portfolio' | 'mvp_clarity', number>>;
type RecommendedTechnology = { name: string; category: 'required' | 'optional' | 'scale'; reason: string };
type EvaluationRisk = { title: string; severity: 'high' | 'medium' | 'low'; impact: string; mitigation: string };
type EvaluationNextStep = { order: number; title: string; description: string; deliverable: string; done_when: string };
type EvaluationScoreReason = { positive: string[]; deductions: string[]; evidence: string[] };
type EvaluationMvpScope = { team_size: string; duration_weeks: number; core_user_flow: string; excluded_scope: string[] };

export type IdeaEvaluationResult = {
  score: number;
  verdict: string;
  portfolio_value: string;
  difficulty: string;
  market_fit: string;
  recommended_stack: string[];
  risks: string[];
  next_steps: string[];
  score_breakdown?: ScoreBreakdown;
  strengths?: string[];
  weaknesses?: string[];
  recommended_technologies?: RecommendedTechnology[];
  structured_risks?: EvaluationRisk[];
  structured_next_steps?: EvaluationNextStep[];
  confidence?: { level: 'high' | 'medium' | 'low'; reason: string };
  missing_data?: string[];
  user_stated?: string[];
  inferred_assumptions?: string[];
  mvp_scope?: EvaluationMvpScope;
  score_reasons?: Partial<Record<'feasibility' | 'differentiation' | 'market' | 'portfolio' | 'mvp_clarity', EvaluationScoreReason>>;
  references?: Array<{
    source_table: string;
    source_id?: string;
    content: string;
    similarity: number;
    metadata: { title?: string; url?: string | null; source?: string | null };
  }>;
};

export type EvaluationRun = {
  id: string | null;
  idea: string;
  saved: boolean;
  result: IdeaEvaluationResult;
};

export function normalizeEvaluation(value: unknown): IdeaEvaluationResult {
  const result = value && typeof value === 'object' ? value as Partial<IdeaEvaluationResult> : {};
  const legacyStack = Array.isArray(result.recommended_stack) ? result.recommended_stack.filter((item): item is string => typeof item === 'string') : [];
  const legacyRisks = Array.isArray(result.risks) ? result.risks.filter((item): item is string => typeof item === 'string') : [];
  const legacySteps = Array.isArray(result.next_steps) ? result.next_steps.filter((item): item is string => typeof item === 'string') : [];
  const technologies = Array.isArray(result.recommended_technologies) ? result.recommended_technologies.filter((item): item is RecommendedTechnology => Boolean(item && typeof item.name === 'string')) : legacyStack.map((name) => ({ name, category: 'required' as const, reason: 'MVP 구현에 사용할 핵심 기술입니다.' }));
  const risks = Array.isArray(result.structured_risks) ? result.structured_risks.filter((item): item is EvaluationRisk => Boolean(item && typeof item.title === 'string')) : legacyRisks.map((title, index) => ({ title, severity: index === 0 ? 'high' as const : 'medium' as const, impact: '구현과 검증 과정에서 추가 확인이 필요합니다.', mitigation: '작은 실험으로 위험을 먼저 검증합니다.' }));
  const steps = Array.isArray(result.structured_next_steps) ? result.structured_next_steps.filter((item): item is EvaluationNextStep => Boolean(item && typeof item.title === 'string')) : legacySteps.map((title, index) => ({ order: index + 1, title, description: title, deliverable: '작동하는 작은 결과물', done_when: '핵심 흐름을 한 번 실행할 수 있음' }));

  return {
    score: typeof result.score === 'number' ? result.score : 0,
    verdict: result.verdict ?? '평가 결과를 확인해주세요.',
    portfolio_value: result.portfolio_value ?? '평가 데이터가 없습니다.',
    difficulty: result.difficulty ?? '평가 데이터 없음',
    market_fit: result.market_fit ?? '평가 데이터가 없습니다.',
    recommended_stack: legacyStack,
    risks: legacyRisks,
    next_steps: legacySteps,
    score_breakdown: result.score_breakdown,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    recommended_technologies: technologies,
    structured_risks: risks,
    structured_next_steps: steps,
    confidence: result.confidence,
    missing_data: result.missing_data,
    user_stated: Array.isArray(result.user_stated) ? result.user_stated.filter((item): item is string => typeof item === 'string') : [],
    inferred_assumptions: Array.isArray(result.inferred_assumptions) ? result.inferred_assumptions.filter((item): item is string => typeof item === 'string') : [],
    mvp_scope: result.mvp_scope && typeof result.mvp_scope === 'object' ? result.mvp_scope as EvaluationMvpScope : undefined,
    score_reasons: result.score_reasons && typeof result.score_reasons === 'object' ? result.score_reasons : {},
    references: Array.isArray(result.references) ? result.references : [],
  };
}

export function EvaluationPanel({ run }: { run: EvaluationRun }) {
  const evaluation = run.result;
  // Whether this evaluation is already in 북마크; keyed by id so a different run never shows a stale answer.
  const [scrap, setScrap] = useState<{ id: string; saved: boolean } | null>(null);
  useEffect(() => {
    const supabase = run.id ? createClient() : null;
    if (!run.id || !supabase) return;
    let live = true;
    const id = run.id;
    void findScrap(supabase, null, 'idea', id)
      .then(({ data }) => { if (live) setScrap({ id, saved: Boolean(data) }); });
    return () => { live = false; };
  }, [run.id]);
  const scrapSaved = run.id && scrap?.id === run.id ? scrap.saved : null;
  const scoreItems = [
    ['구현 가능성', evaluation.score_breakdown?.feasibility],
    ['차별성', evaluation.score_breakdown?.differentiation],
    ['시장성', evaluation.score_breakdown?.market],
    ['포트폴리오', evaluation.score_breakdown?.portfolio],
    ['MVP 명확성', evaluation.score_breakdown?.mvp_clarity],
  ].filter(([, value]) => typeof value === 'number') as Array<[string, number]>;
  const technologies = evaluation.recommended_technologies ?? [];
  const risks = evaluation.structured_risks ?? [];
  const nextSteps = evaluation.structured_next_steps ?? [];
  const scoreReasonLabels: Record<string, string> = { feasibility: '구현 가능성', differentiation: '차별성', market: '시장성', portfolio: '포트폴리오', mvp_clarity: 'MVP 명확성' };

  const severityLabel = { high: '높음', medium: '보통', low: '낮음' } as const;
  const confidenceLabel = evaluation.confidence ? severityLabel[evaluation.confidence.level] ?? evaluation.confidence.level : null;
  const techGroups = ([['required', 'MVP에 필요'], ['optional', '있으면 좋음'], ['scale', '커진 뒤에']] as const)
    .map(([category, label]) => ({ label, items: technologies.filter((item) => item.category === category) }))
    .filter((group) => group.items.length);

  return (
    <div className="divide-y divide-outline-soft [&>section]:py-7 [&>section:first-child]:pt-0 [&>section:last-child]:pb-0">
      <section>
        <p className="label">판정</p>
        <h2 className="mt-1 text-2xl font-bold leading-snug tracking-tight text-ink">{evaluation.verdict}</h2>
        <dl className="mt-5 grid grid-cols-3 gap-4 border-y border-outline-soft py-4">
          <div><dt className="label">종합 점수</dt><dd className="mt-1 text-xl font-bold text-ink">{evaluation.score} / 100</dd></div>
          <div><dt className="label">구현 난이도</dt><dd className="mt-1 text-xl font-bold text-ink">{evaluation.difficulty}</dd></div>
          <div><dt className="label">평가 신뢰도</dt><dd className="mt-1 text-xl font-bold text-ink">{confidenceLabel ?? '–'}</dd></div>
        </dl>
        <blockquote className="mt-5 border-l-2 border-seed pl-4">
          <p className="text-[15px] leading-7 text-ink">“{run.idea}”</p>
          <footer className="mt-1 text-[13px] text-muted">검증한 아이디어</footer>
        </blockquote>
        {run.id && scrapSaved !== null && (
          <div className="mt-5">
            <ScrapButton key={run.id} itemType="idea" itemId={run.id} title={run.idea.trim().slice(0, 80)} initialSaved={scrapSaved} className="btn-quiet" />
          </div>
        )}
        {(!!evaluation.strengths?.length || !!evaluation.weaknesses?.length) && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {!!evaluation.strengths?.length && <DetailList title="좋은 점" items={evaluation.strengths} />}
            {!!evaluation.weaknesses?.length && <DetailList title="보완할 점" items={evaluation.weaknesses} />}
          </div>
        )}
      </section>

      {(!!evaluation.user_stated?.length || !!evaluation.inferred_assumptions?.length) && (
        <section className="grid gap-6 md:grid-cols-2">
          <DetailList title="직접 적어 주신 내용" items={evaluation.user_stated ?? []} />
          <DetailList title="AI가 덧붙인 가정, 아직 검증 전" items={evaluation.inferred_assumptions ?? []} />
        </section>
      )}

      {!!scoreItems.length && (
        <section>
          <h3 className="label">점수 근거</h3>
          <div className="mt-3 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {scoreItems.map(([label, value]) => {
              const key = Object.entries(scoreReasonLabels).find(([, currentLabel]) => currentLabel === label)?.[0] as keyof NonNullable<IdeaEvaluationResult['score_reasons']> | undefined;
              const reason = key ? evaluation.score_reasons?.[key] : undefined;
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-3"><span className="text-[15px] font-bold text-ink">{label}</span><span className="num text-ink">{value}</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-mid"><div className="h-full rounded-full bg-seed" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
                  {reason && (
                    <dl className="mt-3 grid gap-1 text-[13px] leading-6 text-muted">
                      {!!reason.positive.length && <div className="flex gap-2"><dt className="shrink-0 text-ink">더한 이유</dt><dd>{reason.positive.join(', ')}</dd></div>}
                      {!!reason.deductions.length && <div className="flex gap-2"><dt className="shrink-0 text-ink">깎은 이유</dt><dd>{reason.deductions.join(', ')}</dd></div>}
                      {!!reason.evidence.length && <div className="flex gap-2"><dt className="shrink-0 text-ink">근거</dt><dd>{reason.evidence.join(', ')}</dd></div>}
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <TextSection title="포트폴리오 가치" content={evaluation.portfolio_value} />
        <TextSection title="시장과 경쟁" content={evaluation.market_fit} />
      </section>

      {!!techGroups.length && (
        <section>
          <h3 className="label">추천 기술</h3>
          <div className="mt-1 divide-y divide-outline-soft">
            {techGroups.flatMap((group) => group.items.map((item, index) => (
              <div key={`${group.label}-${item.name}`} className="grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[7rem_10rem_minmax(0,1fr)] sm:items-baseline">
                <span className="text-[13px] text-muted">{index === 0 ? group.label : ''}</span>
                <span className="text-[15px] font-bold text-ink">{item.name}</span>
                <span className="text-sm leading-6 text-muted">{item.reason}</span>
              </div>
            )))}
          </div>
        </section>
      )}

      {risks.length > 0 && (
        <section>
          <h3 className="label">위험과 대응</h3>
          <div className="mt-1 divide-y divide-outline-soft">
            {risks.slice(0, 5).map((risk) => (
              <div key={risk.title} className="py-4">
                <p className="flex items-baseline justify-between gap-3"><span className="text-[15px] font-bold text-ink">{risk.title}</span><span className="shrink-0 text-[13px] text-muted">위험도 {severityLabel[risk.severity] ?? risk.severity}</span></p>
                <p className="mt-1.5 text-sm leading-6 text-muted">{risk.impact}</p>
                <p className="mt-1 text-sm leading-6 text-ink"><span className="text-muted">대응: </span>{risk.mitigation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {nextSteps.length > 0 && (
        <section>
          <h3 className="label">MVP 실행 순서</h3>
          <ol className="mt-1 divide-y divide-outline-soft">
            {nextSteps.slice(0, 5).map((step) => (
              <li key={`${step.order}-${step.title}`} className="flex gap-4 py-4">
                <span className="num w-5 shrink-0 text-muted">{step.order}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-ink">{step.title}</p>
                  {step.description !== step.title && <p className="mt-1 text-sm leading-6 text-muted">{step.description}</p>}
                  <p className="mt-1 text-[13px] leading-6 text-muted"><span className="text-ink">산출물</span> {step.deliverable}, <span className="text-ink">끝나는 기준</span> {step.done_when}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {evaluation.mvp_scope && (
        <section>
          <h3 className="label">MVP 범위</h3>
          <dl className="mt-3 grid gap-5 text-sm leading-6 text-ink sm:grid-cols-3">
            <div><dt className="text-[13px] text-muted">팀과 기간</dt><dd className="mt-0.5">{evaluation.mvp_scope.team_size}, {evaluation.mvp_scope.duration_weeks}주</dd></div>
            <div><dt className="text-[13px] text-muted">핵심 흐름</dt><dd className="mt-0.5">{evaluation.mvp_scope.core_user_flow}</dd></div>
            <div><dt className="text-[13px] text-muted">이번에는 빼는 것</dt><dd className="mt-0.5">{evaluation.mvp_scope.excluded_scope.join(', ') || '없음'}</dd></div>
          </dl>
        </section>
      )}

      {evaluation.confidence && (
        <section>
          <h3 className="label">이 평가를 얼마나 믿어도 되나</h3>
          <p className="mt-2 max-w-[42em] text-sm leading-7 text-ink">{evaluation.confidence.reason}</p>
          {!!evaluation.missing_data?.length && <div className="mt-5"><DetailList title="더 확인해야 할 것" items={evaluation.missing_data} /></div>}
        </section>
      )}

      <section>
        <h3 className="label">참고한 자료</h3>
        {evaluation.references?.length ? (
          <ul className="mt-1 divide-y divide-outline-soft">
            {evaluation.references.slice(0, 6).map((reference, index) => {
              const title = reference.metadata.title ?? reference.source_table;
              return (
                <li key={`${reference.source_table}:${reference.source_id ?? reference.metadata.url ?? reference.metadata.title ?? 'reference'}:${index}`} className="flex items-baseline gap-3 py-3 text-sm">
                  {reference.metadata.url
                    ? <a href={reference.metadata.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-ink underline-offset-4 hover:underline">{title}</a>
                    : <span className="min-w-0 flex-1 truncate text-ink">{title}</span>}
                  <span className="hidden shrink-0 text-[13px] text-muted sm:inline">{reference.metadata.source ?? reference.source_table}</span>
                  <span className="num shrink-0 text-[13px] text-muted">{Math.round(reference.similarity * 100)}%</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-7 text-muted">이번 평가에 직접 연결된 자료가 없습니다. 시장성 판단은 모델의 추론이므로 그대로 믿지 마세요.</p>
        )}
      </section>
    </div>
  );
}

function TextSection({ title, content }: { title: string; content: string }) {
  return <div><h3 className="label">{title}</h3><p className="mt-2 text-sm leading-7 text-ink">{content}</p></div>;
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="label">{title}</h3>
      <ul className="mt-1 divide-y divide-outline-soft">
        {items.slice(0, 4).map((item) => <li key={item} className="py-2.5 text-sm leading-6 text-ink">{item}</li>)}
      </ul>
    </div>
  );
}
