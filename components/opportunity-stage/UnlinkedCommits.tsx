'use client';

import { useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import type { FeatureCommit } from '@/lib/opportunities/feature-commits';

export default function UnlinkedCommits({ commits }: { commits: Pick<FeatureCommit, 'id' | 'sha' | 'message' | 'files'>[] }) {
  const t = translator(useLang());
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const visible = commits.filter(({ id }) => !dismissed.includes(id));
  if (!visible.length) return null;

  async function dismiss(id: string) {
    setPending(id);
    setError(false);
    try {
      const response = await fetch('/api/opportunities/commits/dismiss', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }),
      });
      if (response.ok) setDismissed((ids) => [...ids, id]);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  }

  const label = t('기능 아님', 'Not a feature');
  return (
    <details className="mb-5 text-sm text-muted">
      <summary className="num cursor-pointer py-2">
        {t(`PRD 기능에 연결되지 않은 커밋 ${visible.length}개`, `${visible.length} ${visible.length === 1 ? 'commit' : 'commits'} without a PRD feature`)}
      </summary>
      {error && <p role="alert" className="py-2">{t('처리하지 못했습니다. 다시 시도해 주세요.', 'Could not dismiss the commit. Try again.')}</p>}
      <ul className="rows">
        {visible.map(({ id, sha, message, files }) => (
          <li key={id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <code>{sha}</code>
              {message && <p className="mt-1 whitespace-pre-wrap text-ink">{message}</p>}
              {files.length > 0 && <ul className="mt-1 text-[13px]">
                {files.map((file, index) => <li key={`${file}-${index}`}><code>{file}</code></li>)}
              </ul>}
            </div>
            <button type="button" className="btn-quiet shrink-0 max-sm:h-11" disabled={pending !== null} aria-label={`${label} (${sha})`} onClick={() => void dismiss(id)}>
              {pending === id ? t('처리 중', 'Dismissing') : label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
