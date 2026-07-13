import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set(['news', 'paper', 'project', 'idea', 'trend', 'ai_product', 'github']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const itemType = String(body?.itemType ?? '');
  const itemId = String(body?.itemId ?? '');
  const title = String(body?.title ?? '').trim();
  const description = String(body?.description ?? '').trim();
  const tag = String(body?.tag ?? '').trim();

  if (!ALLOWED_TYPES.has(itemType) || !itemId || !title) {
    return NextResponse.json({ error: 'Invalid scrap' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { data: existing, error: lookupError } = await supabase
    .from('scraps')
    .select('id')
    .eq('user_id', userData.user.id)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  if (existing) {
    const { error } = await supabase.from('scraps').delete().eq('id', existing.id).eq('user_id', userData.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath('/scrap');
    return NextResponse.json({ saved: false });
  }

  const { error } = await supabase.from('scraps').insert({
    user_id: userData.user.id,
    item_type: itemType,
    item_id: itemId,
    title,
    description: description || null,
    tag: tag || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath('/scrap');
  return NextResponse.json({ saved: true });
}
