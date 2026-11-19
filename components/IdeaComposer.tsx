'use client';

import { useRouter } from 'next/navigation';
import { ViewTransition, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUp, FileText, GitBranch, Lightbulb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import ModelPicker from '@/components/ModelPicker';
import { translator } from '@/lib/i18n';
import type { PrdModel } from '@/lib/opportunities/models';

const MAX = 300;

export type ComposerKind = 'prd' | 'validate' | 'repo';

/** The heading, line and examples a start screen shows for each tool, so the page says what the switch picked. */
export type ComposerIntro = Record<ComposerKind, { title: string; lead: string; examples?: Array<{ label: string; idea: string }>; after?: ReactNode }>;

// What the box does, picked like a model: each opens its own work screen under /prd. [kind, ko, en, icon]
const KINDS: Array<[ComposerKind, string, string, LucideIcon]> = [
  ['prd', 'PRD 만들기', 'Make a PRD', FileText],
  ['validate', '아이디어 검증', 'Validate an idea', Lightbulb],
  ['repo', '레포 분석', 'Analyze a repo', GitBranch],
];

/** The work screen for what was typed. */
export function composerHref(kind: ComposerKind, text: string) {
  if (kind === 'validate') return `/prd/validate?idea=${encodeURIComponent(text)}`;
  if (kind === 'repo') return `/prd/repo?user=${encodeURIComponent(text)}`;
  return `/prd/new?idea=${encodeURIComponent(text)}`;
}

/**
 * The place every /prd tool starts: a writing box, not a sign-up field. A switch above it picks what the box does (a
 * PRD, an idea check, a repo analysis), the way a model is picked; sending opens that tool's chat-and-result screen.
 */
export default function IdeaComposer({ onSubmit, autoFocus = false, compact = false, center = false, id = 'idea-composer-input', placeholder, examples: baseExamples = [], models, initialKind = 'prd', intro, headingId }: { onSubmit?: (idea: string) => void; autoFocus?: boolean; compact?: boolean; center?: boolean; id?: string; placeholder?: string; examples?: Array<{ label: string; idea: string }>; models?: PrdModel[]; initialKind?: ComposerKind; intro?: ComposerIntro; headingId?: string }) {
  const t = translator(useLang());
  const router = useRouter();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<ComposerKind>(compact ? 'prd' : initialKind);
  const repo = kind === 'repo';
  const limit = repo ? 80 : MAX;
  const copy = compact ? undefined : intro?.[kind];
  const examples = copy?.examples ?? baseExamples;
  const send = () => {
    const value = text.trim().slice(0, limit);
    if (value.length < (repo ? 1 : 4)) {
      document.getElementById(id)?.focus();
      return;
    }
    // A caller's own handler is for the PRD only; the other tools always open their screen.
    if (onSubmit && kind === 'prd') onSubmit(value);
    else router.push(composerHref(kind, value));
  };
  const action = kind === 'validate' ? t('검증하기', 'Validate') : repo ? t('분석하기', 'Analyze') : t('PRD 만들기', 'Make the PRD');
  const hint = kind === 'validate'
    ? t('예: 데이터베이스마다 다른 CLI 명령을 하나로 묶는 도구', 'e.g. One CLI for every database')
    : repo ? t('GitHub 아이디나 주소. 예: torvalds', 'A GitHub login or URL, e.g. torvalds')
      : t('예: 서비스 종료된 Tenor 대신 앱에 넣을 GIF 검색 API', 'e.g. A GIF search API to replace the shut-down Tenor');

  const mode = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm transition-colors sm:px-3';
  return (
    <div className="w-full">
      {copy && (
        <div className="mb-8 text-center">
          <h1 id={headingId} className="t-section text-[clamp(30px,3.4vw,44px)]">{copy.title}</h1>
          <p className="t-lead mx-auto mt-3 max-w-[34em]">{copy.lead}</p>
        </div>
      )}
      {!compact && (
        // What the box does. It sits above the box, so the box itself stays one field tall and reads as one field.
        <div className={`mb-3 flex ${center ? 'justify-center' : ''}`}>
          <div role="radiogroup" aria-label={t('할 일', 'What to do')} className="inline-flex rounded-lg bg-surface-mid p-1">
            {KINDS.map(([key, ko, en, Icon]) => (
              <button key={key} type="button" role="radio" aria-checked={kind === key} onClick={() => { setKind(key); document.getElementById(id)?.focus(); }} className={`${mode} ${kind === key ? 'bg-white font-semibold text-ink shadow-sm' : 'text-tertiary hover:text-ink'}`}>
                <Icon aria-hidden="true" className="hidden h-4 w-4 sm:block" />{t(ko, en)}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* The full box morphs into the workspace's title bar on the way to /prd/new (see IdeaWorkspace). */}
      <ViewTransition name={compact ? undefined : 'idea-box'} share="morph" default="none">
      <form
        // The button sits on the field's row, so the box stays one field tall and its border reads as the field's edge.
        className={`flex items-end gap-2 border border-field bg-white text-left transition-colors focus-within:border-ink ${compact ? 'rounded-xl p-2' : 'rounded-2xl p-3 shadow-[0_12px_40px_-12px_var(--color-glow)]'}`}
        onSubmit={(event) => { event.preventDefault(); send(); }}
      >
        <label htmlFor={id} className="sr-only">{repo ? t('GitHub 아이디 또는 주소', 'GitHub login or URL') : t('만들고 싶은 것', 'What you want to build')}</label>
        <textarea
          id={id}
          rows={compact ? 1 : 3}
          value={text}
          maxLength={limit}
          autoFocus={autoFocus}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Korean input commits on Enter too; sending mid-composition would cut the last syllable.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={placeholder ?? hint}
          className={`block min-w-0 flex-1 resize-none border-0 bg-transparent px-3 text-ink outline-none placeholder:text-muted focus-visible:outline-none ${compact ? 'max-h-40 min-h-11 py-2 text-[17px] leading-7 [field-sizing:content]' : 'min-h-20 py-2 text-[17px] leading-7'}`}
        />
        {/* Always live and always green: an empty box sends the cursor back to the box instead of greying out the main action. */}
        {compact
          ? <button type="submit" className="btn h-11 shrink-0 px-5 text-[15px]">{t('PRD 만들기', 'Make the PRD')}</button>
          : <button type="submit" aria-label={action} title={action} className="btn h-11 w-11 shrink-0 rounded-full p-0"><ArrowUp aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} /></button>}
      </form>
      </ViewTransition>
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-left text-[14px] text-muted">
          <span>{repo ? t('공개 레포 가운데 최근 5개를 읽습니다', 'Reads the 5 most recent public repos') : t('Enter로 시작, Shift+Enter로 줄바꿈', 'Enter to start, Shift+Enter for a new line')}</span>
          {/* The model writes the PRD, so it is picked here only for the PRD. */}
          {kind === 'prd' && models && models.length > 1 ? <ModelPicker models={models} /> : <span className="num shrink-0">{text.length}/{limit}</span>}
        </div>
      )}
      {examples.length > 0 && !repo && (
        <ul className={`examples mt-2 px-1 ${center ? 'justify-center' : ''}`} aria-label={t('예시 아이디어', 'Example ideas')}>
          <li aria-hidden="true">{t('예시', 'Try')}</li>
          {examples.map((example) => (
            <li key={example.idea}>
              <button type="button" onClick={() => { setText(example.idea); document.getElementById(id)?.focus(); }} title={example.idea} className="example">{example.label}</button>
            </li>
          ))}
        </ul>
      )}
      {copy?.after && <div className="mt-4 flex justify-center">{copy.after}</div>}
    </div>
  );
}
