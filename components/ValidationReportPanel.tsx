'use client';

import { useLang } from '@/components/LangProvider';
import MarkdownContent from '@/components/MarkdownContent';
import WatchIdeaButton from '@/components/WatchIdeaButton';
import { translator } from '@/lib/i18n';
import type { IdeaClarity } from '@/lib/opportunities/questions';
import type { Platform } from '@/lib/opportunities/types';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export const VALIDATION_HANDOFF_KEY = 'seedup:validation-to-prd';

export type ValidationSignedQuote = {
  id: string;
  platform: Platform;
  quote: string;
  quoteKo: string;
  url: string;
  score: number;
  postedAt: string | null;
  sig: string;
};

export type ValidationRival = {
  name: string;
  description?: string;
  url?: string;
  relation?: string;
};

export type ValidationRelated = {
  slug: string;
  name?: string;
  qualified?: boolean;
  quotes?: number;
};

export type ValidationReportPayload = {
  markdown: string;
  quotes?: ValidationSignedQuote[];
  rivals?: ValidationRival[];
  related?: ValidationRelated[];
  gap?: string;
};

export type ValidationPrdHandoff = {
  idea: string;
  evidenceIds: string[];
  liveQuotes: ValidationSignedQuote[];
  relatedSlugs: string[];
  competitors: ValidationRival[];
  gap: string;
};

const MAX_HANDOFF_QUOTES = 12;
const MAX_HANDOFF_COMPETITORS = 8;
const MAX_HANDOFF_RELATED = 3;

export function buildValidationHandoff(idea: string, report: ValidationReportPayload): ValidationPrdHandoff {
  const seenQuotes = new Set<string>();
  const liveQuotes = (Array.isArray(report.quotes) ? report.quotes : []).filter((row) => {
    if (!row || typeof row.id !== 'string' || !row.id || typeof row.quote !== 'string' || !row.quote || typeof row.sig !== 'string' || !row.sig) return false;
    if (seenQuotes.has(row.id)) return false;
    seenQuotes.add(row.id);
    return true;
  }).slice(0, MAX_HANDOFF_QUOTES);

  const evidenceIds = liveQuotes.map((row) => row.id);
  const relatedSlugs = [...new Set((Array.isArray(report.related) ? report.related : [])
    .map((row) => (typeof row?.slug === 'string' ? row.slug.trim() : ''))
    .filter(Boolean))].slice(0, MAX_HANDOFF_RELATED);

  const seenRivals = new Set<string>();
  const competitors = (Array.isArray(report.rivals) ? report.rivals : []).flatMap((row) => {
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    if (!name) return [];
    const key = name.toLowerCase();
    if (seenRivals.has(key)) return [];
    seenRivals.add(key);
    return [{
      name: name.slice(0, 80),
      ...(typeof row.relation === 'string' && row.relation ? { relation: row.relation } : {}),
      ...(typeof row.description === 'string' && row.description.trim() ? { description: row.description.trim().slice(0, 140) } : {}),
      ...(typeof row.url === 'string' && row.url.trim() ? { url: row.url.trim().slice(0, 240) } : {}),
    }];
  }).slice(0, MAX_HANDOFF_COMPETITORS);

  return {
    idea: idea.trim().slice(0, 300),
    evidenceIds,
    liveQuotes,
    relatedSlugs,
    competitors,
    gap: typeof report.gap === 'string' ? report.gap.trim().slice(0, 240) : '',
  };
}

/** Builds the /prd/new link carrying the report's idea, evidence IDs, related problems, and competitor names. */
export function validationPrdHref(idea: string, report: ValidationReportPayload): string {
  const handoff = buildValidationHandoff(idea, report);
  const params = new URLSearchParams({ idea: handoff.idea });
  if (handoff.evidenceIds.length) params.set('evidence', handoff.evidenceIds.join(','));
  if (handoff.relatedSlugs.length) params.set('related', handoff.relatedSlugs.join(','));
  if (handoff.competitors.length) {
    params.set('competitors', handoff.competitors.map((item) => item.name).join(', ').slice(0, 400));
  }
  return `/prd/new?${params.toString()}`;
}

