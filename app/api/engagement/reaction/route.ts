import { refreshContentReactionCounts } from '@/lib/engagement';
import { getContentTable, type ContentTarget } from '@/lib/content-targets';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set<ContentTarget>(['news', 'paper', 'github', 'project', 'ai_product']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const itemType = String(body?.itemType ?? '') as ContentTarget;
  const itemId = String(body?.itemId ?? '');
  const reaction = String(body?.reaction ?? '');
  if (!ALLOWED_TYPES.has(itemType) || !itemId || !['like', 'dislike'].includes(reaction)) return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { data: existing } = await supabase.from('content_reactions').select('id,reaction').eq('user_id', userData.user.id).eq('item_type', itemType).eq('item_id', itemId).maybeSingle();
  if (existing?.reaction === reaction) await supabase.from('content_reactions').delete().eq('id', existing.id).eq('user_id', userData.user.id);
  else if (existing) await supabase.from('content_reactions').update({ reaction, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('user_id', userData.user.id);
  else await supabase.from('content_reactions').insert({ user_id: userData.user.id, item_type: itemType, item_id: itemId, reaction });

  await refreshContentReactionCounts(itemType, itemId);
  const admin = (await import('@/lib/supabase/admin')).createAdminClient();
  const { data } = admin ? await admin.from(getContentTable(itemType)).select('view_count,like_count,dislike_count').eq('id', itemId).maybeSingle() : { data: null };
  return NextResponse.json({ views: data?.view_count ?? 0, likes: data?.like_count ?? 0, dislikes: data?.dislike_count ?? 0 });
}
