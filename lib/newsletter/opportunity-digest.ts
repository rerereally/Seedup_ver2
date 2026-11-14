import { scoreOpportunity } from '@/lib/opportunities/insight';
import type { Opportunity, OpportunityStatus } from '@/lib/opportunities/types';

export type DigestKind = 'weekly' | 'changes';
export type DigestLine = { slug: string; name: string; note: string; important: boolean };
export type OpportunityDigest = { subject: string; lines: DigestLine[]; html: string; text: string };

const STATUS_WORDS: Record<OpportunityStatus, string> = { open: '열림', narrowing: '좁아지는 중', closed: '닫힘', unknown: '조사 중' };
const MAX_LINES = 8;

const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

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
  if (!before) return { ...base, note: `새로 찾았습니다. 증언 ${latest.evidence}건, ${STATUS_WORDS[latest.status]}`, important: latest.qualified };

  const notes: string[] = [];
  if (latest.qualified && !before.qualified) notes.push('근거 기준을 통과했습니다');
  if (latest.status !== before.status) notes.push(`${STATUS_WORDS[before.status]}에서 ${STATUS_WORDS[latest.status]}(으)로 바뀌었습니다`);
  const important = notes.length > 0;
  if (latest.evidence > before.evidence) notes.push(`증언 ${before.evidence}건 → ${latest.evidence}건`);
  if (latest.direct !== before.direct) notes.push(`직접 경쟁 ${before.direct}개 → ${latest.direct}개`);
  return notes.length ? { ...base, note: notes.join(', '), important } : null;
}

/**
 * 'changes' is the alert: it is sent only when an opportunity passed the bar or changed status.
 * 'weekly' also lists smaller movements and the strongest opportunities. Returns null when there is nothing to say.
 */
export function buildOpportunityDigest(opportunities: Opportunity[], since: string, siteUrl: string, kind: DigestKind, now = Date.now(), reader?: DigestReader): OpportunityDigest | null {
  const interest = readerInterest(opportunities, reader);
  // The reader's own opportunities (saved, or matching their interests) come first; importance breaks ties.
  const changed = opportunities.flatMap((item) => changeSince(item, since) ?? [])
    .sort((a, b) => (interest(b.slug) - interest(a.slug)) || (Number(b.important) - Number(a.important)))
    .map((line) => (interest(line.slug) > 0 ? { ...line, note: `관심 기회 · ${line.note}` } : line));
  const lines = (kind === 'changes' ? changed.filter((line) => line.important) : changed).slice(0, MAX_LINES);
  const top = kind === 'weekly'
    ? opportunities.filter((item) => item.qualified).map((item) => ({ item, score: scoreOpportunity(item, now).total })).sort((a, b) => (interest(b.item.slug) - interest(a.item.slug)) || (b.score - a.score)).slice(0, 3)
    : [];
  if (!lines.length && !top.length) return null;

  const base = siteUrl.replace(/\/+$/, '');
  const link = (slug: string) => `${base}/opportunities/${encodeURIComponent(slug)}`;
  const subject = kind === 'changes' ? `Seedup 기회 알림: ${lines[0].name}${lines.length > 1 ? ` 외 ${lines.length - 1}건` : ''}` : 'Seedup 주간 기회 정리';
  const row = (href: string, title: string, note: string) => `<tr><td style="padding:14px 0;border-bottom:1px solid #e5e5e5;"><a href="${href}" style="font-size:17px;font-weight:800;color:#111111;text-decoration:none;">${escapeHtml(title)}</a><p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#666666;">${escapeHtml(note)}</p></td></tr>`;
  const block = (title: string, rows: string) => (rows ? `<h2 style="margin:28px 0 4px;font-size:15px;color:#111111;">${title}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>` : '');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f6f6f6;font-family:Pretendard,Apple SD Gothic Neo,Malgun Gothic,Arial,sans-serif;color:#111111;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9d9d9;"><tr><td style="padding:28px;">
<h1 style="margin:0;font-size:22px;">${escapeHtml(subject)}</h1>
${block(kind === 'changes' ? '달라진 기회' : '이번 주에 달라진 것', lines.map((line) => row(link(line.slug), line.name, line.note)).join(''))}
${block('지금 근거가 가장 탄탄한 기회', top.map(({ item, score }) => row(link(item.slug), item.name, `${score}점. ${item.problem}`)).join(''))}
<p style="margin:28px 0 0;font-size:12px;line-height:1.7;color:#888888;">공개 게시글의 원문 문장과 저장된 수치로만 만든 메일입니다. 받지 않으려면 <a href="${base}/profile" style="color:#888888;">프로필</a>에서 메일 수신을 끄세요.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    subject,
    '',
    ...lines.map((line) => `- ${line.name}: ${line.note}\n  ${link(line.slug)}`),
    ...(top.length ? ['', '지금 근거가 가장 탄탄한 기회', ...top.map(({ item, score }) => `- ${item.name} (${score}점)\n  ${link(item.slug)}`)] : []),
    '',
    `메일 수신 설정: ${base}/profile`,
  ].join('\n');
  return { subject, lines, html, text };
}
