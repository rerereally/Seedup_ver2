import { contentCounts, refreshContentReactionCounts, toggleReaction } from '@/lib/engagement';
import type { ContentTarget } from '@/lib/content-targets';
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

  await toggleReaction(supabase, userData.user.id, itemType, itemId, reaction);
  await refreshContentReactionCounts(itemType, itemId);
  return NextResponse.json(await contentCounts(itemType, itemId));
}
