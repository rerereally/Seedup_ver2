// Bookmarks (scraps), always with the user's own client and row-level security; every write names the user.
import type { SupabaseClient } from '@supabase/supabase-js';

export function findScrap(supabase: SupabaseClient, userId: string | null, itemType: string, itemId: string) {
  const query = supabase.from('scraps').select('id').eq('item_type', itemType).eq('item_id', itemId);
  return (userId ? query.eq('user_id', userId) : query).maybeSingle();
}

export function deleteScrapRow(supabase: SupabaseClient, userId: string, id: string) {
  return supabase.from('scraps').delete().eq('id', id).eq('user_id', userId);
}

export function addScrap(supabase: SupabaseClient, row: { user_id: string; item_type: string; item_id: string; title: string; description: string | null; tag: string | null }) {
  return supabase.from('scraps').insert(row);
}
