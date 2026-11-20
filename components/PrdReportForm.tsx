'use client';

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { REPORT_NOTE_LIMIT, REPORT_REASONS } from '@/lib/opportunities/prd-report-input';

export default function PrdReportForm({ id }: { id: string }) {
  const t = translator(useLang());
  const reasonId = useId();
  const noteId = useId();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'rate-limit' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending' || status === 'sent') return;
    const data = new FormData(event.currentTarget);
    setStatus('sending');
    const response = await fetch(`/api/spec/${id}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: data.get('reason'), note: data.get('note') }),
    }).catch(() => null);
    setStatus(response?.ok ? 'sent' : response?.status === 429 ? 'rate-limit' : 'error');
  }

  return (
    <details className="min-w-0 max-w-xs">
      <summary className="w-fit cursor-pointer rounded-lg px-2 py-2 text-sm text-muted hover:text-ink focus-visible:outline">{t('신고', 'Report')}</summary>
      {status === 'sent' ? <p className="mt-2 text-sm" role="status">{t('신고를 접수했습니다.', 'Report received.')}</p> : (
        <form className="mt-2 grid gap-2 text-sm" onSubmit={submit}>
          <label htmlFor={reasonId}>{t('신고 이유', 'Reason for reporting')}</label>
          <select id={reasonId} name="reason" required defaultValue="" className="min-h-9 rounded-lg border border-outline-soft bg-white px-2">
            <option value="" disabled>{t('이유를 골라 주세요', 'Choose a reason')}</option>
            {Object.entries(REPORT_REASONS).map(([key, labels]) => <option key={key} value={key}>{t(labels[0], labels[1])}</option>)}
          </select>
          <label htmlFor={noteId}>{t('한 줄 설명', 'Brief explanation')}</label>
          <input id={noteId} name="note" required maxLength={REPORT_NOTE_LIMIT} className="min-h-9 min-w-0 rounded-lg border border-outline-soft bg-white px-2" />
          <button type="submit" className="btn-quiet h-9 w-fit" disabled={status === 'sending'}>
            {status === 'sending' ? t('보내는 중', 'Sending') : t('신고 보내기', 'Send report')}
          </button>
          {(status === 'rate-limit' || status === 'error') && <p role="alert" className="text-red-700">{status === 'rate-limit'
            ? t('잠시 뒤 다시 신고해 주세요.', 'Wait a minute and try again.')
            : t('신고를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'Could not send the report. Try again shortly.')}</p>}
        </form>
      )}
    </details>
  );
}
