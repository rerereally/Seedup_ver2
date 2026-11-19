// What visitors say about recommendations and what they were shown, written with their own client.
import type { SupabaseClient } from '@supabase/supabase-js';

export function saveRecommendationFeedback(supabase: SupabaseClient, row: { user_id: string; item_type: string; item_id: string; feedback: string; surface: string }) {
  return supabase.from('recommendation_feedback').upsert(row, { onConflict: 'user_id,item_type,item_id,surface' });
}

export function recordImpressions(supabase: SupabaseClient, rows: Array<Record<string, unknown>>) {
  return supabase.from('recommendation_impressions').insert(rows);
}
