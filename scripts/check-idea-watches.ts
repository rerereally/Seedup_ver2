// Re-checks ideas people asked Seedup to watch and mails what is new (new quotes, new rival tools).
import { createClient } from '@supabase/supabase-js';
import { digestSiteUrl } from '../lib/newsletter/opportunity-digest-send';
import { reviewOpportunities } from '../lib/opportunities/review';
import type { Opportunity } from '../lib/opportunities/types';
import { checkIdeaWatches } from '../lib/opportunities/watch';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return console.log('::warning::Supabase settings missing; idea watches not checked.');
  const service = createClient(url, key, { auth: { persistSession: false } });
  // Read straight from the table: this runner has the server key but not the site's public settings.
  const { data } = await service.from('opportunities').select('data').eq('published', true);
  const opportunities = await reviewOpportunities((data ?? []).map((row) => row.data as Opportunity), service);
  const result = await checkIdeaWatches(service, opportunities, { resendKey: process.env.RESEND_API_KEY, from: process.env.NEWSLETTER_FROM_EMAIL, siteUrl: digestSiteUrl() });
  console.log(`idea watches: checked ${result.checked}, mailed ${result.mailed}`);
}

void main();
