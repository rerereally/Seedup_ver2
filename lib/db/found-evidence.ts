// Quotes found on the web for ideas, shared across users (found_evidence.sql), and daily limits for visitors who are
// not signed in. Both run with the service key: neither table is readable by browsers.
import { createAdminClient } from '@/lib/supabase/admin';
import type { Evidence, Platform } from '@/lib/opportunities/types';

type FoundRow = { id: string; platform: string; quote: string; quote_ko: string; url: string; score: number; posted_at: string | null; terms: string[] };

/** Stores quotes that already passed the word-for-word check, with the search words that found them. */
export async function saveFoundEvidence(quotes: Evidence[], terms: string[]) {
  const service = quotes.length ? createAdminClient() : null;
  if (!service) return;
  // One row per id: an upsert that meets the same id twice in one statement fails as a whole.
  const unique = [...new Map(quotes.filter((row) => row.id.startsWith('lv_')).map((row) => [row.id, row])).values()];
  const rows = unique.map((row) => ({
    id: row.id, platform: row.platform, quote: row.quote.slice(0, 400), quote_ko: row.quoteKo.slice(0, 300), url: row.url, score: Math.round(row.score) || 0, posted_at: row.postedAt, terms,
  }));
  const { error } = await service.rpc('save_found_evidence', { p_rows: rows });
  // Missing before the migration is applied; the search still works, it just does not share what it found.
  if (error) console.error('found evidence save failed', error.message);
}

/** Quotes found earlier whose search words share any of `terms`, most often found first. */
export async function storedEvidence(terms: string[], limit = 40): Promise<Array<Evidence & { terms: string[] }>> {
  const service = terms.length ? createAdminClient() : null;
  if (!service) return [];
  const { data, error } = await service.from('found_evidence').select('id,platform,quote,quote_ko,url,score,posted_at,terms').overlaps('terms', terms).order('found_count', { ascending: false }).limit(limit);
  if (error) {
    console.error('found evidence read failed', error.message);
    return [];
  }
  return ((data ?? []) as FoundRow[]).map((row) => ({
    id: row.id, platform: row.platform as Platform, quote: row.quote, quoteKo: row.quote_ko, url: row.url, score: row.score, postedAt: row.posted_at, terms: row.terms,
  }));
}

/**
 * Counts one use for a signed-out visitor: false once today's limit is used up, null when the limit cannot be checked
 * (no service key, or the migration is not applied). Callers block on null too: unchecked use would be unlimited.
 */
export async function consumeAnonUsage(visitor: string, feature: string, dailyLimit: number): Promise<boolean | null> {
  const service = createAdminClient();
  if (!service) return null;
  const { data, error } = await service.rpc('consume_anon_usage', { p_visitor: visitor, p_feature: feature, p_daily_limit: dailyLimit });
  if (error) {
    console.error('anon usage check failed (blocking)', feature, error.message);
    return null;
  }
  return data === true;
}

export async function releaseAnonUsage(visitor: string, feature: string) {
  const { error } = (await createAdminClient()?.rpc('release_anon_usage', { p_visitor: visitor, p_feature: feature })) ?? { error: null };
  if (error) console.error('anon usage refund failed', feature, error.message);
}
