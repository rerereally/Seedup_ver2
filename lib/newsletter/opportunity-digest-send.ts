import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Opportunity, OpportunitySnapshot } from '@/lib/opportunities/types';
import { buildOpportunityDigest } from './opportunity-digest';
import type { DigestKind, DigestLine } from './opportunity-digest';
import { selectInChunks } from '@/lib/supabase/chunks';
import { claimSend, releaseSend } from './sends';

const WINDOW_HOURS: Record<DigestKind, number> = { changes: 26, weekly: 7 * 24 };
const SEND_INTERVAL_MS = 600;

export type OpportunityDigestOutcome =
  | { status: 'empty'; since: string }
  | { status: 'preview'; subject: string; text: string; lines: DigestLine[] }
  | { status: 'not-configured'; subject: string; text: string; lines: DigestLine[] }
  | { status: 'sent'; subject: string; text: string; lines: DigestLine[]; sent: number; duplicates: number; failed: number };

export type OpportunityDigestInput = {
  service: SupabaseClient | null;
  kind: DigestKind;
  dryRun: boolean;
  siteUrl: string;
  resendKey?: string;
  from?: string;
};

export const digestSiteUrl = () => process.env.SEEDUP_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

/** Builds the opportunity digest and, unless dryRun, mails it to every subscriber once per issue. */
export async function sendOpportunityDigest({ service, kind, dryRun, siteUrl, resendKey, from }: OpportunityDigestInput): Promise<OpportunityDigestOutcome> {
  let opportunities: Opportunity[] = [];
  if (service) {
    const { data, error } = await service.from('opportunities').select('data').eq('published', true);
    if (error) throw new Error(`could not read opportunities: ${error.message}`);
    opportunities = (data ?? []).map((row) => row.data as Opportunity);
  }
  const snapshotFile = resolve(process.cwd(), 'lib/opportunities/data/snapshot.json');
  if (!opportunities.length && existsSync(snapshotFile)) opportunities = (JSON.parse(readFileSync(snapshotFile, 'utf8')) as OpportunitySnapshot).opportunities;

  const since = new Date(Date.now() - WINDOW_HOURS[kind] * 3_600_000).toISOString();
  const digest = buildOpportunityDigest(opportunities, since, siteUrl || 'http://localhost:3000', kind);
  if (!digest) return { status: 'empty', since };
  if (dryRun) return { status: 'preview', subject: digest.subject, text: digest.text, lines: digest.lines };

  // A mail whose links point at localhost helps nobody, so a deployed address is required too.
  if (!service || !resendKey || !from || !/^https:\/\//.test(siteUrl)) {
    return { status: 'not-configured', subject: digest.subject, text: digest.text, lines: digest.lines };
  }

  const { data: subscribers, error } = await service.from('user_onboarding').select('user_id,answers').eq('newsletter_subscribed', true);
  if (error) throw new Error(`could not read subscribers: ${error.message}`);
  // Saved dossiers tell which opportunities each reader cares about; read once for everyone.
  const subscriberIds = (subscribers ?? []).map((row) => String(row.user_id));
  const dossiers = await selectInChunks<{ user_id: string; opportunity_slug: string | null }>(subscriberIds, (chunk) =>
    service.from('evidence_dossiers').select('user_id,opportunity_slug').in('user_id', chunk),
  );
  const savedSlugs = new Map<string, string[]>();
  for (const row of dossiers) {
    if (row.opportunity_slug) savedSlugs.set(row.user_id, [...(savedSlugs.get(row.user_id) ?? []), row.opportunity_slug]);
  }
  const period = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  let sent = 0;
  let duplicates = 0;
  let failed = 0;
  for (const subscriber of subscribers ?? []) {
    const userId = String(subscriber.user_id);
    // Addresses come from Supabase Auth because users can edit their own user_onboarding row.
    const { data: account } = await service.auth.admin.getUserById(userId);
    const email = account.user?.email;
    if (!email) continue;
    const answers = (subscriber as { answers?: Record<string, unknown> | null }).answers ?? {};
    const keywords = ['interests', 'preferred_stack', 'goals'].flatMap((key) => {
      const value = answers[key];
      return (Array.isArray(value) ? value : value ? [value] : []).map(String);
    });
    const mail = buildOpportunityDigest(opportunities, since, siteUrl, kind, Date.now(), { slugs: savedSlugs.get(userId) ?? [], keywords }) ?? digest;
    const claim = await claimSend(service, `opportunity-${kind}`, period, userId);
    if (claim === 'duplicate') {
      duplicates += 1;
      continue;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `opportunity-${kind}-${period}-${userId}` },
      body: JSON.stringify({ from, to: email, subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (response?.ok) sent += 1;
    else if (response?.status === 409) duplicates += 1;
    else {
      failed += 1;
      if (claim === 'claimed') await releaseSend(service, `opportunity-${kind}`, period, userId);
    }
    await new Promise((done) => setTimeout(done, SEND_INTERVAL_MS));
  }
  return { status: 'sent', subject: digest.subject, text: digest.text, lines: digest.lines, sent, duplicates, failed };
}
