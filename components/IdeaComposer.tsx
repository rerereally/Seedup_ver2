'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowUp, FileSearch, GitBranch, Lightbulb } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

const MAX = 300;

/**
 * The place a PRD starts: a writing box, not a sign-up field. Three ways in sit on its bottom bar (an idea, a problem
 * that passed the bar, an existing repo); the idea is typed here, the other two jump to where they start.
 */
export default function IdeaComposer({ onSubmit, autoFocus = false, compact = false, id = 'idea-composer-input', placeholder, examples = [] }: { onSubmit?: (idea: string) => void; autoFocus?: boolean; compact?: boolean; id?: string; placeholder?: string; examples?: Array<{ label: string; idea: string }> }) {
  const t = translator(useLang());
  const router = useRouter();
  const [text, setText] = useState('');
  const ready = text.trim().length >= 4;

  const send = () => {
    const idea = text.trim().slice(0, MAX);
    if (idea.length < 4) {
      document.getElementById(id)?.focus();
      return;
    }
    if (onSubmit) onSubmit(idea);
    else router.push(`/prd/new?idea=${encodeURIComponent(idea)}`);
  };

  const mode = 'inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm transition-colors';
  return (
    <div className="w-full">
      <form
        // Compact keeps the button on the field's row, so the box stays one field tall and its border reads as the field's edge.
        className={`border border-field bg-white text-left transition-colors focus-within:border-ink ${compact ? 'flex items-end gap-2 rounded-[18px] p-2' : 'rounded-[26px] p-3 shadow-[0_24px_70px_rgba(0,0,0,.07)] sm:p-4'}`}
        onSubmit={(event) => { event.preventDefault(); send(); }}
      >
        <label htmlFor={id} className="sr-only">{t('만들고 싶은 것', 'What you want to build')}</label>
        <textarea
          id={id}
          rows={compact ? 1 : 3}
          value={text}
          maxLength={MAX}
          autoFocus={autoFocus}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Korean input commits on Enter too; sending mid-composition would cut the last syllable.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={placeholder ?? t('예: 소상공인이 예약과 노쇼를 한곳에서 관리하는 웹', 'e.g. A web app for small shops to manage bookings and no-shows')}
          className={`block w-full resize-none border-0 bg-transparent px-3 py-2 text-ink outline-none placeholder:text-muted ${compact ? 'max-h-40 min-h-11 min-w-0 flex-1 py-2 text-[17px] leading-7 [field-sizing:content]' : 'min-h-24 text-[18px] leading-8'}`}
        />
        {compact ? (
          // Always live: an empty box sends the cursor back to the box instead of greying out the page's main action.
          <button type="submit" className="btn h-11 shrink-0 px-5 text-[15px]">{t('PRD 만들기', 'Make the PRD')}</button>
        ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl bg-surface-mid p-1" role="group" aria-label={t('시작 방법', 'How to start')}>
            <span className={`${mode} bg-white font-medium text-ink shadow-sm`} aria-current="true"><Lightbulb aria-hidden="true" className="h-4 w-4" />{t('아이디어', 'Idea')}</span>
            <Link href="/prd#verified" className={`${mode} text-tertiary hover:text-ink`}><FileSearch aria-hidden="true" className="h-4 w-4" />{t('검증된 문제', 'Verified problem')}</Link>
            <Link href="/seeds" className={`${mode} text-tertiary hover:text-ink`}><GitBranch aria-hidden="true" className="h-4 w-4" />{t('내 저장소', 'My repo')}</Link>
          </div>
          <span className="num ml-auto pr-1 text-sm text-muted">{text.length}/{MAX}</span>
          <button type="submit" disabled={!ready} aria-label={t('PRD 만들기 시작', 'Start the PRD')} className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-high disabled:text-muted">
            <ArrowUp aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        )}
      </form>
      {examples.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('예시 아이디어', 'Example ideas')}>
          {examples.map((example) => (
            <li key={example.idea}>
              <button type="button" onClick={() => { setText(example.idea); document.getElementById(id)?.focus(); }} title={example.idea} className="min-h-11 whitespace-nowrap rounded-full border border-outline-soft px-3.5 text-[14px] text-tertiary transition-colors hover:border-outline-strong hover:text-ink">{example.label}</button>
            </li>
          ))}
        </ul>
      )}
      {!compact && <p className="mt-4 text-center text-[15px] text-muted">{t('한 줄만 적으면 질문을 주고받으며 초안을 만들고, 실제 개발자 원문으로 근거를 붙입니다.', 'Write one line; a short Q&A builds the draft and real developer quotes back it.')}</p>}
    </div>
  );
}
