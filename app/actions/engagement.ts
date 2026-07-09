'use server';

import { refreshContentReactionCounts } from '@/lib/engagement';
import { createClient } from '@/lib/supabase/server';
import type { ContentTarget } from '@/lib/content-targets';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const ALLOWED_TYPES = new Set<ContentTarget>(['news', 'paper', 'github', 'project', 'ai_product']);

export async function reactToContent(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const itemType = String(formData.get('item_type') ?? '') as ContentTarget;
  const itemId = String(formData.get('item_id') ?? '');
  const reaction = String(formData.get('reaction') ?? '');
  const returnTo = String(formData.get('return_to') ?? '/');

  if (!ALLOWED_TYPES.has(itemType) || !itemId || !['like', 'dislike'].includes(reaction)) {
    redirect(returnTo);
  }

  const { data: existing } = await supabase
    .from('content_reactions')
    .select('id,reaction')
    .eq('user_id', user.id)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .maybeSingle();

  if (existing?.reaction === reaction) {
    await supabase.from('content_reactions').delete().eq('id', existing.id).eq('user_id', user.id);
  } else if (existing) {
    await supabase
      .from('content_reactions')
      .update({ reaction, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('user_id', user.id);
  } else {
    await supabase.from('content_reactions').insert({
      user_id: user.id,
      item_type: itemType,
      item_id: itemId,
      reaction,
    });
  }

  await refreshContentReactionCounts(itemType, itemId);
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function submitRecommendationFeedback(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const itemType = String(formData.get('item_type') ?? '') as ContentTarget;
  const itemId = String(formData.get('item_id') ?? '');
  const feedback = String(formData.get('feedback') ?? '');
  const surface = String(formData.get('surface') ?? 'unknown');
  const returnTo = String(formData.get('return_to') ?? '/');

  if (!ALLOWED_TYPES.has(itemType) || !itemId || !['useful', 'not_relevant', 'show_less'].includes(feedback)) {
    redirect(returnTo);
  }

  await supabase
    .from('recommendation_feedback')
    .upsert(
      {
        user_id: user.id,
        item_type: itemType,
        item_id: itemId,
        feedback,
        surface,
      },
      { onConflict: 'user_id,item_type,item_id,surface' },
    );

  revalidatePath(returnTo);
  redirect(returnTo);
}
