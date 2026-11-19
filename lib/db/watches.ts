// Ideas a user watches (weekly check for new quotes and rivals). Every query names the user, so it is right both with
// the user's own client (row-level security) and with the service key the MCP endpoint uses.
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_WATCHES_PER_USER } from '@/lib/opportunities/watch';

export function listWatches(supabase: SupabaseClient, userId: string) {
  return supabase.from('idea_watches').select('id,idea,created_at,checked_at').eq('user_id', userId).order('created_at', { ascending: false });
}

/** Starts watching an idea: `limit` when the user already watches the maximum, `error` when saving failed. */
export async function addWatch(supabase: SupabaseClient, userId: string, idea: string): Promise<{ id: string | null } | 'limit' | 'error'> {
  const { count } = await supabase.from('idea_watches').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if ((count ?? 0) >= MAX_WATCHES_PER_USER) return 'limit';
  const { data, error } = await supabase.from('idea_watches').upsert({ user_id: userId, idea }, { onConflict: 'user_id,idea', ignoreDuplicates: true }).select('id').maybeSingle();
  if (error) {
    console.error('idea watch insert failed', error.message);
    return 'error';
  }
  return { id: data?.id ?? null };
}

export function removeWatch(supabase: SupabaseClient, userId: string, id: string) {
  return supabase.from('idea_watches').delete().eq('id', id).eq('user_id', userId);
}
