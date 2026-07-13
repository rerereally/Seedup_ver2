'use client';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/client';
import { Bot, CheckCircle2, Lightbulb, Loader2, RotateCcw, Send, X } from 'lucide-react';
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
  idea: string;
  saved: boolean;
  result: IdeaEvaluationResult;
};

const EXAMPLE_IDEAS = [
  { category: 'AI AUTOMATION', title: 'GitHub 이슈 데일리 리포트 봇', description: '변경 내용을 요약해 팀에 전달하는 자동화 도구' },
  { category: 'RAG SERVICE', title: '논문 기반 구현 아이디어 생성기', description: '논문의 핵심을 작은 실험과 프로젝트로 연결하는 웹앱' },
  { category: 'DEVELOPER TOOL', title: 'Product Hunt 팀 큐레이션', description: '신제품을 분석해 팀 Slack에 공유하는 대시보드' },
];

export default function Ideas() {
  const [idea, setIdea] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('idea') ?? '';
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [recentIdeas, setRecentIdeas] = useState<RecentIdea[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeRun, setActiveRun] = useState<EvaluationRun | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRecentModalOpen, setIsRecentModalOpen] = useState(false);

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
    setActiveRun(item.result ? { idea: item.idea_text, saved: true, result: normalizeEvaluation(item.result) } : null);
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
      setActiveRun({ idea: submittedIdea, saved, result: { ...evaluation, references: json.references ?? [] } });
      setStatus('saved');
    } catch {
      setStatus('error');
      setErrorMessage('네트워크 연결이 끊겼거나 평가 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-12">
          <div className="mb-6 flex flex-col gap-3 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-ink">아이디어 평가</h1>
              <span className="border border-ink bg-white px-3 py-1 text-xs font-black text-ink">IDEA REVIEW</span>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-muted">아이디어의 시장성, 구현 가능성, 차별성, 포트폴리오 가치를 분석합니다.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="overflow-hidden border border-outline-soft bg-white">
              <div className="min-h-[320px] p-4 sm:p-5 md:p-8">
                {!activeRun && status !== 'saving' && status !== 'error' && (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                    <span className="flex h-16 w-16 items-center justify-center border border-ink bg-ink text-white"><Bot className="h-8 w-8" /></span>
                    <h2 className="mt-6 text-2xl font-black leading-snug text-ink md:text-3xl">만들고 싶은 아이디어를 평가해보세요.</h2>
                    <p className="mt-3 text-sm leading-7 text-muted">아이디어를 입력하면 포트폴리오 가치와 실행 가능성을 함께 검토해드려요.</p>
                    <div className="mt-10 grid w-full max-w-3xl gap-3 md:grid-cols-3">
                      {EXAMPLE_IDEAS.map((example) => (
                        <button key={example.title} type="button" onClick={() => setIdea(example.title)} className="group border border-outline-soft bg-surface p-5 text-left transition-colors hover:border-ink hover:bg-white">
                          <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-muted">{example.category}</span>
                          <span className="mt-3 block text-sm font-bold leading-6 text-ink">{example.title}</span>
                          <span className="mt-2 block text-xs leading-5 text-muted">{example.description}</span>
                          <span className="mt-4 block text-xs font-bold text-ink">이 아이디어로 시작하기 <span className="inline-block transition-transform group-hover:translate-x-1">-&gt;</span></span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeRun && <div className="space-y-5">
                  <div className="ml-auto max-w-[94%] bg-ink px-4 py-3 text-sm leading-7 text-white sm:max-w-[88%] sm:px-5 sm:py-4">{activeRun.idea}</div>
                  <div className="max-w-full border border-outline-soft bg-surface p-4 sm:max-w-[96%] sm:p-5">
                    <p className="mb-4 text-xs font-black uppercase tracking-wider text-ink">평가 결과</p>
                    <EvaluationPanel run={activeRun} />
                  </div>
                </div>}

                {status === 'saving' && <div className="flex min-h-[240px] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-ink" /><p className="mt-4 text-sm font-bold text-ink">아이디어를 분석하고 있어요.</p><p className="mt-2 text-xs text-muted">최신 Seedup 데이터를 참고해 실행 가능성을 검토합니다.</p></div></div>}
                {status === 'error' && <div className="flex min-h-[240px] items-center justify-center text-center"><div><p className="text-sm font-bold text-ink">{errorMessage}</p><button type="button" onClick={handleSubmit} className="mt-4 bg-ink px-4 py-2 text-xs font-bold text-white">다시 시도</button></div></div>}
              </div>

              <div className="border-t border-outline-soft bg-white p-4 md:p-5">
                <div className="overflow-hidden border border-ink bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-soft bg-surface px-4 py-2.5">
                    <label htmlFor="idea-chat-input" className="text-xs font-black text-ink">어떤 아이디어를 검토할까요?</label>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Seedup data context on</span>
                  </div>
                  <textarea id="idea-chat-input" value={idea} onChange={(event) => setIdea(event.target.value)} aria-label="평가받을 프로젝트 아이디어" placeholder="누가 겪는 어떤 문제를 어떻게 해결할지 적어주세요.&#10;&#10;예: 취업 준비생에게 맞춤형 프로젝트와 학습 계획을 추천하는 서비스" className="h-32 min-h-32 w-full resize-none bg-white px-4 py-3 text-sm leading-6 text-ink outline-none placeholder:text-muted/70 sm:h-28 sm:min-h-28" onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void handleSubmit(); }} />
                  <div className="flex flex-col gap-3 border-t border-outline-soft bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <p className="text-xs leading-5 text-muted">시장성 · 차별성 · 구현 난이도 · 포트폴리오 · MVP 계획</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="text-[11px] text-muted">Cmd/Ctrl + Enter</span>
                      <button type="button" onClick={handleSubmit} disabled={!idea.trim() || status === 'saving'} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 bg-ink px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"><Send className="h-4 w-4" />{status === 'saving' ? '분석 중...' : '평가하기'}</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="border border-outline-soft bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-black text-ink">최근 평가</h2><div className="flex items-center gap-3"><button type="button" onClick={() => setIsRecentModalOpen(true)} disabled={recentIdeas.length <= 3} className="min-h-10 text-xs font-bold text-muted underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40">더보기</button><button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-1 text-xs font-bold text-ink"><RotateCcw className="h-3.5 w-3.5" /> 새로 시작</button></div></div>
                <div className="mt-4 grid gap-2">
                  {recentIdeas.length ? recentIdeas.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => openRecent(item)} className="border border-outline-soft bg-surface p-3 text-left text-xs font-bold leading-5 text-muted transition-colors hover:border-ink hover:bg-white hover:text-ink"><span className="line-clamp-2">{item.idea_text}</span><span className="mt-1 block text-[10px] font-black uppercase text-muted">{item.score ?? '-'} score</span></button>) : <p className="text-xs leading-6 text-muted">로그인하면 최근 평가가 여기에 저장됩니다.</p>}
                </div>
              </div>
              <div className="border border-ink bg-ink p-5 text-white"><p className="text-xs font-black uppercase tracking-wider text-white/60">Seedup Evidence</p><p className="mt-3 text-sm leading-7 text-white/90">평가할 때 최신 뉴스, 논문, 오픈소스와 제품 데이터를 함께 참고합니다.</p></div>
            </aside>
          </div>
        </div>
        {isRecentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4" role="dialog" aria-modal="true" aria-labelledby="recent-evaluations-title">
            <div className="w-full max-w-2xl border border-ink bg-white">
              <div className="flex items-center justify-between border-b border-outline-soft px-5 py-4">
                <div><h2 id="recent-evaluations-title" className="text-base font-black text-ink">최근 평가 전체 보기</h2><p className="mt-1 text-xs text-muted">이전에 평가받은 아이디어와 점수를 확인할 수 있습니다.</p></div>
                <button type="button" onClick={() => setIsRecentModalOpen(false)} aria-label="최근 평가 닫기" className="flex h-11 w-11 items-center justify-center text-ink hover:bg-surface"><X className="h-5 w-5" /></button>
              </div>
              <div className="max-h-[70vh] space-y-2 overflow-y-auto p-5">
                {recentIdeas.map((item) => <button key={item.id} type="button" onClick={() => openRecent(item)} className="w-full border border-outline-soft bg-surface p-4 text-left transition-colors hover:border-ink hover:bg-white"><div className="flex items-start justify-between gap-4"><span className="text-sm font-bold leading-6 text-ink">{item.idea_text}</span><span className="shrink-0 text-xs font-black text-muted">{item.score ?? '-'}점</span></div><span className="mt-2 block text-xs text-muted">{item.status === 'completed' ? '평가 완료' : item.status}</span></button>)}
              </div>
            </div>
          </div>
        )}
  </main>
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

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="종합 점수" value={`${evaluation.score} / 100`} />
        <SummaryMetric label="구현 난이도" value={evaluation.difficulty} />
        {evaluation.confidence && <SummaryMetric label="평가 신뢰도" value={evaluation.confidence.level === 'high' ? '높음' : evaluation.confidence.level === 'medium' ? '보통' : '낮음'} />}
      </div>

      <section className="border border-outline-soft bg-white p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black text-ink">핵심 판단</h3><span className="font-mono text-[11px] font-bold text-muted">VERDICT</span></div>
        <p className="mt-3 max-w-[75ch] text-sm leading-7 text-muted">{evaluation.verdict}</p>
        {!!evaluation.strengths?.length && <DetailList title="좋은 점" items={evaluation.strengths} />}
        {!!evaluation.weaknesses?.length && <DetailList title="보완할 점" items={evaluation.weaknesses} />}
      </section>

      {(evaluation.user_stated?.length || evaluation.inferred_assumptions?.length) && <div className="grid gap-4 md:grid-cols-2"><section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">사용자가 말한 내용</h3><p className="mt-2 text-xs leading-6 text-muted">입력에서 직접 확인된 사실입니다.</p><DetailList title="" items={evaluation.user_stated ?? []} /></section><section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">확장 가설</h3><p className="mt-2 text-xs leading-6 text-muted">Seedup 자료와 AI가 연결한 검증 전 가설입니다.</p><DetailList title="" items={evaluation.inferred_assumptions ?? []} /></section></div>}

      {!!scoreItems.length && <section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">점수 근거</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{scoreItems.map(([label, value]) => { const key = Object.entries(scoreReasonLabels).find(([, currentLabel]) => currentLabel === label)?.[0] as keyof NonNullable<IdeaEvaluationResult['score_reasons']> | undefined; const reason = key ? evaluation.score_reasons?.[key] : undefined; return <div key={label} className="border border-outline-soft bg-surface p-3"><div className="flex justify-between gap-3 text-xs font-bold text-muted"><span>{label}</span><span className="font-mono text-ink">{value}</span></div><div className="mt-2 h-1 bg-outline-soft"><div className="h-1 bg-ink" style={{ width: `${value}%` }} /></div>{reason && <div className="mt-3 grid gap-2 text-xs leading-5 text-muted"><p><strong className="text-ink">긍정:</strong> {reason.positive.join(' · ') || '명시된 근거 없음'}</p><p><strong className="text-ink">감점:</strong> {reason.deductions.join(' · ') || '명시된 감점 없음'}</p><p><strong className="text-ink">근거:</strong> {reason.evidence.join(' · ') || '직접 근거 없음'}</p></div>}</div>; })}</div></section>}

      <div className="grid gap-4 md:grid-cols-2">
        <TextSection title="포트폴리오 가치" content={evaluation.portfolio_value} />
        <TextSection title="시장성 및 경쟁 환경" content={evaluation.market_fit} />
      </div>

      {!!technologies.length && <section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">추천 MVP 기술 스택</h3><div className="mt-3 grid gap-2">{(['required', 'optional', 'scale'] as const).map((category) => { const items = technologies.filter((item) => item.category === category); if (!items.length) return null; return <div key={category}><p className="font-mono text-[11px] font-bold uppercase text-muted">{category === 'required' ? 'MVP 필수' : category === 'optional' ? '선택 사항' : '확장 단계'}</p><div className="mt-2 grid gap-2">{items.map((item) => <div key={`${category}-${item.name}`} className="border border-outline-soft bg-surface p-3"><p className="text-sm font-bold text-ink">{item.name}</p><p className="mt-1 text-xs leading-5 text-muted">{item.reason}</p></div>)}</div></div>; })}</div></section>}

      {risks.length > 0 && <section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">위험 요소와 대응</h3><div className="mt-3 grid gap-2">{risks.slice(0, 5).map((risk) => <div key={risk.title} className="border border-outline-soft bg-surface p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-ink">{risk.title}</p><span className="font-mono text-[11px] font-bold uppercase text-muted">{risk.severity}</span></div><p className="mt-2 text-xs leading-5 text-muted"><strong className="text-ink">영향:</strong> {risk.impact}</p><p className="mt-1 text-xs leading-5 text-muted"><strong className="text-ink">대응:</strong> {risk.mitigation}</p></div>)}</div></section>}

      {nextSteps.length > 0 && <section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">MVP 실행 계획</h3><div className="mt-3 grid gap-2">{nextSteps.slice(0, 5).map((step) => <div key={`${step.order}-${step.title}`} className="border border-outline-soft bg-surface p-3"><p className="text-sm font-bold text-ink"><span className="mr-2 font-mono text-muted">{String(step.order).padStart(2, '0')}</span>{step.title}</p><p className="mt-2 text-xs leading-5 text-muted">{step.description}</p><p className="mt-2 text-xs leading-5 text-muted"><strong className="text-ink">산출물:</strong> {step.deliverable}</p><p className="mt-1 text-xs leading-5 text-muted"><strong className="text-ink">완료 조건:</strong> {step.done_when}</p></div>)}</div></section>}

      {evaluation.mvp_scope && <section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">MVP 범위</h3><div className="mt-3 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-3"><p><strong className="block text-xs text-ink">팀과 기간</strong>{evaluation.mvp_scope.team_size} · {evaluation.mvp_scope.duration_weeks}주</p><p><strong className="block text-xs text-ink">핵심 흐름</strong>{evaluation.mvp_scope.core_user_flow}</p><p><strong className="block text-xs text-ink">이번 MVP 제외</strong>{evaluation.mvp_scope.excluded_scope.join(' · ') || '추가 범위 없음'}</p></div></section>}

      {evaluation.confidence && <section className="border border-outline-soft bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black text-ink">평가 신뢰도</h3><span className="font-mono text-xs font-bold text-muted">{evaluation.confidence.level.toUpperCase()}</span></div><p className="mt-2 text-xs leading-6 text-muted">{evaluation.confidence.reason}</p>{!!evaluation.missing_data?.length && <DetailList title="추가 검증 필요" items={evaluation.missing_data} />}</section>}

      {!!evaluation.references?.length && <section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">평가 근거</h3><p className="mt-2 text-xs leading-6 text-muted">이번 평가에서 실제로 검색된 참고 자료입니다.</p><div className="mt-3 grid gap-2">{evaluation.references.slice(0, 6).map((reference, index) => <div key={`${reference.source_table}:${reference.source_id ?? reference.metadata.url ?? reference.metadata.title ?? 'reference'}:${index}`} className="border border-outline-soft bg-surface p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-ink">{reference.metadata.title ?? reference.source_table}</p><span className="font-mono text-xs font-bold text-muted">{Math.round(reference.similarity * 100)}%</span></div><p className="mt-1 text-xs text-muted">{reference.metadata.source ?? reference.source_table}</p>{reference.metadata.url && <a href={reference.metadata.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs font-bold text-ink underline">원문 보기</a>}</div>)}</div></section>}
      {!evaluation.references?.length && <p className="border border-dashed border-outline-soft bg-white p-4 text-xs leading-6 text-muted">이번 평가에 직접 연결된 참고 자료가 없습니다. 시장성 평가는 제한적인 정보에 기반한 AI 추론입니다.</p>}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) { return <div className="border border-outline-soft bg-white p-3"><p className="font-mono text-[11px] font-bold uppercase text-muted">{label}</p><p className="mt-2 text-xl font-black text-ink">{value}</p></div>; }
function TextSection({ title, content }: { title: string; content: string }) { return <section className="border border-outline-soft bg-white p-4"><h3 className="text-sm font-black text-ink">{title}</h3><p className="mt-3 max-w-[65ch] text-sm leading-7 text-muted">{content}</p></section>; }
function DetailList({ title, items }: { title: string; items: string[] }) { return <div className="mt-4"><p className="text-xs font-black text-ink">{title}</p><ul className="mt-2 grid gap-1">{items.slice(0, 4).map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-muted"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />{item}</li>)}</ul></div>; }
