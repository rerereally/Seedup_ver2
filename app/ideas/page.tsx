'use client';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/client';
import PageIntro from '@/components/PageIntro';
import ScrapButton from '@/components/ScrapButton';
import { Loader2, RotateCcw, X } from 'lucide-react';
import WorkShell from '@/components/WorkShell';
import ValidationReportPanel from '@/components/ValidationReportPanel';
import { useEffect, useState } from 'react';

type RecentIdea = {
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

type IdeaEvaluationResult = {
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

type EvaluationRun = {
  id: string | null;
  idea: string;
  saved: boolean;
  result: IdeaEvaluationResult;
};

const EXAMPLE_IDEAS = [
  { category: '자동화', short: '데일리 이슈 리포트 봇', title: 'GitHub 이슈 데일리 리포트 봇', description: '개발팀이 놓치는 이슈 변경을 줄이기 위해, 저장소 이슈를 요약해 매일 팀 Slack으로 보내는 자동화 도구를 만들고 싶어요.' },
  { category: 'RAG 서비스', short: '논문 구현 아이디어', title: '논문 기반 구현 아이디어 생성기', description: 'AI를 공부하는 개발자가 논문 초록을 넣으면 핵심을 작은 실험과 구현 가능한 프로젝트로 바꿔주는 웹앱을 만들고 싶어요.' },
  { category: '개발자 도구', short: 'Product Hunt 큐레이션', title: 'Product Hunt 팀 큐레이션', description: '제품팀이 신제품을 빠르게 검토하도록 Product Hunt 제품을 분석해 매일 팀 Slack에 공유하는 대시보드를 만들고 싶어요.' },
];

export default function Ideas() {
  const [idea, setIdea] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [recentIdeas, setRecentIdeas] = useState<RecentIdea[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeRun, setActiveRun] = useState<EvaluationRun | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRecentModalOpen, setIsRecentModalOpen] = useState(false);

  // Read query params after mount: the page is statically prerendered, so reading window in useState would mismatch the server HTML.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialIdea = params.get('idea');
    if (initialIdea) setIdea(initialIdea); // eslint-disable-line react-hooks/set-state-in-effect -- one hydration-safe read of the URL

    const evaluationId = params.get('evaluation');
    const supabase = evaluationId ? createClient() : null;
    if (!evaluationId || !supabase) return;
    void supabase
      .from('idea_evaluations')
      .select('id,idea_text,status,score,result')
      .eq('id', evaluationId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const item = data as RecentIdea;
        setIdea(item.idea_text);
        setActiveRun({ id: item.id, idea: item.idea_text, saved: true, result: normalizeEvaluation(item.result) });
      });
  }, []);

  useEffect(() => {
    const loadRecentIdeas = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      setIsLoggedIn(Boolean(user));
      if (!user) return;

      const { data } = await supabase
        .from('idea_evaluations')
        .select('id,idea_text,status,score,result')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);

      setRecentIdeas((data ?? []) as RecentIdea[]);
    };

    void loadRecentIdeas();
  }, [status]);

  const reset = () => {
    setIdea('');
    setStatus('idle');
    setActiveRun(null);
    setErrorMessage('');
  };

  const openRecent = (item: RecentIdea) => {
    setIdea(item.idea_text);
    setActiveRun(item.result ? { id: item.id, idea: item.idea_text, saved: true, result: normalizeEvaluation(item.result) } : null);
    setStatus('idle');
    setIsRecentModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!idea.trim() || status === 'saving') return;

    const submittedIdea = idea.trim();
    setStatus('saving');
    setErrorMessage('');

    try {
      const response = await fetch('/api/ideas/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idea: submittedIdea }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        setStatus('error');
        setErrorMessage(typeof errorBody?.error === 'string' ? errorBody.error : '분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      const json = await response.json();
      const evaluation = normalizeEvaluation(json.evaluation);
      const saved = Boolean(json.saved);
      setActiveRun({ id: typeof json.id === 'string' ? json.id : null, idea: submittedIdea, saved, result: { ...evaluation, references: json.references ?? [] } });
      setStatus('saved');
    } catch {
      setStatus('error');
      setErrorMessage('네트워크 연결이 끊겼거나 평가 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const isIdle = !activeRun && status !== 'saving' && status !== 'error';
  const composer = (
    <div>
      <label htmlFor="idea-chat-input" className="text-sm font-semibold text-ink">만들고 싶은 것</label>
      <textarea id="idea-chat-input" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="누가 겪는 어떤 문제를 어떻게 풀지 적어 주세요.&#10;예: 데이터베이스마다 다른 CLI 명령을 하나로 통일해 주는 도구" className="mt-2 block h-28 w-full resize-y border bg-white px-4 py-3 text-[15px] leading-7 text-ink placeholder:text-muted focus:border-seed focus:outline-none" onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void handleSubmit(); }} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-muted">시장성, 차별성, 구현 난이도, 포트폴리오 가치, MVP 계획을 봅니다. <span className="hidden sm:inline">⌘/Ctrl + Enter</span></p>
        <button type="button" onClick={handleSubmit} disabled={!idea.trim() || status === 'saving'} className="btn disabled:cursor-not-allowed">{status === 'saving' ? '분석 중…' : '평가하기'}</button>
      </div>
    </div>
  );

  return (
    <>
      <Header />
      <WorkShell>
        <PageIntro title="아이디어 검증" description="모아 둔 뉴스·논문·오픈소스·제품 자료에 비춰 내 아이디어를 평가합니다. 원문 대조가 아니라 AI가 매기는 참고 점수입니다." />

        {/* The work on the left; past evaluations and what each check means beside it, like the other app screens. */}
        <div className="page-split">
          <div className="flex min-w-0 flex-col gap-6">
            {composer}

            {isIdle && (
              <ul className="examples -mt-3" aria-label="예시 아이디어">
                <li aria-hidden="true">예시</li>
                {EXAMPLE_IDEAS.map((example) => (
                  <li key={example.title}>
                    <button type="button" onClick={() => setIdea(example.description)} title={example.description} className="example">{example.short}</button>
                  </li>
                ))}
              </ul>
            )}

            {status === 'saving' && <div className="card flex min-h-[220px] items-center justify-center text-center"><div><Loader2 aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-seed" /><p className="mt-4 font-semibold text-ink">아이디어를 분석하고 있습니다</p><p className="mt-1.5 text-sm text-muted">1분 가까이 걸릴 수 있습니다.</p></div></div>}
            {status === 'error' && <div role="alert" className="card flex min-h-[220px] items-center justify-center p-6 text-center"><div><p className="font-semibold text-ink">{errorMessage}</p><button type="button" onClick={handleSubmit} className="btn mt-4">다시 시도</button></div></div>}

            {activeRun && status !== 'saving' && <div className="card p-6 md:p-7"><EvaluationPanel run={activeRun} /></div>}

            {idea.trim().length >= 4 && <ValidationReportPanel idea={idea} isLoggedIn={isLoggedIn} />}
          </div>

          <aside className="page-side">
            <section aria-labelledby="recent-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="recent-heading" className="text-[15px] font-semibold text-ink">최근 평가</h2>
                <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />새로 시작</button>
              </div>
              {recentIdeas.length ? (
                <ul className="rows mt-3">
                  {recentIdeas.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => openRecent(item)} className="group flex w-full items-baseline gap-3 py-3 text-left">
                        <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-6 text-ink group-hover:underline group-hover:underline-offset-4">{item.idea_text}</span>
                        <span className="num shrink-0 text-sm text-muted">{item.score ?? '–'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted">{isLoggedIn ? '아직 검증한 아이디어가 없습니다.' : '로그인하면 검증한 아이디어가 여기에 남습니다.'}</p>
              )}
              {recentIdeas.length > 3 && <button type="button" onClick={() => setIsRecentModalOpen(true)} className="link-seed mt-2">전체 {recentIdeas.length}개 보기 ›</button>}
            </section>

            <section aria-labelledby="checks-heading">
              <h2 id="checks-heading" className="text-[15px] font-semibold text-ink">두 가지 검증</h2>
              <dl className="mt-3 grid gap-3 text-sm leading-6">
                <div><dt className="font-semibold text-ink">평가하기</dt><dd className="text-muted">모아 둔 글, 논문, 오픈소스, 제품에 비춘 AI의 참고 점수입니다. 근거로 삼은 자료가 없으면 결과 아래에 그렇게 적습니다.</dd></div>
                <div><dt className="font-semibold text-ink">검증 리포트</dt><dd className="text-muted">GitHub, Hacker News, Stack Overflow에서 이 문제를 겪는 사람의 글을 찾아, 원문과 글자 그대로 맞는 문장만 담습니다. 아이디어를 4자 넘게 적으면 열립니다.</dd></div>
              </dl>
            </section>
          </aside>
        </div>

        {isRecentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="recent-evaluations-title">
            <div className="card w-full max-w-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-outline-soft px-6 py-4">
                <h2 id="recent-evaluations-title" className="text-lg font-semibold tracking-tight text-ink">최근 평가</h2>
                <button type="button" onClick={() => setIsRecentModalOpen(false)} aria-label="최근 평가 닫기" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-mid hover:text-ink"><X aria-hidden="true" className="h-5 w-5" /></button>
              </div>
              <ul className="max-h-[70vh] divide-y divide-outline-soft overflow-y-auto px-6">
                {recentIdeas.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => openRecent(item)} className="group flex w-full items-baseline gap-4 py-4 text-left">
                      <span className="min-w-0 flex-1 text-[15px] leading-6 text-ink group-hover:underline group-hover:underline-offset-4">{item.idea_text}</span>
                      <span className="num shrink-0 text-sm text-muted">{item.score ?? '–'}점</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </WorkShell>
      <Footer />
    </>
  );
}

function normalizeEvaluation(value: unknown): IdeaEvaluationResult {
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

function EvaluationPanel({ run }: { run: EvaluationRun }) {
  const evaluation = run.result;
  // Whether this evaluation is already in 북마크; keyed by id so a different run never shows a stale answer.
  const [scrap, setScrap] = useState<{ id: string; saved: boolean } | null>(null);
  useEffect(() => {
    const supabase = run.id ? createClient() : null;
    if (!run.id || !supabase) return;
    let live = true;
    const id = run.id;
    void supabase.from('scraps').select('id').eq('item_type', 'idea').eq('item_id', id).maybeSingle()
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
