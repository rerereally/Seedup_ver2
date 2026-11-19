// AI product reviews and ratings. A visitor's own rating is written with their client (row-level security); the
// product's average is recomputed with the service key, since it reads every visitor's rating.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const now = () => new Date().toISOString();

export function saveProductReview(supabase: SupabaseClient, review: { productId: string; userId: string; authorName: string; rating: number; title: string | null; body: string }) {
  return supabase.from('ai_product_reviews').upsert(
    { product_id: review.productId, user_id: review.userId, author_name: review.authorName, rating: review.rating, title: review.title, body: review.body, updated_at: now() },
    { onConflict: 'user_id,product_id' },
  );
}

export function saveProductRating(supabase: SupabaseClient, userId: string, productId: string, rating: number) {
  return supabase.from('ai_product_ratings').upsert({ user_id: userId, product_id: productId, rating, updated_at: now() }, { onConflict: 'user_id,product_id' });
}

/** Recomputes a product's average from every rating. Null when there is no service key; an error message on failure. */
export async function refreshProductRating(productId: string, emptyAverage: number | null = 0): Promise<{ average: number | null; count: number; error?: string } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: ratings, error } = await admin.from('ai_product_ratings').select('rating').eq('product_id', productId);
  if (error) return { average: null, count: 0, error: 'read' };
  const count = ratings.length;
  const sum = ratings.reduce((total, item) => total + Number(item.rating ?? 0), 0);
  const average = count ? Number((sum / count).toFixed(2)) : emptyAverage;
  const { error: saveError } = await admin.from('ai_products').update({ user_rating_average: average, user_score_sum: sum, rating_count: count }).eq('id', productId);
  return { average, count, ...(saveError ? { error: 'save' } : {}) };
}
