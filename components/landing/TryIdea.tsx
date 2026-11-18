'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import type { ReactNode } from 'react';
import type { PoolItem } from '@/components/IdeaWorkspace';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { matchOpportunities } from '@/lib/opportunities/match';
import { PLATFORM_LABELS } from '@/lib/opportunities/types';

const MAX_PROBLEMS = 3;
const MAX_QUOTES = 4;

/**
 * The hero's "try it now": while the visitor types an idea, the same local matcher the PRD workspace uses picks today's
 * problems, and their real quotes open up under the box. No account, no server call. The button carries the
 * idea on to the workspace.
 */
export default function TryIdea({ pool, examples, head, note }: { pool: PoolItem[]; examples: Array<{ label: string; idea: string }>; head: ReactNode; note: ReactNode }) {
  const t = translator(useLang());
  const router = useRouter();
  const [text, setText] = useState('');
  const query = useDeferredValue(text);
  const match = matchOpportunities(query, pool);
  const problems = match.slugs.map((slug) => pool.find((item) => item.slug === slug)).filter((item): item is PoolItem => Boolean(item)).slice(0, MAX_PROBLEMS);
  const quotes = problems.flatMap((item) => item.quotes.slice(0, 2).map((quote) => ({ ...quote, problem: item }))).slice(0, MAX_QUOTES);
  const go = () => {
    const idea = text.trim();
    if (!idea) return document.getElementById('hero-try')?.focus();
    router.push(`/prd/new?idea=${encodeURIComponent(idea.slice(0, 300))}`);
  };

  return (
    <div className="relative mx-auto w-full max-w-[1280px] px-5 pb-10 pt-16 text-center sm:px-6 md:px-8 lg:pt-28">
      {head}
      <form onSubmit={(event) => { event.preventDefault(); go(); }} className="rise mx-auto flex max-w-[46rem] items-end gap-2 rounded-2xl border border-field bg-white p-2 text-left shadow-[0_16px_48px_-16px_var(--color-glow)] transition-[border-color,box-shadow] duration-300 focus-within:border-seed focus-within:shadow-[0_0_0_4px_var(--color-glow),0_16px_48px_-16px_var(--color-glow)]" style={{ animationDelay: '240ms' }}>
        <label htmlFor="hero-try" className="sr-only">{t('만들고 싶은 것', 'What you want to build')}</label>
        <textarea
          id="hero-try"
          rows={1}
          value={text}
          maxLength={300}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Korean input commits on Enter too; sending mid-composition would cut the last syllable.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              go();
            }
          }}
          placeholder={t('만들고 싶은 것을 적어 보세요. 예: GIF 검색 API', 'Type what you want to build, e.g. a GIF search API')}
          className="block max-h-40 min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[17px] leading-7 text-ink outline-none [field-sizing:content] placeholder:text-muted"
        />
        <button type="submit" className="btn h-12 shrink-0 px-5 text-[15px]">{t('PRD 만들기', 'Make the PRD')}</button>
      </form>
      <ul className="rise examples mt-3 justify-center" style={{ animationDelay: '320ms' }} aria-label={t('예시 아이디어', 'Example ideas')}>
        <li aria-hidden="true">{t('예시', 'Try')}</li>
        {examples.map((example) => (
          <li key={example.idea}>
            <button type="button" onClick={() => setText(example.idea)} className="example">{example.label}</button>
          </li>
        ))}
      </ul>
      <div className="rise" style={{ animationDelay: '400ms' }}>{note}</div>

      {/* While typing, what developers already said about this idea opens up under the box. */}
      <div className="mx-auto max-w-[60rem] text-left" aria-live="polite">
        {match.active && (
          <section className="stage-in mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold">{t('이 아이디어에 대해 개발자들이 쓴 글', 'What developers wrote about this idea')}</h2>
              {problems.length > 0 && <span className="text-[13px] font-semibold text-seed">{t(`문제 ${problems.length}개`, `${problems.length} problems`)}</span>}
            </div>
            {quotes.length ? (
              <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                {quotes.map((row, index) => (
                  <li key={row.id} className="stage-in rounded-xl border border-outline-soft bg-white p-5" style={{ animationDelay: `${index * 70}ms` }}>
                    <q lang="en" className="block text-[15px] leading-6 text-ink">{row.quote}</q>
                    <p className="mt-2 flex flex-wrap gap-x-3 text-[12.5px] text-muted">
                      <span>{PLATFORM_LABELS[row.platform]}</span>
                      <Link href={`/opportunities/${row.problem.slug}`} className="min-w-0 truncate underline-offset-4 hover:text-ink hover:underline">{row.problem.name}</Link>
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-seed underline-offset-4 hover:underline">{t('원문', 'Source')}</a>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[15px] leading-7 text-tertiary">{t('오늘 모아 둔 글에서는 아직 같은 불만을 찾지 못했습니다. PRD 만들기를 누르면 웹에서 원문을 더 찾아봅니다.', 'Nothing in today’s collected posts matches yet. Press Make the PRD and the workspace searches the web for more.')}</p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">{t('로그인 없이 초안까지 만들 수 있어요', 'Drafts need no account')}</span>
              <button type="button" onClick={go} className="link-seed">{t('이걸로 PRD 만들기', 'Make a PRD from this')}</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** The closing band's one action: back up to the hero's box, ready to type. */
export function StartAgain({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="btn h-12 px-6 text-[15px]"
      onClick={() => {
        const box = document.getElementById('hero-try');
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        box?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        box?.focus({ preventScroll: true });
      }}
    >
      {label}
    </button>
  );
}
