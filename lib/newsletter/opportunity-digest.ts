import { scoreOpportunity } from '@/lib/opportunities/insight';
import { PLATFORM_LABELS } from '@/lib/opportunities/types';
import type { Opportunity, OpportunityStatus } from '@/lib/opportunities/types';

export type DigestKind = 'weekly' | 'changes';
export type DigestLine = { slug: string; name: string; note: string; important: boolean };
/** A strong opportunity, with one verbatim quote so the mail shows evidence, not a claim. */
export type DigestTop = { slug: string; name: string; problem: string; score: number; quote: { text: string; source: string; url: string } | null };
/** One curated read: an article, paper, product, repo or build idea picked for the reader. */
export type DigestRead = { title: string; href: string; source: string; reason: string | null };
/** Everything an issue says, in a shape the mail, the web issue page and the archive all render the same way. */
export type DigestIssue = { kind: DigestKind; subject: string; headline: string; lines: DigestLine[]; top: DigestTop[]; reads: DigestRead[] };
export type OpportunityDigest = DigestIssue & { html: string; text: string };

const STATUS_WORDS: Record<OpportunityStatus, string> = { open: '경쟁 적음', narrowing: '경쟁 늘어남', closed: '경쟁 많음', unknown: '확인 중' };
// An alert lists every change that matters; the weekly issue keeps its list short so the evidence stays on top.
const MAX_LINES: Record<DigestKind, number> = { changes: 8, weekly: 5 };
const MAX_TOP = 3;

export const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** One subscriber's signals: opportunities they saved evidence from, and their onboarding interest words. */
export type DigestReader = { slugs: string[]; keywords: string[] };

/** 2 for an opportunity the reader saved, 1 for one whose keywords match their interests, else 0. */
export function readerInterest(opportunities: Opportunity[], reader?: DigestReader) {
  const saved = new Set(reader?.slugs ?? []);
  const words = (reader?.keywords ?? []).map((word) => word.toLowerCase().trim()).filter((word) => word.length >= 2);
  const matches = new Map(opportunities.map((item) => {
    const haystack = [item.name, ...item.keywords].join(' ').toLowerCase();
    return [item.slug, words.some((word) => haystack.includes(word))];
  }));
  return (slug: string) => (saved.has(slug) ? 2 : matches.get(slug) ? 1 : 0);
}

/** What changed for one opportunity since a moment, read from the points the engine stores on every run. */
export function changeSince(opportunity: Opportunity, since: string): DigestLine | null {
  const history = opportunity.history ?? [];
  const latest = history[history.length - 1];
  if (!latest || latest.at <= since) return null;
  const before = [...history].reverse().find((point) => point.at <= since);
  const base = { slug: opportunity.slug, name: opportunity.name };
  if (!before) return { ...base, note: `새로 찾았습니다. 원문 ${latest.evidence}건, ${STATUS_WORDS[latest.status]}`, important: latest.qualified };

  const notes: string[] = [];
  if (latest.qualified && !before.qualified) notes.push('기준을 통과했습니다');
  if (latest.status !== before.status) notes.push(`${STATUS_WORDS[before.status]}에서 ${STATUS_WORDS[latest.status]}(으)로 바뀌었습니다`);
  const important = notes.length > 0;
  if (latest.evidence > before.evidence) notes.push(`원문 ${before.evidence}건 → ${latest.evidence}건`);
  if (latest.direct !== before.direct) notes.push(`직접 경쟁 ${before.direct}개 → ${latest.direct}개`);
  return notes.length ? { ...base, note: notes.join(', '), important } : null;
}

/** The first quote that reads as a sentence: no shouting, no fragment cut off at a colon. */
function readableQuote(item: Opportunity) {
  const quote = item.evidence.find((row) => row.quote.length >= 30 && row.quote.length <= 240 && row.quote !== row.quote.toUpperCase() && !/[:,]$/.test(row.quote.trim()));
  return quote ? { text: quote.quote, source: PLATFORM_LABELS[quote.platform], url: quote.url } : null;
}

