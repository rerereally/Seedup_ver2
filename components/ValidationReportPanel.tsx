'use client';

import { useLang } from '@/components/LangProvider';
import MarkdownContent from '@/components/MarkdownContent';
import WatchIdeaButton from '@/components/WatchIdeaButton';
import { translator } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Report = { markdown: string };

// Convert the report's plain source addresses into links named by their host.
const linkify = (markdown: string) => markdown.replace(/(^|\s)(https?:\/\/[^\s)]+)/g, (_, space: string, url: string) => {
  try {
    return `${space}[${new URL(url).hostname.replace(/^www\./, '')}](${url})`;
  } catch {
    return space + url;
  }
});

export default function ValidationReportPanel({ idea, isLoggedIn, onComplete }: { idea: string; isLoggedIn: boolean; onComplete: () => void }) {
  const lang = useLang();
  const t = translator(lang);
  const active = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const text = idea.trim();
  useEffect(() => () => active.current?.abort(), []);

  const run = async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/opportunities/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea: text, lang }), signal: controller.signal });
      const body = await response.json().catch(() => null) as (Report & { error?: string }) | null;
      if (controller.signal.aborted) return;
      if (!response.ok || !body?.markdown) {
        setError(body?.error ?? t('리포트를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'Could not make the report. Try again shortly.'));
        return;
      }
      setReport(body);
      onComplete();
    } catch {
      if (!controller.signal.aborted) setError(t('연결이 끊겼습니다. 잠시 뒤 다시 시도해 주세요.', 'The connection was interrupted. Try again shortly.'));
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <section aria-labelledby="validation-report" className="card p-6 md:p-7">
      <h2 id="validation-report" className="text-lg font-semibold text-ink">{t('검증 리포트', 'Validation report')}</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">{t('실패할 이유와 원문, 기존 도구, 첫 인터뷰 후보를 확인합니다. 하루 3번까지 실행할 수 있습니다.', 'Review what could go wrong, source quotes, competing tools, and potential interviewees. Up to three reports per day.')}</p>
      {!isLoggedIn ? (
        <Link href={`/login?next=${encodeURIComponent(`/prd/validate?idea=${encodeURIComponent(text)}`)}`} className="btn mt-4 h-11 px-5">{t('로그인하고 검증하기', 'Sign in to validate')}</Link>
      ) : (
        <button type="button" className="btn mt-4 h-11 px-5" onClick={() => void run()} disabled={loading || text.length < 4}>
          {loading ? <><Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />{t('원문을 찾는 중', 'Searching sources')}</>
            : report ? t('다시 만들기', 'Run again') : t('검증 리포트 만들기', 'Create validation report')}
        </button>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {report && (
        <div className="mt-6 border-t border-outline-soft pt-5">
          <MarkdownContent content={linkify(report.markdown.split('\n').slice(1).join('\n'))} />
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-outline-soft pt-5">
            <Link href={`/prd/new?idea=${encodeURIComponent(text)}`} className="btn h-10 px-4 text-sm">{t('이 아이디어로 PRD 만들기', 'Make a PRD from this idea')}</Link>
            <WatchIdeaButton idea={text} />
          </div>
        </div>
      )}
    </section>
  );
}
