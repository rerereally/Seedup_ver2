'use client';

import MarkdownContent from '@/components/MarkdownContent';
import WatchIdeaButton from '@/components/WatchIdeaButton';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type Report = { markdown: string; verdict: { level: string } };

// The report is plain Markdown with bare addresses; the renderer links only [text](url), so each address becomes one, named by its site.
const linkify = (markdown: string) => markdown.replace(/(^|\s)(https?:\/\/[^\s)]+)/g, (_, space: string, url: string) => {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return '링크'; } })();
  return `${space}[${host}](${url})`;
});

/** The evidence-based check for one idea: real quotes, rival tools, build size and first users (POST /api/opportunities/report). */
export default function ValidationReportPanel({ idea, isLoggedIn }: { idea: string; isLoggedIn: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState('');
  const text = idea.trim();

  const run = async () => {
    setState('loading');
    setError('');
    const response = await fetch('/api/opportunities/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea: text }) }).catch(() => null);
    const body = await response?.json().catch(() => null) as (Report & { error?: string }) | null;
    if (!response?.ok || !body?.markdown) {
      setState('error');
      setError(body?.error ?? '리포트를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      return;
    }
    setReport(body);
    setChecked(text);
    setState('done');
  };

  return (
    <section aria-labelledby="validation-report" className="card p-6 md:p-7">
      <h2 id="validation-report" className="text-lg font-semibold text-ink">원문으로 검증하기</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">평가하기의 점수는 AI의 참고 의견이고, 검증 리포트는 GitHub 이슈, Hacker News, Stack Overflow에서 이 문제를 겪는 사람의 글을 찾아 원문과 글자 그대로 맞는 문장만 담고, 이미 있는 도구와 첫 사용자 후보를 함께 보여 줍니다. 1분 정도 걸리고 하루 3번까지 만들 수 있습니다.</p>
      {!isLoggedIn ? (
        <Link href="/login?next=/ideas" className="btn mt-4 h-11 px-5">로그인하고 검증 리포트 만들기</Link>
      ) : (
        <button type="button" className="btn mt-4 h-11 px-5" onClick={() => void run()} disabled={state === 'loading' || text.length < 4}>
          {state === 'loading' ? <><Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />원문을 찾는 중</> : state === 'done' && checked === text ? '다시 만들기' : '검증 리포트 만들기'}
        </button>
      )}
      {state === 'error' && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {state === 'done' && report && (
        <div className="mt-6 border-t border-outline-soft pt-5">
          {/* The first line repeats the idea as a title; this section already names it. */}
          <MarkdownContent content={linkify(report.markdown.split('\n').slice(1).join('\n'))} />
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-outline-soft pt-5">
            <Link href={`/prd/new?idea=${encodeURIComponent(checked)}`} className="btn h-10 px-4 text-sm">이 아이디어로 PRD 만들기</Link>
            <WatchIdeaButton idea={checked} />
          </div>
        </div>
      )}
    </section>
  );
}
