import { refreshProductRating, saveProductRating } from '@/lib/db/products';
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

  const { error: upsertError } = await saveProductRating(supabase, user.id, productId, rating);
  if (upsertError) return NextResponse.json({ error: '평점을 저장하지 못했습니다.' }, { status: 500 });

  const refreshed = await refreshProductRating(productId);
  if (!refreshed) return NextResponse.json({ error: '평점 집계 설정이 없습니다.' }, { status: 503 });
  if (refreshed.error === 'read') return NextResponse.json({ error: '평점 집계를 읽지 못했습니다.' }, { status: 500 });
  if (refreshed.error) return NextResponse.json({ error: '평점 집계를 저장하지 못했습니다.' }, { status: 500 });
  const { average, count } = refreshed;

  revalidatePath('/ai-products');
  revalidatePath(`/ai-products/${productId}`);
  return NextResponse.json({ ok: true, average, ratingCount: count, userRating: rating });
}
