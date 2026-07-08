'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const ALLOWED_TYPES = new Set(['news', 'paper', 'project', 'idea', 'trend', 'ai_product', 'github']);

export async function saveScrap(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const itemType = String(formData.get('item_type') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const tag = String(formData.get('tag') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '/scrap');

  if (!ALLOWED_TYPES.has(itemType) || !itemId || !title) {
    redirect(returnTo);
  }

  const { data: existing } = await supabase
    .from('scraps')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .maybeSingle();

  if (existing) {
    await supabase.from('scraps').delete().eq('id', existing.id).eq('user_id', user.id);
  } else {
    await supabase.from('scraps').insert({
      user_id: user.id,
      item_type: itemType,
      item_id: itemId,
      title,
      description: description || null,
      tag: tag || null,
    });
  }

  revalidatePath('/scrap');
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteScrap(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const id = String(formData.get('id') ?? '');
  if (id) {
    await supabase.from('scraps').delete().eq('id', id).eq('user_id', user.id);
  }

  revalidatePath('/scrap');
  redirect('/scrap');
}
