'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

/** One shell command with a copy button. When the clipboard refuses, the command is already selectable text. */
export default function CopyCommand({ command }: { command: string }) {
  const t = translator(useLang());
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState('done');
    } catch {
      setState('failed');
    }
  };
  return (
    <div>
      <div className="flex min-h-12 items-center gap-2 rounded-[12px] bg-term-bg py-1.5 pl-4 pr-1.5 text-term-ink ring-1 ring-outline-soft">
        {/* Shown split before the address with a shell line continuation, so it never breaks inside the URL; the button copies one line. */}
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre py-1.5 font-mono text-[13px] leading-6 [scrollbar-width:none]"><span className="select-none text-term-muted">$ </span>{command.replace(/ (https?:\/\/)/, ' \\\n    $1')}</code>
        <button type="button" onClick={() => void copy()} aria-label={t('명령어 복사', 'Copy the command')} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] text-term-ink transition-colors hover:bg-term-ink/10">
          {state === 'done' ? <Check aria-hidden="true" className="h-4 w-4 text-term-seed" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
          {state === 'done' ? t('복사함', 'Copied') : t('복사', 'Copy')}
        </button>
      </div>
      <p className="mt-2 min-h-5 text-[13px] text-muted" aria-live="polite">{state === 'failed' ? t('복사하지 못했습니다. 명령어를 직접 선택해 복사하세요.', 'Could not copy. Select the command and copy it yourself.') : ''}</p>
    </div>
  );
}