export function storeValidationHandoff(handoff: ValidationPrdHandoff) {
  try {
    window.sessionStorage.setItem(VALIDATION_HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Private mode or blocked storage: URL query parameters still carry the IDs and competitors.
  }
}

/**
 * Reads validation report handoff data (evidence IDs, signed quotes, related problems, and competing tools) from
 * URL query parameters and optional sessionStorage so the validation entry lands directly in the PRD workspace.
 */
export function readValidationPrdInput(
  initialIdea: string,
  search: string,
  storedRaw: string | null,
  pool: Array<{ slug: string; quotes: Array<{ id: string }> }>,
): { evidenceIds: string[]; liveQuotes: ValidationSignedQuote[]; competitors: string[] } | null {
  const idea = initialIdea.trim();
  const params = new URLSearchParams(search);
  const splitList = (raw: string | null, limit: number) => [...new Set((raw ?? '').split(',').map((item) => item.trim()).filter(Boolean))].slice(0, limit);
  const urlEvidence = splitList(params.get('evidence'), MAX_HANDOFF_QUOTES);
  const urlRelated = splitList(params.get('related'), MAX_HANDOFF_RELATED);
  const urlCompetitors = splitList(params.get('competitors'), MAX_HANDOFF_COMPETITORS);

  let handoff: ValidationPrdHandoff | null = null;
  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw) as Partial<ValidationPrdHandoff> | null;
      if (parsed && typeof parsed.idea === 'string' && parsed.idea.trim() === idea) {
        handoff = parsed as ValidationPrdHandoff;
      }
    } catch {
      handoff = null;
    }
  }

  const seenLive = new Set<string>();
  const liveQuotes: ValidationSignedQuote[] = (Array.isArray(handoff?.liveQuotes) ? handoff.liveQuotes : []).filter((row) => {
    if (!row || typeof row.id !== 'string' || !row.id || typeof row.quote !== 'string' || !row.quote || typeof row.sig !== 'string' || !row.sig) return false;
    if (seenLive.has(row.id)) return false;
    seenLive.add(row.id);
    return true;
  }).slice(0, MAX_HANDOFF_QUOTES);

  const poolQuoteIds = new Set(pool.flatMap((item) => item.quotes.map((quote) => quote.id)));
  const requestedIds = [...new Set([...(Array.isArray(handoff?.evidenceIds) ? handoff.evidenceIds : []), ...urlEvidence])];
  const catalogIds = requestedIds.filter((id) => poolQuoteIds.has(id));
  const relatedSlugs = [...new Set([...(Array.isArray(handoff?.relatedSlugs) ? handoff.relatedSlugs : []), ...urlRelated])].slice(0, MAX_HANDOFF_RELATED);
  const relatedQuoteIds = !liveQuotes.length && !catalogIds.length
    ? relatedSlugs.flatMap((slug) => pool.find((item) => item.slug === slug)?.quotes.map((quote) => quote.id) ?? [])
    : [];
  const evidenceIds = [...new Set([...liveQuotes.map((row) => row.id), ...catalogIds, ...relatedQuoteIds])].slice(0, MAX_HANDOFF_QUOTES);

  const formattedRivals = (Array.isArray(handoff?.competitors) ? handoff.competitors : []).flatMap((item) => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name) return [];
    const relation = typeof item.relation === 'string' && item.relation ? ` (${item.relation})` : '';
    const detail = typeof item.description === 'string' && item.description.trim() ? `: ${item.description.trim().slice(0, 80)}` : '';
    return [`${name}${relation}${detail}`];
  });
  const competitors = [...new Set(formattedRivals.length ? formattedRivals : urlCompetitors)].slice(0, MAX_HANDOFF_COMPETITORS);

  if (!evidenceIds.length && !liveQuotes.length && !competitors.length) return null;
  return { evidenceIds, liveQuotes, competitors };
}

type Report = ValidationReportPayload;

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
      storeValidationHandoff(buildValidationHandoff(text, body));
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
            <Link
              href={validationPrdHref(text, report)}
              onClick={() => storeValidationHandoff(buildValidationHandoff(text, report))}
              className="btn min-h-11 px-4 text-sm"
            >
              {t('이 아이디어로 PRD 만들기', 'Make a PRD from this idea')}
            </Link>
            <WatchIdeaButton idea={text} />
          </div>
        </div>
      )}
    </section>
  );
}
