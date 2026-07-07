'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, CheckCircle2, Lightbulb, Send, Sparkles } from 'lucide-react';
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

export default function Ideas() {
  const [idea, setIdea] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [recentIdeas, setRecentIdeas] = useState<RecentIdea[]>([]);
  const [evaluation, setEvaluation] = useState<IdeaEvaluationResult | null>(null);

  useEffect(() => {
    const loadRecentIdeas = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('idea_evaluations')
        .select('id,idea_text,status,score,result')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(8);

      setRecentIdeas((data ?? []) as RecentIdea[]);
    };

    void loadRecentIdeas();
  }, [status]);

  const handleSubmit = async () => {
    if (!idea.trim()) return;

    setStatus('saving');

    const response = await fetch('/api/ideas/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: idea.trim() }),
    });

    if (!response.ok) {
      setStatus('error');
      return;
    }

    const json = await response.json();
    setEvaluation(json.evaluation as IdeaEvaluationResult);
    setStatus('saved');
    setIdea('');
  };

  return (
    <>
      <Header />
      <main className="grow bg-surface-low">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-8 md:px-10 lg:grid-cols-[280px_1fr]">
          <aside className="hidden rounded-lg border border-outline-soft bg-surface p-3 lg:block">
            <button
              type="button"
              onClick={() => {
                setIdea('');
                setStatus('idle');
                setEvaluation(null);
              }}
              className="mb-6 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-surface-low"
            >
              <Lightbulb className="h-5 w-5 text-brand-primary" />
              새로운 아이디어 평가
            </button>
            <h3 className="mb-2 px-3 text-xs font-semibold text-muted">최근 기록</h3>
            {recentIdeas.length ? recentIdeas.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIdea(item.idea_text);
                  setEvaluation(item.result);
                  setStatus('idle');
                }}
                className={`mb-1 w-full truncate rounded-lg p-3 text-left text-sm ${index === 0 ? 'bg-surface-mid text-ink' : 'text-muted hover:bg-surface-low'}`}
              >
                <span className="block truncate">{item.idea_text}</span>
                {item.score !== null && <span className="mt-1 block text-xs text-brand-primary">{item.score}점</span>}
              </button>
            )) : (
              <p className="px-3 py-2 text-xs leading-5 text-muted">로그인 후 아이디어를 저장하면 최근 기록이 표시됩니다.</p>
            )}
          </aside>

          <section className="min-h-[calc(100vh-10rem)] rounded-xl border border-outline-soft bg-white">
            <div className="border-b border-outline-soft p-5 md:p-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Idea Evaluation Report
              </div>
              <h1 className="text-3xl font-semibold text-ink md:text-[32px]">내 아이디어 평가받기</h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted">만들고 싶은 프로젝트 아이디어를 입력하면 포트폴리오 가치, 기술 난이도, 필요한 스택을 7일 빌드 플랜으로 구체화합니다.</p>
            </div>

            <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-[1fr_360px]">
              <div className="rounded-lg border border-outline-soft bg-surface-lowest p-2 transition-all focus-within:border-brand-primary focus-within:ring-4 focus-within:ring-brand-primary/10">
                <textarea
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder="예: 매일 뉴스레터를 요약해서 슬랙으로 보내주는 봇을 만들고 싶어요."
                  className="h-72 w-full resize-none bg-transparent p-4 leading-7 text-ink outline-none placeholder:text-muted/60"
                />
                <div className="flex flex-col gap-3 border-t border-outline-soft/60 p-3 md:flex-row md:items-center md:justify-between">
                  <span className="text-xs text-muted">구체적으로 작성할수록 정확한 평가가 가능합니다.</span>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!idea.trim() || status === 'saving'}
                  >
                    <Send className="h-4 w-4" />
                    {status === 'saving' ? '저장 중' : '분석하기'}
                  </button>
                </div>
                {status === 'saved' && <p className="px-3 pb-3 text-sm font-semibold text-emerald-600">아이디어 분석이 완료되었습니다.</p>}
                {status === 'error' && <p className="px-3 pb-3 text-sm font-semibold text-red-600">분석에 실패했습니다. Supabase와 OpenRouter 설정을 확인해주세요.</p>}
              </div>

              <aside className="flex flex-col gap-4">
                <div className="rounded-lg border border-outline-soft bg-surface p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                    <BarChart3 className="h-5 w-5 text-brand-primary" />
                    평가 기준
                  </div>
                  {[
                    ['포트폴리오 가치', '실제 문제 해결력과 결과물 임팩트'],
                    ['기술 난이도', '7일 안에 완성 가능한 범위'],
                    ['시장성', '최근 트렌드와 연결되는 정도'],
                  ].map(([title, desc]) => (
                    <div key={title} className="border-t border-outline-soft/60 py-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <CheckCircle2 className="h-4 w-4 text-brand-primary" />
                        {title}
                      </div>
                      <p className="mt-1 pl-6 text-xs leading-5 text-muted">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-outline-soft bg-[#191c1d] p-5 text-white">
                  <div className="text-sm font-semibold">분석 결과</div>
                  <div className="mt-4 text-2xl font-bold text-brand-primary">{evaluation ? `${evaluation.score}점` : '분석 대기'}</div>
                  <p className="mt-2 text-sm leading-6 text-white/70">{evaluation?.verdict ?? '아이디어를 입력하면 AI가 포트폴리오 가치, 난이도, 시장성, 다음 단계를 평가합니다.'}</p>
                  {evaluation && (
                    <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white/50">Difficulty</div>
                        <div className="mt-1 text-sm font-semibold">{evaluation.difficulty}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white/50">Portfolio Value</div>
                        <p className="mt-1 text-sm leading-6 text-white/75">{evaluation.portfolio_value}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white/50">Stack</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {evaluation.recommended_stack.map((stack) => (
                            <span key={stack} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">{stack}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white/50">Next Steps</div>
                        <ul className="mt-2 space-y-2">
                          {evaluation.next_steps.slice(0, 5).map((step) => (
                            <li key={step} className="text-sm leading-6 text-white/75">- {step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
