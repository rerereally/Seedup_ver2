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
export default function IdeaComposer({ onSubmit, autoFocus = false }: { onSubmit?: (idea: string) => void; autoFocus?: boolean }) {
  const t = translator(useLang());
  const router = useRouter();
  const [text, setText] = useState('');
  const ready = text.trim().length >= 4;

  const send = () => {
    const idea = text.trim().slice(0, MAX);
    if (idea.length < 4) return;
    if (onSubmit) onSubmit(idea);
    else router.push(`/prd/new?idea=${encodeURIComponent(idea)}`);
  };

  const mode = 'inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm transition-colors';
  return (
    <div className="w-full">
      <form
        className="rounded-[26px] border border-outline-soft bg-white p-3 text-left shadow-[0_24px_70px_rgba(0,0,0,.07)] transition-colors focus-within:border-outline-strong sm:p-4"
        onSubmit={(event) => { event.preventDefault(); send(); }}
      >
        <label htmlFor="idea-composer-input" className="sr-only">{t('만들고 싶은 것', 'What you want to build')}</label>
        <textarea
          id="idea-composer-input"
          rows={3}
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
          placeholder={t('예: 소상공인이 예약과 노쇼를 한곳에서 관리하는 웹', 'e.g. A web app for small shops to manage bookings and no-shows')}
          className="block min-h-24 w-full resize-none border-0 bg-transparent px-3 py-2 text-[18px] leading-8 text-ink outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl bg-surface-mid p-1" role="group" aria-label={t('시작 방법', 'How to start')}>
            <span className={`${mode} bg-white font-medium text-ink shadow-sm`} aria-current="true"><Lightbulb aria-hidden="true" className="h-4 w-4" />{t('아이디어', 'Idea')}</span>
            <Link href="/prd#verified" className={`${mode} text-tertiary hover:text-ink`}><FileSearch aria-hidden="true" className="h-4 w-4" />{t('검증된 문제', 'Verified problem')}</Link>
            <Link href="/seeds" className={`${mode} text-tertiary hover:text-ink`}><GitBranch aria-hidden="true" className="h-4 w-4" />{t('내 저장소', 'My repo')}</Link>
          </div>
          <span className="num ml-auto pr-1 text-sm text-muted">{text.length}/{MAX}</span>
          <button type="submit" disabled={!ready} aria-label={t('PRD 만들기 시작', 'Start the PRD')} className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white transition-opacity hover:opacity-90 disabled:bg-surface-high disabled:text-muted">
            <ArrowUp aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </form>
      <p className="mt-4 text-center text-[15px] text-muted">{t('한 줄만 적으면 질문을 주고받으며 초안을 만들고, 실제 개발자 원문으로 근거를 붙입니다.', 'Write one line; a short Q&A builds the draft and real developer quotes back it.')}</p>
    </div>
  );
}
