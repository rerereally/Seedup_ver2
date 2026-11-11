// Mails subscribers about opportunities, after an engine run.
// npx tsx scripts/send-opportunity-digest.ts --kind changes   alert, only when something passed the bar or changed status
// npx tsx scripts/send-opportunity-digest.ts --kind weekly    weekly summary
// Add --dry-run to print the mail instead of sending. Missing mail settings end the script quietly, not as a failure.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildOpportunityDigest } from '../lib/newsletter/opportunity-digest';
import type { DigestKind } from '../lib/newsletter/opportunity-digest';
import { claimSend, releaseSend } from '../lib/newsletter/sends';
import type { Opportunity, OpportunitySnapshot } from '../lib/opportunities/types';

const WINDOW_HOURS: Record<DigestKind, number> = { changes: 26, weekly: 7 * 24 };
const SEND_INTERVAL_MS = 600;

async function main() {
  const kind: DigestKind = process.argv.includes('weekly') ? 'weekly' : 'changes';
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const service = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  let opportunities: Opportunity[] = [];
  if (service) {
    const { data, error } = await service.from('opportunities').select('data').eq('published', true);
    if (error) throw new Error(`could not read opportunities: ${error.message}`);
    opportunities = (data ?? []).map((row) => row.data as Opportunity);
  }
  const snapshotFile = resolve(process.cwd(), 'lib/opportunities/data/snapshot.json');
  if (!opportunities.length && existsSync(snapshotFile)) opportunities = (JSON.parse(readFileSync(snapshotFile, 'utf8')) as OpportunitySnapshot).opportunities;

  const siteUrl = process.env.SEEDUP_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  const since = new Date(Date.now() - WINDOW_HOURS[kind] * 3_600_000).toISOString();
  const digest = buildOpportunityDigest(opportunities, since, siteUrl || 'http://localhost:3000', kind);
  if (!digest) return console.log(`${kind}: nothing changed since ${since}, no mail`);
  if (dryRun) return console.log(`${digest.subject}\n\n${digest.text}`);

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM_EMAIL;
  // A mail whose links point at localhost helps nobody, so a deployed address is required too.
  if (!service || !resendKey || !from || !/^https:\/\//.test(siteUrl)) {
    return console.log(`${kind}: ${digest.lines.length} lines ready, but not sent. RESEND_API_KEY, NEWSLETTER_FROM_EMAIL and an https SEEDUP_SITE_URL are all required.`);
  }

  const { data: subscribers, error } = await service.from('user_onboarding').select('user_id').eq('newsletter_subscribed', true);
  if (error) throw new Error(`could not read subscribers: ${error.message}`);
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
    const claim = await claimSend(service, `opportunity-${kind}`, period, userId);
    if (claim === 'duplicate') {
      duplicates += 1;
      continue;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `opportunity-${kind}-${period}-${userId}` },
      body: JSON.stringify({ from, to: email, subject: digest.subject, html: digest.html, text: digest.text }),
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
  console.log(`${kind}: sent ${sent}, already sent ${duplicates}, failed ${failed}`);
  if (failed && !sent) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
