import { getContentTable, type ContentTarget } from '@/lib/content-targets';
import { createAdminClient } from '@/lib/supabase/admin';

type Counts = {
  view_count?: number | null;
  like_count?: number | null;
  dislike_count?: number | null;
};

export async function incrementContentView(itemType: ContentTarget, itemId: string) {
  const supabase = createAdminClient();
  if (!supabase) return;
  const table = getContentTable(itemType);
  const { error } = await supabase.rpc('increment_content_view', { p_table: table, p_id: itemId });
  if (!error) return;
  // 42883 / PGRST202: migration supabase/view_count_2026_11.sql not applied yet, use the old non-atomic path.
  if (error.code !== '42883' && error.code !== 'PGRST202') {
    console.error('incrementContentView rpc failed', error);
    return;
  }
  const { data } = await supabase.from(table).select('view_count').eq('id', itemId).maybeSingle();
  const counts = data as Counts | null;
  await supabase
    .from(table)
    .update({ view_count: Number(counts?.view_count ?? 0) + 1 })
    .eq('id', itemId);
}

export async function refreshContentReactionCounts(itemType: ContentTarget, itemId: string) {
  const supabase = createAdminClient();
  if (!supabase) return;
  const [{ count: likeCount }, { count: dislikeCount }] = await Promise.all([
    supabase.from('content_reactions').select('id', { count: 'exact', head: true }).eq('item_type', itemType).eq('item_id', itemId).eq('reaction', 'like'),
    supabase.from('content_reactions').select('id', { count: 'exact', head: true }).eq('item_type', itemType).eq('item_id', itemId).eq('reaction', 'dislike'),
  ]);
  await supabase
    .from(getContentTable(itemType))
    .update({
      like_count: likeCount ?? 0,
      dislike_count: dislikeCount ?? 0,
    })
    .eq('id', itemId);
}
