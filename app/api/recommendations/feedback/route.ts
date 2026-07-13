import type { ContentTarget } from '@/lib/content-targets';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set<ContentTarget>(['news', 'paper', 'github', 'project', 'ai_product']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const itemType = String(body?.itemType ?? '') as ContentTarget;
  const itemId = String(body?.itemId ?? '');
  const feedback = String(body?.feedback ?? '');
  const surface = String(body?.surface ?? 'unknown').slice(0, 80);
  if (!ALLOWED_TYPES.has(itemType) || !itemId || !['useful', 'not_relevant', 'show_less'].includes(feedback)) {
    return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { error } = await supabase.from('recommendation_feedback').upsert(
    { user_id: userData.user.id, item_type: itemType, item_id: itemId, feedback, surface },
    { onConflict: 'user_id,item_type,item_id,surface' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback });
}
