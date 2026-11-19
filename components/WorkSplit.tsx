'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUp, Check, RotateCcw } from 'lucide-react';

export type Stage = { label: string; state: 'done' | 'now' | 'todo' };

/** Where the work stands, left to right, so the person always sees the next step. Shared by every /prd tool. */
export function Stages({ stages, label = '진행 단계' }: { stages: Stage[]; label?: string }) {
  return (
    <ol className="hidden min-w-0 flex-1 items-center gap-1 md:flex" aria-label={label}>
      {stages.map((stage, index) => (
        <li key={stage.label} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden="true" className="h-px w-4 bg-outline-strong" />}
          <span aria-current={stage.state === 'now' ? 'step' : undefined} className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] ${stage.state === 'now' ? 'bg-seed-soft font-semibold text-seed' : stage.state === 'done' ? 'text-ink' : 'text-muted'}`}>
            {stage.state === 'done' && <Check aria-hidden="true" className="h-3.5 w-3.5 text-seed" strokeWidth={2.5} />}
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

const SHOW = 'seedup-worksplit-show';

/** Opens the result side (the tab on phones) and scrolls to the element with this id: for buttons in the chat. */
export function showInResult(id: string) {
  window.dispatchEvent(new CustomEvent(SHOW, { detail: id }));
}

/** One line of the chat: the person's own words on the right, Seedup's plain text on the left. */
export function Bubble({ role, children, onEdit, editLabel }: { role: 'user' | 'assistant'; children: ReactNode; onEdit?: () => void; editLabel?: string }) {
  if (role === 'assistant') return <div className="text-[15px] leading-7 text-tertiary">{children}</div>;
  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-surface-mid px-4 py-2.5 text-[15px] leading-6 text-ink [overflow-wrap:anywhere]">{children}</div>
      {onEdit && <button type="button" onClick={onEdit} className="text-xs text-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100">{editLabel}</button>}
    </div>
  );
}

/**
 * The work screen every /prd tool opens into, the same frame as the PRD workspace (IdeaWorkspace): a bar on top,
 * the chat on the left and that tool's own result on the right. Phones see one side at a time.
 */
export default function WorkSplit({ title, stages, chat, composer, result, resultLabel, onReset }: { title: string; stages: Stage[]; chat: ReactNode; composer: ReactNode; result: ReactNode; resultLabel: string; onReset: () => void }) {
  const [pane, setPane] = useState<'chat' | 'result'>('chat');
  useEffect(() => {
    const show = (event: Event) => {
      setPane('result');
      const id = (event as CustomEvent<string>).detail;
      // After the result side is shown, so the element can be found on phones too.
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    };
    window.addEventListener(SHOW, show);
    return () => window.removeEventListener(SHOW, show);
  }, []);
  return (
    <div className="flex flex-col lg:h-dvh">
      <div className="flex min-h-14 items-center gap-4 border-b border-outline-soft bg-white px-4 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold md:hidden" title={title}>{title}</p>
        <Stages stages={stages} />
        <button type="button" onClick={onReset} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted hover:bg-surface-low hover:text-ink">
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />새로 시작
        </button>
      </div>

      <div className="sticky top-14 z-30 flex border-b border-outline-soft bg-white lg:hidden" role="tablist" aria-label="보기">
        {([['chat', '대화'], ['result', resultLabel]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={pane === key} onClick={() => setPane(key)} className="tab flex-1 justify-center">{label}</button>
        ))}
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <section aria-label="대화" className={`${pane === 'chat' ? 'flex' : 'hidden'} h-[calc(100dvh-10rem-env(safe-area-inset-bottom))] flex-col border-outline-soft bg-white lg:flex lg:h-auto lg:min-h-0 lg:border-r`}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6" aria-live="polite">{chat}</div>
          <div className="border-t border-outline-soft px-4 pb-4 pt-3">{composer}</div>
        </section>
        <section aria-label={resultLabel} className={`${pane === 'result' ? 'block' : 'hidden'} min-w-0 bg-white px-5 pb-28 pt-6 [scrollbar-width:thin] lg:block lg:overflow-y-auto lg:px-10 lg:pb-10`}>
          {result}
        </section>
      </div>
    </div>
  );
}

/** The chat's bottom box: one line to send, the same look as the PRD chat's answer box. */
export function ChatInput({ id, label, placeholder, onSend, disabled = false, maxLength = 300 }: { id: string; label: string; placeholder: string; onSend: (text: string) => void; disabled?: boolean; maxLength?: number }) {
  const [draft, setDraft] = useState('');
  const send = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft('');
  };
  return (
    <form className="flex items-end gap-2 rounded-xl border border-field bg-white p-2 focus-within:border-ink" onSubmit={(event) => { event.preventDefault(); send(); }}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        rows={1}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Korean input commits on Enter too; sending mid-composition would cut the last syllable.
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        className="max-h-36 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none [field-sizing:content] placeholder:text-muted"
      />
      <button type="submit" aria-label="보내기" disabled={!draft.trim() || disabled} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white disabled:cursor-not-allowed disabled:bg-surface-high disabled:text-muted">
        <ArrowUp aria-hidden="true" className="h-4 w-4" />
      </button>
    </form>
  );
}
