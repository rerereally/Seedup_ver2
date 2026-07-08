'use client';

import { ArrowRight, Bot, Lightbulb, Loader2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  projectPrompt?: string;
};

export default function ArticleAssistant({
  title,
  summary,
  content,
  projectIdea,
}: {
  title: string;
  summary: string | null;
  content: string | null;
  projectIdea: string | null;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '이 글에서 헷갈리는 점이나 프로젝트로 바꿔볼 방법을 짧게 물어보세요.',
      projectPrompt: projectIdea ? `${title}를 참고해서 "${projectIdea}" 아이디어를 평가하고 7일 빌드 플랜으로 정리해줘.` : undefined,
    },
  ]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const lastQuestion = messages.filter((message) => message.role === 'user').at(-1)?.content;
  const hasConversation = messages.some((message) => message.role === 'user');

  const ask = async (preset?: string) => {
    const nextQuestion = (preset ?? question).trim();
    if (!nextQuestion || status === 'loading') return;

    setStatus('loading');
    setQuestion('');
    setMessages((current) => [...current, { role: 'user', content: nextQuestion }]);

    const response = await fetch('/api/articles/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, summary, content, question: nextQuestion }),
    });

    if (!response.ok) {
      setStatus('error');
      return;
    }

    const json = await response.json();
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: json.answer ?? '답변을 만들지 못했습니다. 질문을 조금 더 구체적으로 적어주세요.',
        projectPrompt: json.project_prompt || undefined,
      },
    ]);
    setStatus('idle');
  };

  const goToIdeaEvaluation = (prompt?: string) => {
    const idea = prompt || projectIdea || `${title}를 바탕으로 만들 수 있는 프로젝트를 평가해줘.`;
    router.push(`/ideas?idea=${encodeURIComponent(idea)}`);
  };

  return (
    <div className="overflow-hidden border border-outline-soft bg-white">
      <div className="border-b border-outline-soft bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-ink">
          <span className="flex h-8 w-8 items-center justify-center border border-outline-soft bg-white text-ink">
            <Bot className="h-4 w-4" />
          </span>
          ARTICLE_ASSISTANT.TS
        </div>
      </div>

      {hasConversation ? (
        <div className="space-y-3 px-4 py-4">
          {messages.slice(-3).map((message, index) => (
            <div key={`${message.role}-${index}`} className={`border p-3 text-sm leading-6 ${message.role === 'assistant' ? 'border-outline-soft bg-surface text-muted' : 'border-ink bg-ink text-white'}`}>
              {message.content}
              {message.projectPrompt && (
                <button
                  type="button"
                  onClick={() => goToIdeaEvaluation(message.projectPrompt)}
                  className="mt-3 inline-flex items-center gap-1 border border-outline-soft bg-white px-3 py-1.5 text-xs font-bold text-ink"
                >
                  프로젝트로 평가하기
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border-b border-outline-soft px-4 py-4">
          <p className="text-sm font-semibold leading-6 text-muted">본문을 읽다가 막히는 부분만 짧게 물어보세요.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {['이 글 쉽게 설명해줘', '핵심 기술이 뭐야?', '프로젝트로 만들려면?'].map((preset) => (
          <button key={preset} type="button" onClick={() => ask(preset)} className="border border-outline-soft bg-surface px-3 py-1.5 text-xs font-bold text-muted hover:border-ink hover:text-ink">
            {preset}
          </button>
        ))}
      </div>

      <div className="mx-4 mb-4 border border-outline-soft bg-surface p-2">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="짧게 질문하기"
          className="h-20 w-full resize-none bg-transparent p-2 text-sm leading-6 text-ink outline-none placeholder:text-muted/60"
        />
        <div className="flex items-center justify-between gap-2 border-t border-outline-soft/70 pt-2">
          <button type="button" onClick={() => goToIdeaEvaluation()} className="inline-flex items-center gap-1 px-2 text-xs font-bold text-ink">
            <Lightbulb className="h-3.5 w-3.5" />
            프로젝트 연계
          </button>
          <button
            type="button"
            onClick={() => ask()}
            disabled={!question.trim() || status === 'loading'}
            className="inline-flex h-9 items-center gap-2 bg-ink px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            질문
          </button>
        </div>
      </div>
      {status === 'error' && (
        <div className="border-t border-outline-soft px-4 py-3">
          <p className="text-xs font-semibold text-muted">답변 생성에 실패했습니다.</p>
          {lastQuestion && (
            <button type="button" onClick={() => ask(lastQuestion)} className="mt-2 border border-outline-soft bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink">
              다시 시도
            </button>
          )}
        </div>
      )}
    </div>
  );
}
