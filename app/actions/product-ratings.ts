'use server';

import { createClient } from '@/lib/supabase/server';
import { refreshProductRating, saveProductRating, saveProductReview } from '@/lib/db/products';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

  await saveProductReview(supabase, { productId, userId: user.id, authorName: user.email?.split('@')[0] ?? 'Seedup user', rating, title: title || null, body });
  await saveProductRating(supabase, user.id, productId, rating);
  await refreshProductRating(productId, null);

  revalidatePath('/ai-products');
  revalidatePath(returnTo);
  redirect(returnTo);
}
