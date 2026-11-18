import type { SupabaseClient } from '@supabase/supabase-js';
import { claimSend, releaseSend } from '../newsletter/sends';
import { buildValidationReport } from './report';
import type { ValidationReport } from './report';
import { PLATFORM_LABELS } from './types';
import type { Opportunity } from './types';

export const MAX_WATCHES_PER_USER = 10;
const CHECK_EVERY_DAYS = 7;
const MAX_CHECKS_PER_RUN = 20;

type Watch = { id: string; user_id: string; idea: string; known_urls: string[] | null; checked_at: string | null };

/** What a new report found that the last ones did not: quotes and rival tools, by address. */
export function newFindings(report: Pick<ValidationReport, 'quotes' | 'rivals'>, known: string[]) {
  const seen = new Set(known);
  return {
    quotes: report.quotes.filter((row) => !seen.has(row.url)),
    rivals: report.rivals.filter((row) => !seen.has(row.url)),
  };
}

export function watchMail(idea: string, found: ReturnType<typeof newFindings>, siteUrl: string) {
  const lines = [
    `지켜보는 아이디어 "${idea}"에 새 소식이 있습니다.`,
    '',
    ...(found.quotes.length ? ['새로 찾은 원문', ...found.quotes.map((row) => `- "${row.quote}" (${PLATFORM_LABELS[row.platform] ?? row.platform}) ${row.url}`), ''] : []),
    ...(found.rivals.length ? ['새로 보인 도구', ...found.rivals.map((row) => `- ${row.name}${row.relation === 'direct' ? ' (같은 문제를 푸는 도구)' : ''} ${row.url}`), ''] : []),
    `이 아이디어로 PRD 만들기: ${siteUrl}/prd/new?idea=${encodeURIComponent(idea)}`,
    `지켜보기 그만두기: ${siteUrl}/profile`,
  ];
  return { subject: `지켜보는 아이디어에 새 소식: ${idea.slice(0, 40)}`, text: lines.join('\n') };
}

/**
 * Re-checks watched ideas once a week each (the oldest first, 20 per run, since each check spends a web search and
 * model calls). The first check only records what exists; later checks mail what is new.
 */
export async function checkIdeaWatches(service: SupabaseClient, opportunities: Opportunity[], mail: { resendKey?: string; from?: string; siteUrl: string }, log: (message: string) => void = console.log) {
  const due = new Date(Date.now() - CHECK_EVERY_DAYS * 86_400_000).toISOString();
  const { data, error } = await service.from('idea_watches').select('id,user_id,idea,known_urls,checked_at').or(`checked_at.is.null,checked_at.lt.${due}`).order('checked_at', { ascending: true, nullsFirst: true }).limit(MAX_CHECKS_PER_RUN);
  if (error) throw new Error(`could not read idea watches: ${error.message}`);
  const canMail = Boolean(mail.resendKey && mail.from && /^https:\/\//.test(mail.siteUrl));
  let mailed = 0;
  for (const watch of (data ?? []) as Watch[]) {
    const report = await buildValidationReport(watch.idea, opportunities).catch(() => null);
    if (!report) {
      log(`watch ${watch.id}: report failed`);
      continue;
    }
    const known = watch.known_urls ?? [];
    const found = newFindings(report, known);
    const urls = [...new Set([...known, ...report.quotes.map((row) => row.url), ...report.rivals.map((row) => row.url)])].slice(-500);
    await service.from('idea_watches').update({ known_urls: urls, checked_at: new Date().toISOString() }).eq('id', watch.id);
    const first = !watch.checked_at;
    log(`watch ${watch.id}: ${first ? 'baseline' : `new quotes ${found.quotes.length}, new rivals ${found.rivals.length}`}`);
    if (first || !canMail || !(found.quotes.length + found.rivals.length)) continue;

    const { data: account } = await service.auth.admin.getUserById(watch.user_id);
    const email = account.user?.email;
    if (!email) continue;
    const period = `${new Date().toISOString().slice(0, 10)}:${watch.id}`;
    const claim = await claimSend(service, 'idea-watch', period, watch.user_id);
    if (claim === 'duplicate') continue;
    const message = watchMail(watch.idea, found, mail.siteUrl);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mail.resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `idea-watch-${period}` },
      body: JSON.stringify({ from: mail.from, to: email, subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (response?.ok) mailed += 1;
    else if (claim === 'claimed') await releaseSend(service, 'idea-watch', period, watch.user_id);
  }
  return { checked: (data ?? []).length, mailed };
}
