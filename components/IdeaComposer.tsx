'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ViewTransition, useState } from 'react';
import { GitBranch, Lightbulb } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

const MAX = 300;

/**
 * The place a PRD starts: a writing box, not a sign-up field. Two ways in sit above it (an idea, an existing repo);
 * problems that passed the bar are listed under it by the pages that use it.
 */
export default function IdeaComposer({ onSubmit, autoFocus = false, compact = false, id = 'idea-composer-input', placeholder, examples = [] }: { onSubmit?: (idea: string) => void; autoFocus?: boolean; compact?: boolean; id?: string; placeholder?: string; examples?: Array<{ label: string; idea: string }> }) {
  const t = translator(useLang());
  const router = useRouter();
  const [text, setText] = useState('');
  const send = () => {
    const idea = text.trim().slice(0, MAX);
    if (idea.length < 4) {
      document.getElementById(id)?.focus();
      return;
    }
    if (onSubmit) onSubmit(idea);
    else router.push(`/prd/new?idea=${encodeURIComponent(idea)}`);
  };

  const mode = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm transition-colors sm:px-3';
  return (
    <div className="w-full">
      {!compact && (
        // Two ways in. They sit above the box, so the box itself stays one field tall and reads as one field.
        <nav className="mb-3 flex" aria-label={t('시작 방법', 'How to start')}>
          <div className="inline-flex rounded-lg bg-surface-mid p-1">
            <span className={`${mode} bg-white font-semibold text-ink shadow-sm`} aria-current="page"><Lightbulb aria-hidden="true" className="hidden h-4 w-4 sm:block" />{t('아이디어', 'Idea')}</span>
            <Link href="/seeds" className={`${mode} text-tertiary hover:text-ink`}><GitBranch aria-hidden="true" className="hidden h-4 w-4 sm:block" />{t('레포 분석', 'Repo analysis')}</Link>
          </div>
        </nav>
      )}
      {/* The full box morphs into the workspace's title bar on the way to /prd/new (see IdeaWorkspace). */}
      <ViewTransition name={compact ? undefined : 'idea-box'} share="morph" default="none">
      <form
        // The button sits on the field's row, so the box stays one field tall and its border reads as the field's edge.
        className={`flex items-end gap-2 border border-field bg-white text-left transition-colors focus-within:border-ink ${compact ? 'rounded-xl p-2' : 'rounded-2xl p-3 shadow-[0_12px_40px_-12px_var(--color-glow)]'}`}
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
          placeholder={placeholder ?? t('예: 서비스 종료된 Tenor 대신 앱에 넣을 GIF 검색 API', 'e.g. A GIF search API to replace the shut-down Tenor')}
          className={`block min-w-0 flex-1 resize-none border-0 bg-transparent px-3 text-ink outline-none placeholder:text-muted ${compact ? 'max-h-40 min-h-11 py-2 text-[17px] leading-7 [field-sizing:content]' : 'min-h-20 py-2 text-[17px] leading-7'}`}
        />
        {/* Always live and labelled: an empty box sends the cursor back to the box instead of greying out the main action. */}
        <button type="submit" className="btn h-11 shrink-0 px-5 text-[15px]">{t('PRD 만들기', 'Make the PRD')}</button>
      </form>
      </ViewTransition>
      {!compact && (
        <p className="mt-3 flex items-baseline justify-between gap-4 px-1 text-left text-[14px] text-muted">
          <span>{t('Enter로 시작, Shift+Enter로 줄바꿈', 'Enter to start, Shift+Enter for a new line')}</span>
          <span className="num shrink-0">{text.length}/{MAX}</span>
        </p>
      )}
      {examples.length > 0 && (
        <ul className="examples mt-2 px-1" aria-label={t('예시 아이디어', 'Example ideas')}>
          <li aria-hidden="true">{t('예시', 'Try')}</li>
          {examples.map((example) => (
            <li key={example.idea}>
              <button type="button" onClick={() => { setText(example.idea); document.getElementById(id)?.focus(); }} title={example.idea} className="example">{example.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
