// Public repository rows the pages read with the visitor's client.
import type { SupabaseClient } from '@supabase/supabase-js';

/** The latest release of each kept repository, for the "new releases" list. */
export async function repoReleases<R>(supabase: SupabaseClient, ids: string[]) {
  const { data, error } = await supabase.from('github_trends').select('id,repo_full_name,latest_release').in('id', ids);
  return error ? [] : ((data ?? []) as Array<{ id: string; repo_full_name: string; latest_release: R | null }>);
}
