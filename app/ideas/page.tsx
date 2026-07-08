'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import { Bot, CheckCircle2, Lightbulb, Send, Sparkles, UserCircle } from 'lucide-react';
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

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  evaluation?: IdeaEvaluationResult | null;
};

export default function Ideas() {
  const [idea, setIdea] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('idea') ?? '';
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [recentIdeas, setRecentIdeas] = useState<RecentIdea[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '만들고 싶은 프로젝트 아이디어를 적어주세요. 포트폴리오 가치, 난이도, 추천 스택, 다음 단계를 채팅 안에서 정리해드릴게요.',
    },
  ]);

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

    const submittedIdea = idea.trim();
    setStatus('saving');
    setIdea('');
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', content: submittedIdea },
      { id: `thinking-${Date.now()}`, role: 'assistant', content: '답변을 생각중입니다.' },
    ]);

    const response = await fetch('/api/ideas/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: submittedIdea }),
    });

    if (!response.ok) {
      setStatus('error');
      setMessages((current) => current.map((message) => message.id.startsWith('thinking-') ? { ...message, content: '분석에 실패했습니다. Supabase와 OpenRouter 설정을 확인해주세요.' } : message));
      return;
    }

    const json = await response.json();
    const evaluation = json.evaluation as IdeaEvaluationResult;
    setMessages((current) => current.map((message) => message.id.startsWith('thinking-') ? {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '아이디어 분석이 완료되었습니다.',
      evaluation,
    } : message));
    setStatus('saved');
  };

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-10 md:px-10 md:py-12 lg:grid-cols-[280px_1fr]">
          <aside className="hidden rounded-xl border border-outline-soft bg-white p-3 shadow-sm lg:block">
            <button
              type="button"
              onClick={() => {
                setIdea('');
                setStatus('idle');
                setMessages([{ id: 'welcome', role: 'assistant', content: '새 아이디어를 적어주세요. 채팅 안에서 분석 결과를 바로 보여드릴게요.' }]);
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
                  if (item.result) {
                    setMessages([
                      { id: `recent-user-${item.id}`, role: 'user', content: item.idea_text },
                      { id: `recent-assistant-${item.id}`, role: 'assistant', content: '저장된 분석 결과입니다.', evaluation: item.result },
                    ]);
                  }
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

          <section className="flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-xl border border-outline-soft bg-white shadow-sm">
            <div className="border-b border-outline-soft p-5 md:p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Idea Chat
              </div>
              <h1 className="text-3xl font-black text-ink md:text-[36px]">내 아이디어 평가받기</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">채팅하듯 아이디어를 입력하면 분석 결과를 바로 대화창에 정리합니다.</p>
            </div>

            <div className="flex min-h-[560px] flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto bg-surface-lowest p-5 md:p-6">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'assistant' && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white"><Bot className="h-4 w-4" /></div>}
                    <div className={`max-w-[780px] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${message.role === 'user' ? 'bg-ink text-white' : 'border border-outline-soft bg-white text-ink'}`}>
                      <p>{message.content}</p>
                      {message.evaluation && <EvaluationBubble evaluation={message.evaluation} />}
                    </div>
                    {message.role === 'user' && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white"><UserCircle className="h-4 w-4" /></div>}
                  </div>
                ))}
              </div>

              <div className="border-t border-outline-soft bg-white p-4">
                <div className="rounded-2xl border border-outline-soft bg-surface-lowest p-2 transition-all focus-within:border-brand-primary focus-within:ring-4 focus-within:ring-brand-primary/10">
                  <textarea
                    value={idea}
                    onChange={(event) => setIdea(event.target.value)}
                    placeholder="예: 매일 뉴스레터를 요약해서 슬랙으로 보내주는 봇을 만들고 싶어요."
                    className="min-h-24 w-full resize-none bg-transparent px-3 py-2 text-sm leading-7 text-ink outline-none placeholder:text-muted/60"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void handleSubmit();
                    }}
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-outline-soft/70 px-2 pt-2">
                    <span className="text-xs text-muted">Cmd/Ctrl + Enter로 분석</span>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={!idea.trim() || status === 'saving'}
                    >
                      <Send className="h-4 w-4" />
                      {status === 'saving' ? '생각 중' : '보내기'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function EvaluationBubble({ evaluation }: { evaluation: IdeaEvaluationResult }) {
  return (
    <div className="mt-4 space-y-4 border-t border-outline-soft pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-brand-primary">{evaluation.score}</div>
        <div className="pb-1 text-sm font-bold text-muted">/ 100 · {evaluation.difficulty}</div>
      </div>
      <p className="text-sm leading-7 text-muted">{evaluation.verdict}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-surface p-3">
          <div className="text-xs font-bold text-muted">포트폴리오 가치</div>
          <p className="mt-1 text-sm leading-6">{evaluation.portfolio_value}</p>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <div className="text-xs font-bold text-muted">시장성</div>
          <p className="mt-1 text-sm leading-6">{evaluation.market_fit}</p>
        </div>
      </div>
      <div>
        <div className="text-xs font-bold text-muted">추천 스택</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {evaluation.recommended_stack.map((stack) => <span key={stack} className="rounded-full border border-outline-soft bg-white px-2.5 py-1 text-xs font-semibold text-muted">{stack}</span>)}
        </div>
      </div>
      <div>
        <div className="text-xs font-bold text-muted">다음 단계</div>
        <ul className="mt-2 space-y-2">
          {evaluation.next_steps.slice(0, 5).map((step) => (
            <li key={step} className="flex gap-2 text-sm leading-6 text-muted">
              <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-primary" />
              {step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
