import { createClient } from '@supabase/supabase-js';
import { digestSiteUrl, sendDailyResearchMail } from '../lib/newsletter/opportunity-digest-send';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Daily research mail requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');

  const outcome = await sendDailyResearchMail({
    service: createClient(url, key, { auth: { persistSession: false } }),
    dryRun,
    siteUrl: digestSiteUrl(),
    resendKey: process.env.RESEND_API_KEY,
    from: process.env.NEWSLETTER_FROM_EMAIL,
  });
  console.log(`daily: ${outcome.recipients} opted-in recipients`);
  if (!outcome.mail) return console.log('daily: nothing changed, no mail');
  if (dryRun) return console.log(`${outcome.mail.subject}\n\n${outcome.mail.text}`);

  console.log(`daily: sent ${outcome.sent}, already sent ${outcome.duplicates}, failed ${outcome.failed}`);
  if (outcome.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
