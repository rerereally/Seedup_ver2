'use client';

import { Bot, Loader2, Send } from 'lucide-react';
import { useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function ArticleAssistant({
  title,
  summary,
  content,
}: {
  title: string;
  summary: string | null;
  content: string | null;
}) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '본문에서 이해되지 않는 부분이나 더 알고 싶은 내용을 질문해보세요.',
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
    const history = messages
      .filter((message, index) => index > 0)
      .slice(-4)
      .map(({ role, content }) => ({ role, content }));

    let response: Response;
    try {
      response = await fetch('/api/articles/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, summary, content, question: nextQuestion, history }),
      });
    } catch {
      setStatus('error');
      return;
    }

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
      },
    ]);
    setStatus('idle');
  };

  return (
    <section className="overflow-hidden border border-outline-soft bg-white">
      <div className="flex items-center justify-between border-b border-outline-soft px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-ink">
          <span className="flex h-8 w-8 items-center justify-center bg-ink text-white">
            <Bot className="h-4 w-4" />
          </span>
          글 도우미
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">본문 질문</span>
      </div>

      {!hasConversation && <div className="px-4 py-4">
        <p className="text-sm leading-6 text-muted">본문에서 이해되지 않는 부분이나 더 알고 싶은 내용을 질문해보세요.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['이 글 쉽게 설명해줘', '핵심 기술이 뭐야?'].map((preset) => (
            <button key={preset} type="button" onClick={() => ask(preset)} className="inline-flex min-h-10 items-center border border-outline-soft bg-surface px-3 text-xs font-bold text-muted transition-colors hover:border-ink hover:bg-white hover:text-ink">
              {preset}
            </button>
          ))}
        </div>
      </div>}

      {hasConversation && (
        <div className="max-h-[min(58dvh,34rem)] min-h-72 space-y-3 overflow-y-auto border-t border-outline-soft bg-surface px-4 py-5">
          {messages.slice(-3).map((message, index) => (
            <div key={`${message.role}-${index}`} className={`max-w-[92%] px-3 py-2.5 text-sm leading-6 ${message.role === 'assistant' ? 'border border-outline-soft bg-white text-muted' : 'ml-auto bg-ink text-white'}`}>
              {message.content}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-outline-soft p-4">
        <label htmlFor="article-question" className="sr-only">본문에 대해 질문하기</label>
        <div className="border border-outline-soft bg-surface p-2 focus-within:border-ink">
        <textarea
          id="article-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void ask();
            }
          }}
          placeholder="본문에 대해 질문하기"
          aria-label="본문에 대해 질문하기"
          className="h-28 w-full resize-none bg-transparent p-2 text-sm leading-6 text-ink outline-none placeholder:text-muted/60"
        />
        <div className="flex items-center justify-end gap-2 border-t border-outline-soft/70 pt-2">
          <button
            type="button"
            onClick={() => ask()}
            disabled={!question.trim() || status === 'loading'}
            className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            질문
          </button>
        </div>
        </div>
      </div>
      {status === 'error' && (
        <div className="border-t border-outline-soft bg-surface px-4 py-3">
          <p className="text-xs font-semibold text-muted">답변 생성에 실패했습니다.</p>
          {lastQuestion && (
            <button type="button" onClick={() => ask(lastQuestion)} className="mt-2 border border-outline-soft bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink">
              다시 시도
            </button>
          )}
        </div>
      )}
    </section>
  );
}