/**
 * 'changes' is the alert: it is sent only when an opportunity passed the bar or changed status.
 * 'weekly' is the issue: smaller movements, the strongest opportunities, and the reads curated for this reader.
 * Returns null when there is nothing to say.
 */
export function buildOpportunityDigest(opportunities: Opportunity[], since: string, siteUrl: string, kind: DigestKind, now = Date.now(), reader?: DigestReader, reads: DigestRead[] = []): OpportunityDigest | null {
  const interest = readerInterest(opportunities, reader);
  // The reader's own opportunities (saved, or matching their interests) come first; importance breaks ties.
  const changed = opportunities.flatMap((item) => changeSince(item, since) ?? [])
    .sort((a, b) => (interest(b.slug) - interest(a.slug)) || (Number(b.important) - Number(a.important)))
    .map((line) => (interest(line.slug) > 0 ? { ...line, note: `관심 기회 · ${line.note}` } : line));
  const lines = (kind === 'changes' ? changed.filter((line) => line.important) : changed).slice(0, MAX_LINES[kind]);
  const top: DigestTop[] = kind === 'weekly'
    ? opportunities.filter((item) => item.qualified)
      .map((item) => ({ item, score: scoreOpportunity(item, now).total }))
      .sort((a, b) => (interest(b.item.slug) - interest(a.item.slug)) || (b.score - a.score))
      .slice(0, MAX_TOP)
      .map(({ item, score }) => ({ slug: item.slug, name: item.name, problem: item.problem, score, quote: readableQuote(item) }))
    : [];
  const weeklyReads = kind === 'weekly' ? reads : [];
  if (!lines.length && !top.length && !weeklyReads.length) return null;

  const subject = kind === 'changes'
    ? `Seedup 기회 알림: ${lines[0].name}${lines.length > 1 ? ` 외 ${lines.length - 1}건` : ''}`
    : `Seedup 주간 신호 · ${new Date(now).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })}`;
  // A line about a problem that now passes the bar, whether it just crossed it or was found already above it.
  const qualified = new Set(opportunities.filter((item) => item.qualified).map((item) => item.slug));
  const passed = lines.find((line) => line.important && qualified.has(line.slug));
  const headline = kind === 'changes'
    ? '지켜볼 만한 변화가 생겼습니다.'
    : passed ? `이번 주, ${passed.name} 문제가 기준을 통과했습니다.` : top.length ? '이번 주에 움직인 문제와 읽을거리입니다.' : '이번 주에 읽을 만한 것만 골랐습니다.';
  const issue: DigestIssue = { kind, subject, headline, lines, top, reads: weeklyReads };
  const base = siteUrl.replace(/\/+$/, '');
  return { ...issue, html: renderIssueHtml(issue, base), text: renderIssueText(issue, base) };
}

const absolute = (base: string, href: string) => (href.startsWith('/') ? `${base}${href}` : href);
export const opportunityUrl = (base: string, slug: string) => `${base}/opportunities/${encodeURIComponent(slug)}`;

/**
 * The mail in the site's own look: white page, one green accent, quotes set off by a green rule, no badges.
 * Inline styles and tables only, because mail clients ignore stylesheets.
 */
