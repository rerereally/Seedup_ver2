import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const body = await request.json().catch(() => null) as { rating?: unknown } | null;
  const rating = Number(body?.rating);
  if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: '1점부터 5점 사이의 평점이 필요합니다.' }, { status: 422 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { error: upsertError } = await supabase.from('ai_product_ratings').upsert(
    { user_id: user.id, product_id: productId, rating, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,product_id' },
  );
  if (upsertError) return NextResponse.json({ error: '평점을 저장하지 못했습니다.' }, { status: 500 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: '평점 집계 설정이 없습니다.' }, { status: 503 });
  const { data: ratings, error: ratingsError } = await admin
    .from('ai_product_ratings')
    .select('rating')
    .eq('product_id', productId);
  if (ratingsError) return NextResponse.json({ error: '평점 집계를 읽지 못했습니다.' }, { status: 500 });

  const count = ratings.length;
  const sum = ratings.reduce((total, item) => total + Number(item.rating ?? 0), 0);
  const average = count ? Number((sum / count).toFixed(2)) : 0;
  const { error: aggregateError } = await admin.from('ai_products').update({
    score: average,
    user_score_sum: sum,
    rating_count: count,
  }).eq('id', productId);
  if (aggregateError) return NextResponse.json({ error: '평점 집계를 저장하지 못했습니다.' }, { status: 500 });

  revalidatePath('/ai-products');
  revalidatePath(`/ai-products/${productId}`);
  return NextResponse.json({ ok: true, average, ratingCount: count, userRating: rating });
}
