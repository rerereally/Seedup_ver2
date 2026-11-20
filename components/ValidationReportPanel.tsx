'use client';

import { useLang } from '@/components/LangProvider';
import MarkdownContent from '@/components/MarkdownContent';
import WatchIdeaButton from '@/components/WatchIdeaButton';
import { translator } from '@/lib/i18n';
import type { IdeaClarity } from '@/lib/opportunities/questions';
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

export default function ValidationReportPanel({ idea, isLoggedIn, onComplete, onUseIdea }: { idea: string; isLoggedIn: boolean; onComplete: () => void; onUseIdea?: (idea: string) => void }) {
  const lang = useLang();
  const t = translator(lang);
  const active = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [clarity, setClarity] = useState<IdeaClarity | null>(null);
  const text = idea.trim();
  useEffect(() => () => active.current?.abort(), []);

  // A hint only: a vague idea makes vague search phrases, so say what is missing before a report spends a search.
  useEffect(() => {
    if (text.length < 4) return;
    const controller = new AbortController();
    fetch('/api/ideas/clarity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea: text, lang }), signal: controller.signal })
      .then((response) => response.json())
      .then((body: { clarity?: IdeaClarity | null }) => setClarity(body.clarity ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [text, lang]);
  const parts = { who: t('누가 겪는 문제인지', 'who has the problem'), problem: t('어떤 문제인지', 'what the problem is'), how: t('어떻게 푸는지', 'how it solves it') };
  const vague = Boolean(clarity?.missing.length) && !report;

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
      {vague && clarity && (
        <div className="mt-4 rounded-xl border border-outline-soft bg-surface-low p-4 text-sm leading-6">
          <p className="text-ink">{t(`아이디어에 ${clarity.missing.map((part) => parts[part]).join(', ')}가 빠져 있습니다. 이대로면 원문 검색이 흐려질 수 있습니다.`, `The idea leaves out ${clarity.missing.map((part) => parts[part]).join(', ')}, so the source search may be vague.`)}</p>
          {clarity.suggestion && <>
            <p className="mt-2 text-muted">{t('예', 'For example')}: {clarity.suggestion}</p>
            {onUseIdea && <button type="button" className="btn-quiet mt-3 h-9 px-3 text-sm" onClick={() => onUseIdea(clarity.suggestion)}>{t('이 문장으로 바꾸기', 'Use this sentence')}</button>}
          </>}
        </div>
      )}
      {!isLoggedIn ? (
        <Link href={`/login?next=${encodeURIComponent(`/prd/validate?idea=${encodeURIComponent(text)}`)}`} className="btn mt-4 h-11 px-5">{t('로그인하고 검증하기', 'Sign in to validate')}</Link>
      ) : (
        <button type="button" className="btn mt-4 h-11 px-5" onClick={() => void run()} disabled={loading || text.length < 4}>
          {loading ? <><Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />{t('원문을 찾는 중', 'Searching sources')}</>
            : report ? t('다시 만들기', 'Run again') : vague ? t('그대로 검증하기', 'Validate as written') : t('검증 리포트 만들기', 'Create validation report')}
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
