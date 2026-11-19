// Human review rows for opportunities: hide a problem or drop an off-topic quote without redeploying.
// Service key only; when the database cannot be read, callers fall back to the bundled constants in review.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export type OpportunityReviewKind = 'hide' | 'drop_quote';

export type OpportunityReviewRow = {
  slug: string;
  kind: OpportunityReviewKind;
  quote: string;
  reason: string;
  created_by?: string | null;
  created_at?: string;
};

/** Reads all opportunity review rules from the database, or returns null when the database is unavailable or fails. */
export async function readOpportunityReviews(service: SupabaseClient | null = createAdminClient()): Promise<OpportunityReviewRow[] | null> {
  if (!service) return null;
  try {
    const { data, error } = await service
      .from('opportunity_reviews')
      .select('slug,kind,quote,reason,created_by,created_at')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data) || !data.length) return null;
    return data.flatMap((row) => {
      const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
      const kind = row.kind === 'hide' || row.kind === 'drop_quote' ? row.kind : null;
      if (!slug || !kind) return [];
      return [{
        slug,
        kind,
        quote: typeof row.quote === 'string' ? row.quote : '',
        reason: typeof row.reason === 'string' ? row.reason : '',
        created_by: typeof row.created_by === 'string' ? row.created_by : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
      }];
    });
  } catch {
    return null;
  }
}

/** Inserts or updates one opportunity review rule (hide a problem or drop a quote). */
export async function saveOpportunityReview(
  row: { slug: string; kind: OpportunityReviewKind; quote?: string; reason?: string; created_by?: string | null },
  service: SupabaseClient | null = createAdminClient(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!service) return { ok: false, error: 'missing-service-key' };
  const slug = row.slug.trim();
  const quote = row.kind === 'drop_quote' ? (row.quote ?? '').trim() : '';
  const reason = (row.reason ?? '').trim();
  if (!slug) return { ok: false, error: 'missing-slug' };
  if (row.kind === 'drop_quote' && !quote) return { ok: false, error: 'missing-quote' };
  const { error } = await service
    .from('opportunity_reviews')
    .upsert(
      { slug, kind: row.kind, quote, reason, created_by: row.created_by ?? null },
      { onConflict: 'slug,kind,quote' },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Removes one opportunity review rule. */
export async function deleteOpportunityReview(
  row: { slug: string; kind: OpportunityReviewKind; quote?: string },
  service: SupabaseClient | null = createAdminClient(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!service) return { ok: false, error: 'missing-service-key' };
  const slug = row.slug.trim();
  const quote = row.kind === 'drop_quote' ? (row.quote ?? '').trim() : '';
  if (!slug) return { ok: false, error: 'missing-slug' };
  const { error } = await service
    .from('opportunity_reviews')
    .delete()
    .match({ slug, kind: row.kind, quote });
  return error ? { ok: false, error: error.message } : { ok: true };
}