export function renderIssueHtml(issue: DigestIssue, base: string) {
  const ink = '#111113';
  const muted = '#6e6e73';
  const line = '#e5e5ea';
  const green = '#127a4c';
  const heading = (text: string) => `<p style="margin:36px 0 6px;font-size:13px;font-weight:600;color:${muted};">${escapeHtml(text)}</p>`;
  const row = (href: string, title: string, note: string) => `<tr><td style="padding:14px 0;border-top:1px solid ${line};"><a href="${href}" style="font-size:16px;font-weight:600;line-height:1.45;color:${ink};text-decoration:none;">${escapeHtml(title)}</a>${note ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.6;color:${muted};">${escapeHtml(note)}</p>` : ''}</td></tr>`;
  const table = (rows: string) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>`;
  const [lead, ...rest] = issue.top;

  const leadBlock = lead ? `${heading('지금 근거가 가장 탄탄한 문제')}
<p style="margin:0;font-size:19px;font-weight:600;line-height:1.4;color:${ink};">${escapeHtml(lead.name)}</p>
<p style="margin:6px 0 0;font-size:14px;line-height:1.65;color:${muted};">${escapeHtml(lead.problem)}</p>
${lead.quote ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;"><tr><td style="border-left:2px solid ${green};padding:2px 0 2px 14px;"><p lang="en" style="margin:0;font-size:15px;line-height:1.65;color:${ink};">“${escapeHtml(lead.quote.text)}”</p><p style="margin:4px 0 0;font-size:12px;color:${muted};">${escapeHtml(lead.quote.source)} · 원문과 일치 · <a href="${lead.quote.url}" style="color:${green};text-decoration:none;">원문 보기</a></p></td></tr></table>` : ''}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;"><tr><td style="border-radius:10px;background:${green};"><a href="${base}/prd?opportunity=${encodeURIComponent(lead.slug)}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">이 문제로 PRD 만들기</a></td><td style="padding-left:14px;"><a href="${base}/prd?opportunity=${encodeURIComponent(lead.slug)}#agent" style="font-size:14px;font-weight:600;color:${green};text-decoration:none;">코딩 에이전트로 시작 ›</a></td></tr></table>
${rest.length ? table(rest.map((item) => row(opportunityUrl(base, item.slug), item.name, `${item.score}점 · ${item.problem}`)).join('')).replace('<table', '<table style="margin-top:20px;"') : ''}` : '';

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>${escapeHtml(issue.subject)}</title></head>
<body style="margin:0;background:#f4f4f6;font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif;color:${ink};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid ${line};border-radius:16px;"><tr><td style="padding:36px 32px;">
<p style="margin:0;font-size:13px;font-weight:600;color:${green};">Seedup ${issue.kind === 'weekly' ? '주간 신호' : '기회 알림'}</p>
<h1 style="margin:10px 0 0;font-size:24px;font-weight:700;line-height:1.35;letter-spacing:-0.02em;color:${ink};">${escapeHtml(issue.headline)}</h1>
${leadBlock}
${issue.lines.length ? `${heading(issue.kind === 'changes' ? '달라진 문제' : '이번 주에 달라진 것')}${table(issue.lines.map((item) => row(opportunityUrl(base, item.slug), item.name, item.note)).join(''))}` : ''}
${issue.reads.length ? `${heading('읽을거리')}${table(issue.reads.map((read) => row(absolute(base, read.href), read.title, [read.source, read.reason].filter(Boolean).join(' · '))).join(''))}` : ''}
<p style="margin:40px 0 0;padding-top:20px;border-top:1px solid ${line};font-size:12px;line-height:1.7;color:${muted};">공개 게시글의 원문 문장과 저장된 수치로만 만든 메일입니다. <a href="${base}/newsletter-preview" style="color:${muted};">웹에서 보기 · 지난 호</a> · <a href="${base}/newsletter-preview#subscription" style="color:${muted};">구독 해지</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

export function renderIssueText(issue: DigestIssue, base: string) {
  return [
    issue.subject,
    issue.headline,
    ...(issue.lines.length ? ['', issue.kind === 'changes' ? '달라진 문제' : '이번 주에 달라진 것', ...issue.lines.map((item) => `- ${item.name}: ${item.note}\n  ${opportunityUrl(base, item.slug)}`)] : []),
    ...(issue.top.length ? ['', '지금 근거가 가장 탄탄한 문제', ...issue.top.map((item) => `- ${item.name} (${item.score}점)\n  ${opportunityUrl(base, item.slug)}`)] : []),
    ...(issue.reads.length ? ['', '읽을거리', ...issue.reads.map((read) => `- ${read.title}\n  ${absolute(base, read.href)}`)] : []),
    '',
    `웹에서 보기 · 구독 해지: ${base}/newsletter-preview`,
  ].join('\n');
}
