'use client';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, CheckCircle2, Lightbulb, Loader2, RotateCcw, Send, SquareTerminal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type RecentIdea = {
  id: string;
  idea_text: string;
  status: string;
  score: number | null;
  result: IdeaEvaluationResult | null;
};

type IdeaEvaluationResult = {
  score: number;
  verdict: string;
  portfolio_value: string;
  difficulty: string;
  market_fit: string;
  recommended_stack: string[];
  risks: string[];
  next_steps: string[];
};

type EvaluationRun = {
  idea: string;
  saved: boolean;
  result: IdeaEvaluationResult;
};

const EXAMPLE_IDEAS = [
  'GitHub 이슈를 요약해서 데일리 리포트로 보내주는 봇',
  '논문을 읽고 구현 아이디어를 자동으로 뽑아주는 웹앱',
  'Product Hunt 신제품을 팀 슬랙에 큐레이션하는 대시보드',
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

  const handleSubmit = async () => {
    if (!idea.trim() || status === 'saving') return;

    const submittedIdea = idea.trim();
    setStatus('saving');
    setErrorMessage('');

    const response = await fetch('/api/ideas/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: submittedIdea }),
    });

    if (!response.ok) {
      setStatus('error');
      setErrorMessage('분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const json = await response.json();
    const evaluation = json.evaluation as IdeaEvaluationResult;
    const saved = Boolean(json.saved);
    setActiveRun({ idea: submittedIdea, saved, result: evaluation });
    setStatus('saved');
  };

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <section className="border border-outline-soft bg-white p-5 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 border border-outline-soft bg-surface px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-muted">
                  <SquareTerminal className="h-4 w-4" />
                  IDEA_EVALUATOR.TS
                </div>
                <h1 className="text-4xl font-black leading-tight text-ink md:text-6xl">아이디어 평가</h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
                  만들고 싶은 프로젝트를 입력하면 포트폴리오 가치, 시장성, 난이도, 추천 스택, 다음 단계를 실행 가능한 형태로 정리합니다.
                </p>
              </div>
              <div className="border border-outline-soft bg-surface px-4 py-3">
                <p className="text-xs font-bold uppercase text-muted">SAVE STATUS</p>
                <p className="mt-1 text-sm font-black text-ink">{isLoggedIn ? '로그인됨 · 결과 자동 저장' : '비로그인 · 결과 미저장'}</p>
              </div>
            </div>
          </section>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            <aside className="w-full lg:w-72 lg:shrink-0">
              <section className="border border-outline-soft bg-white p-4">
                <button type="button" onClick={reset} className="flex w-full items-center justify-between gap-3 border border-outline-soft bg-surface p-3 text-left text-sm font-bold text-ink hover:border-ink">
                  새로운 평가
                  <RotateCcw className="h-4 w-4" />
                </button>

                <div className="mt-5 border-t border-outline-soft pt-4">
                  <h2 className="mb-3 text-xs font-black uppercase text-ink">Recent Results</h2>
                  {recentIdeas.length ? (
                    <div className="grid gap-2">
                      {recentIdeas.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setIdea(item.idea_text);
                            setActiveRun(item.result ? { idea: item.idea_text, saved: true, result: item.result } : null);
                            setStatus('idle');
                          }}
                          className="border border-outline-soft bg-surface p-3 text-left hover:border-ink"
                        >
                          <span className="block line-clamp-2 text-sm font-bold leading-6 text-ink">{item.idea_text}</span>
                          <span className="mt-2 block text-xs font-bold uppercase text-muted">{item.score ?? '-'} score</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted">로그인하면 평가 결과가 이곳에 저장됩니다.</p>
                  )}
                </div>
              </section>
            </aside>

            <section className="min-w-0 flex-1">
              <div className="border border-outline-soft bg-white">
                <div className="border-b border-outline-soft p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-ink">
                    <Lightbulb className="h-4 w-4" />
                    Input
                  </div>
                  <textarea
                    value={idea}
                    onChange={(event) => setIdea(event.target.value)}
                    aria-label="평가받을 프로젝트 아이디어"
                    placeholder="예: 매일 뉴스레터를 요약해서 슬랙으로 보내주는 봇을 만들고 싶어요."
                    className="min-h-40 w-full resize-y border border-outline-soft bg-surface p-4 text-sm leading-7 text-ink outline-none placeholder:text-muted/60 focus:border-ink"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void handleSubmit();
                    }}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-muted">Cmd/Ctrl + Enter로 분석</span>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="inline-flex h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={!idea.trim() || status === 'saving'}
                    >
                      {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {status === 'saving' ? '분석 중' : '평가하기'}
                    </button>
                  </div>
                </div>

                <div className="border-b border-outline-soft p-5">
                  <h2 className="mb-3 text-xs font-black uppercase text-ink">Example Prompts</h2>
                  <div className="grid gap-2 md:grid-cols-3">
                    {EXAMPLE_IDEAS.map((example) => (
                      <button key={example} type="button" onClick={() => setIdea(example)} className="border border-outline-soft bg-surface p-3 text-left text-xs font-bold leading-5 text-muted hover:border-ink hover:text-ink">
                        {example}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  {status === 'saving' && (
                    <div className="border border-outline-soft bg-surface p-5">
                      <p className="text-sm font-bold text-ink">아이디어를 평가하고 있습니다.</p>
                      <p className="mt-2 text-sm text-muted">포트폴리오 가치, 시장성, 리스크, 다음 단계를 계산하는 중입니다.</p>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="border border-outline-soft bg-surface p-5">
                      <p className="text-sm font-bold text-ink">{errorMessage}</p>
                      <button type="button" onClick={handleSubmit} className="mt-3 border border-outline-soft bg-white px-3 py-2 text-xs font-bold text-ink hover:border-ink">
                        다시 시도
                      </button>
                    </div>
                  )}

                  {!activeRun && status !== 'saving' && status !== 'error' && (
                    <div className="border border-dashed border-outline-soft bg-surface p-8 text-center">
                      <p className="text-sm font-bold text-ink">평가 결과가 여기에 표시됩니다.</p>
                      <p className="mt-2 text-sm text-muted">아이디어를 입력하거나 예시 프롬프트를 선택해보세요.</p>
                    </div>
                  )}

                  {activeRun && <EvaluationPanel run={activeRun} />}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function EvaluationPanel({ run }: { run: EvaluationRun }) {
  const evaluation = run.result;

  return (
    <div className="grid gap-5">
      <div className="border border-outline-soft bg-surface p-4">
        <p className="text-xs font-bold uppercase text-muted">Evaluated Idea</p>
        <p className="mt-2 text-lg font-black leading-7 text-ink">{run.idea}</p>
        <p className="mt-3 text-xs font-bold uppercase text-muted">{run.saved ? 'saved' : 'not saved · login required'}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['Score', evaluation.score],
          ['Difficulty', evaluation.difficulty],
          ['Portfolio', '검토'],
          ['Market', '검토'],
        ].map(([label, value]) => (
          <div key={label} className="border border-outline-soft bg-white p-4">
            <p className="text-xs font-bold uppercase text-muted">{label}</p>
            <p className="mt-2 text-2xl font-black text-ink">{value}</p>
          </div>
        ))}
      </div>

      <section className="border border-outline-soft bg-white p-4">
        <h2 className="text-sm font-black uppercase text-ink">Verdict</h2>
        <p className="mt-3 text-sm leading-7 text-muted">{evaluation.verdict}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Portfolio Value</h3>
          <p className="mt-3 text-sm leading-7 text-muted">{evaluation.portfolio_value}</p>
        </section>
        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Market Fit</h3>
          <p className="mt-3 text-sm leading-7 text-muted">{evaluation.market_fit}</p>
        </section>
      </div>

      <section className="border border-outline-soft bg-white p-4">
        <h3 className="text-sm font-black uppercase text-ink">Recommended Stack</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {evaluation.recommended_stack.map((stack) => (
            <span key={stack} className="border border-outline-soft bg-surface px-2.5 py-1 text-xs font-bold text-muted">{stack}</span>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Risks</h3>
          <div className="mt-3 grid gap-2">
            {evaluation.risks.slice(0, 5).map((risk, index) => (
              <div key={risk} className="flex gap-3 border border-outline-soft bg-surface p-3 text-sm leading-6 text-muted">
                <span className="font-black text-ink">#{index + 1}</span>
                <p>{risk}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Next Steps</h3>
          <div className="mt-3 grid gap-2">
            {evaluation.next_steps.slice(0, 5).map((step, index) => (
              <div key={step} className="flex gap-3 border border-outline-soft bg-surface p-3 text-sm leading-6 text-muted">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-ink" />
                <p><span className="font-black text-ink">#{index + 1}</span> {step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Link href="/projects" className="inline-flex h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-bold text-white">
        관련 프로젝트 보기
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
