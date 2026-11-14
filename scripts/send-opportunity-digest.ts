// Mails subscribers about opportunities, after an engine run.
// npx tsx scripts/send-opportunity-digest.ts --kind changes   alert, only when something passed the bar or changed status
// npx tsx scripts/send-opportunity-digest.ts --kind weekly    weekly summary
// Add --dry-run to print the mail instead of sending. Missing mail settings end the script quietly, not as a failure.
import { createClient } from '@supabase/supabase-js';
import type { DigestKind } from '../lib/newsletter/opportunity-digest';
import { digestSiteUrl, sendOpportunityDigest } from '../lib/newsletter/opportunity-digest-send';

async function main() {
  const kind: DigestKind = process.argv.includes('weekly') ? 'weekly' : 'changes';
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const service = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  const outcome = await sendOpportunityDigest({
    service,
    kind,
    dryRun,
    siteUrl: digestSiteUrl(),
    resendKey: process.env.RESEND_API_KEY,
    from: process.env.NEWSLETTER_FROM_EMAIL,
  });
  if (outcome.status === 'empty') return console.log(`${kind}: nothing changed since ${outcome.since}, no mail`);
  if (outcome.status === 'preview') return console.log(`${outcome.subject}\n\n${outcome.text}`);
  if (outcome.status === 'not-configured') return console.log(`${kind}: ${outcome.lines.length} lines ready, but not sent. RESEND_API_KEY, NEWSLETTER_FROM_EMAIL and an https SEEDUP_SITE_URL are all required.`);

  console.log(`${kind}: sent ${outcome.sent}, already sent ${outcome.duplicates}, failed ${outcome.failed}`);
  if (outcome.failed && !outcome.sent) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
