'use client';

import { Loader2, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
  const [errorMessage, setErrorMessage] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastQuestion = messages.filter((message) => message.role === 'user').at(-1)?.content;
  const hasConversation = messages.some((message) => message.role === 'user');

  useEffect(() => () => controllerRef.current?.abort(), []);

  const ask = async (preset?: string) => {
    const nextQuestion = (preset ?? question).trim();
    if (!nextQuestion || status === 'loading') return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    setErrorMessage('');
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
        signal: controller.signal,
        body: JSON.stringify({ title, summary, content, question: nextQuestion, history }),
      });
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : '요청을 보내지 못했습니다.');
      setStatus('error');
      return;
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      if (requestId !== requestIdRef.current) return;
      setErrorMessage(typeof errorBody?.error === 'string' ? errorBody.error : '답변 생성에 실패했습니다.');
      setStatus('error');
      return;
    }

    const json = await response.json();
    if (requestId !== requestIdRef.current) return;
    if (typeof json.answer !== 'string' || !json.answer.trim()) {
      setErrorMessage('글 도우미가 비어 있는 답변을 반환했습니다.');
      setStatus('error');
      return;
    }
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: json.answer.trim(),
      },
    ]);
    setStatus('idle');
  };

  return (
    <section className="card overflow-hidden">
      <div className="px-5 pt-5">
        <h2 className="text-[17px] font-bold text-ink">이 글에 대해 묻기</h2>
        {!hasConversation && <p className="mt-1 text-sm leading-6 text-muted">이해되지 않는 부분을 물어보세요. 이 글의 본문 안에서만 답합니다.</p>}
      </div>

      {!hasConversation && (
        <div className="flex flex-wrap gap-2 px-5 pt-3">
          {['이 글 쉽게 설명해줘', '핵심 기술이 뭐야?'].map((preset) => (
            <button key={preset} type="button" onClick={() => ask(preset)} className="inline-flex min-h-9 items-center rounded-full border border-outline-soft px-3.5 text-[13px] text-ink transition-colors hover:border-outline-strong">
              {preset}
            </button>
          ))}
        </div>
      )}

      {hasConversation && (
        <div className="mt-4 max-h-[min(58dvh,34rem)] min-h-56 space-y-3 overflow-y-auto border-t border-outline-soft px-5 py-5">
          {messages.slice(-3).map((message, index) => (
            <div key={`${message.role}-${index}`} className={`max-w-[92%] text-sm leading-6 ${message.role === 'assistant' ? 'text-ink' : 'ml-auto w-fit rounded-[18px] rounded-br-md bg-surface-high px-3.5 py-2 text-ink'}`}>
              {message.content}
            </div>
          ))}
        </div>
      )}

      <div className="p-5">
        <label htmlFor="article-question" className="sr-only">본문에 대해 질문하기</label>
        <div className="rounded-2xl border border-outline-soft transition-colors focus-within:border-ink">
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
            className="block h-24 w-full resize-none rounded-none border-0 bg-transparent px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-muted/60"
            style={{ outline: 'none' }}
          />
          <div className="flex items-center justify-end px-2 pb-2">
            <button type="button" onClick={() => ask()} disabled={!question.trim() || status === 'loading'} className="btn h-9 px-3.5 disabled:cursor-not-allowed disabled:opacity-40">
              {status === 'loading' ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Send aria-hidden="true" className="h-3.5 w-3.5" />}
              질문
            </button>
          </div>
        </div>
      </div>
      {status === 'error' && (
        <div className="border-t border-outline-soft px-5 py-4">
          <p className="text-[13px] text-muted">{errorMessage || '답변을 만들지 못했습니다.'}</p>
          {lastQuestion && <button type="button" onClick={() => ask(lastQuestion)} className="btn-quiet mt-2 h-9 px-3.5">다시 시도</button>}
        </div>
      )}
    </section>
  );
}
