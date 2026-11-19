'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { translator } from '@/lib/i18n';
import { FIT_TIMES, MAX_STACK_ITEM_LENGTH, normalizeFitStack } from '@/lib/opportunities/fit';
import type { FitChoice } from '@/lib/opportunities/fit';
import { savedRepoLanguages, SEEDS_RESULT_KEY } from '@/lib/seeds/saved';

export default function OpportunityFitControls({ choice, defaultHref, fitHref, useRepoStack, lang }: {
  choice: FitChoice;
  defaultHref: string;
  fitHref: string;
  useRepoStack: boolean;
  lang: 'ko' | 'en';
}) {
  const t = translator(lang);
  const router = useRouter();
  const id = useId();
  const [stack, setStack] = useState(choice.stack);
  const [input, setInput] = useState('');
  const add = () => {
    setStack(normalizeFitStack([...stack, input]));
    setInput('');
  };

  return (
    <div className="grid justify-items-start gap-3">
      <nav className="seg" aria-label={t('정렬', 'Sort order')}>
        <Link href={defaultHref} scroll={false} aria-current={choice.enabled ? undefined : 'page'}>{t('원문 많은 순', 'Most evidence')}</Link>
        <Link href={fitHref} scroll={false} aria-current={choice.enabled ? 'page' : undefined} onNavigate={(event) => {
          if (!useRepoStack) return;
          let languages: string[];
          try {
            languages = normalizeFitStack(savedRepoLanguages(localStorage.getItem(SEEDS_RESULT_KEY)));
          } catch {
            return; // Blocked or stale browser storage should leave the manual editor available.
          }
          if (!languages.length) return;
          event.preventDefault();
          const url = new URL(fitHref, window.location.origin);
          url.searchParams.set('stack', languages.join(','));
          router.push(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
        }}>{t('나에게 맞는 순서', 'Best fit for me')}</Link>
      </nav>

      {choice.enabled && (
        <form className="flex w-full flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border border-outline-soft p-4" onSubmit={(event) => {
          event.preventDefault();
          const url = new URL(fitHref, window.location.origin);
          const values = new FormData(event.currentTarget);
          const nextStack = normalizeFitStack([...stack, input]);
          url.searchParams.set('stack', nextStack.join(','));
          url.searchParams.set('time', String(values.get('time')));
          setStack(nextStack);
          setInput('');
          router.push(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
        }}>
          <div className="grid min-w-0 flex-1 basis-56 gap-1.5">
            <label htmlFor={`${id}-stack`} className="text-[13px] font-semibold">{t('내 기술 스택', 'My stack')}</label>
            {stack.length > 0 && <ul className="flex flex-wrap gap-1.5" aria-label={t('선택한 기술', 'Selected technologies')}>
              {stack.map((name) => <li key={name} className="chip max-w-full gap-1">
                <span className="break-all text-[13px]">{name}</span>
                <button type="button" className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm hover:bg-surface-high" aria-label={t(`${name} 삭제`, `Remove ${name}`)} onClick={() => setStack(stack.filter((item) => item !== name))}>×</button>
              </li>)}
            </ul>}
            <div className="flex gap-2">
              <input id={`${id}-stack`} value={input} maxLength={MAX_STACK_ITEM_LENGTH} placeholder="Next.js, Python" className="h-10 min-w-0 flex-1 rounded-lg border border-outline-strong bg-white px-3 text-sm placeholder:text-muted" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing || !input.trim()) return;
                event.preventDefault();
                add();
              }} />
              <button type="button" className="btn-quiet shrink-0" onClick={add} disabled={!input.trim()}>{t('추가', 'Add')}</button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-time`} className="text-[13px] font-semibold">{t('쓸 수 있는 시간', 'Time available')}</label>
            <select id={`${id}-time`} name="time" defaultValue={choice.time} className="h-10 rounded-lg border border-outline-strong bg-white px-3 text-sm">
              {FIT_TIMES.map(({ value, label }) => <option key={value} value={value}>{label[lang === 'en' ? 1 : 0]}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-quiet">{t('적용', 'Apply')}</button>
        </form>
      )}
    </div>
  );
}
