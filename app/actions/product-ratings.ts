'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function rateAIProduct(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const productId = String(formData.get('product_id') ?? '');
  const rating = Math.max(1, Math.min(5, Number(formData.get('rating') ?? 0)));
  const returnTo = String(formData.get('return_to') ?? '/ai-products');
  if (!productId || !rating) redirect(returnTo);

  await supabase.from('ai_product_ratings').upsert(
    {
      user_id: user.id,
      product_id: productId,
      rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,product_id' },
  );

  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from('ai_product_ratings').select('rating').eq('product_id', productId);
    const ratings = data ?? [];
    const sum = ratings.reduce((total, item) => total + Number(item.rating ?? 0), 0);
    await admin.from('ai_products').update({
      user_rating_average: ratings.length ? Number((sum / ratings.length).toFixed(2)) : null,
      user_score_sum: sum,
      rating_count: ratings.length,
    }).eq('id', productId);
  }

  revalidatePath('/ai-products');
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function submitAIProductReview(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const productId = String(formData.get('product_id') ?? '');
  const rating = Math.max(1, Math.min(5, Number(formData.get('rating') ?? 0)));
  const title = String(formData.get('title') ?? '').trim().slice(0, 80);
  const body = String(formData.get('body') ?? '').trim().slice(0, 1200);
  const returnTo = String(formData.get('return_to') ?? '/ai-products');

  if (!productId || !rating || body.length < 5) redirect(returnTo);

  await supabase.from('ai_product_reviews').upsert(
    {
      product_id: productId,
      user_id: user.id,
      author_name: user.email?.split('@')[0] ?? 'Seedup user',
      rating,
      title: title || null,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,product_id' },
  );

  await supabase.from('ai_product_ratings').upsert(
    {
      user_id: user.id,
      product_id: productId,
      rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,product_id' },
  );

  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from('ai_product_ratings').select('rating').eq('product_id', productId);
    const ratings = data ?? [];
    const sum = ratings.reduce((total, item) => total + Number(item.rating ?? 0), 0);
    await admin.from('ai_products').update({
      user_rating_average: ratings.length ? Number((sum / ratings.length).toFixed(2)) : null,
      user_score_sum: sum,
      rating_count: ratings.length,
    }).eq('id', productId);
  }

  revalidatePath('/ai-products');
  revalidatePath(returnTo);
  redirect(returnTo);
}
