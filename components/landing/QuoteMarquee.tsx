'use client';

import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

/** Real quotes drifting past under the hero. Hover, focus or the button stops it; reduced motion shows it still (globals.css). */
export default function QuoteMarquee({ quotes }: { quotes: Array<{ id: string; text: string; source: string }> }) {
  const t = translator(useLang());
  const [paused, setPaused] = useState(false);
  const row = (copy: boolean) => (
    <ul className="flex shrink-0 gap-3 pr-3" aria-hidden={copy || undefined}>
      {quotes.map((quote) => (
        <li key={quote.id} className="w-[22rem] shrink-0 rounded-xl border border-outline-soft bg-white px-5 py-4">
          <q lang="en" className="line-clamp-2 text-[14px] leading-6 text-ink">{quote.text}</q>
          <p className="mt-2 text-[12.5px] text-muted">{quote.source}</p>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee relative ${paused ? 'is-paused' : ''}`}>
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
        <div className="marquee-track flex w-max">{row(false)}{row(true)}</div>
      </div>
      <button
        type="button"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? t('원문 흐름 다시 재생', 'Play the quotes') : t('원문 흐름 멈추기', 'Pause the quotes')}
        className="mx-auto mt-3 flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] text-muted transition-colors hover:bg-surface-low hover:text-ink"
      >
        {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
        {paused ? t('다시 재생', 'Play') : t('멈추기', 'Pause')}
      </button>
    </div>
  );
}
