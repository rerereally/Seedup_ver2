import { rateAIProduct, submitAIProductReview } from '@/app/actions/product-ratings';
import { saveScrap } from '@/app/actions/scraps';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import type { AIProduct } from '@/lib/data';
import { getAIProduct, getAIProductReviews, getExistingScrap } from '@/lib/data';
import { incrementContentView } from '@/lib/engagement';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft, Bookmark, Bot, Code2, ExternalLink, ImageIcon, MessageSquare, SquareTerminal, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function normalizedScore(score: number | null) {
  const raw = Number(score ?? 0);
  if (!raw) return 0;
  return Math.max(0, Math.min(5, raw > 10 ? raw / 20 : raw / 2));
}

function displayRating(score: number | null) {
  const normalized = normalizedScore(score);
  return normalized ? normalized.toFixed(1) : '-';
}

function productTags(product: AIProduct) {
  return [product.category, product.pricing_type, product.target_user, ...(product.use_cases ?? [])]
    .filter(Boolean)
    .slice(0, 6) as string[];
}

function productGlyph(product: AIProduct) {
  const text = `${product.name} ${product.category ?? ''}`.toLowerCase();
  if (text.includes('image') || text.includes('midjourney') || text.includes('photo')) return <ImageIcon className="h-8 w-8" />;
  if (text.includes('code') || text.includes('cursor') || text.includes('copilot')) return <Code2 className="h-8 w-8" />;
  if (text.includes('chat') || text.includes('llm') || text.includes('gpt')) return <Bot className="h-8 w-8" />;
  return <SquareTerminal className="h-8 w-8" />;
}

function RatingStars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating}점`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`${size} ${index < rating ? 'fill-ink text-ink' : 'text-muted'}`} />
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-outline-soft py-3">
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="max-w-xs text-right text-sm font-semibold text-ink">{value || '-'}</dd>
    </div>
  );
}

export default async function AIProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: userData }, product, existingScrap, reviews] = await Promise.all([
    supabase ? supabase.auth.getUser() : Promise.resolve({ data: { user: null } }),
    getAIProduct(id),
    getExistingScrap('ai_product', id),
    getAIProductReviews(id),
  ]);

  if (!product) notFound();
  await incrementContentView('ai_product', product.id);

  const isLoggedIn = Boolean(userData.user);
  const homepage = product.website_url ?? product.product_hunt_url;
  const tags = productTags(product);
  const rating = displayRating(product.score);
  const roundedRating = Math.round(normalizedScore(product.score));

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-12">
          <Link href="/ai-products" className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            AI 제품 목록
          </Link>

          <section className="border border-outline-soft bg-white p-5 md:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col gap-5 md:flex-row">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-outline-soft bg-surface text-ink">
                  {productGlyph(product)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">AI_PRODUCT</p>
                  <h1 className="mt-2 break-words text-4xl font-black leading-tight text-ink md:text-6xl">{product.name}</h1>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-muted md:text-lg">
                    {product.description ?? '제품 설명이 아직 수집되지 않았습니다.'}
                  </p>
                  {!!tags.length && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="border border-outline-soft bg-surface px-2.5 py-1 text-xs font-bold text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                {isLoggedIn ? (
                  <form action={saveScrap}>
                    <input type="hidden" name="item_type" value="ai_product" />
                    <input type="hidden" name="item_id" value={product.id} />
                    <input type="hidden" name="title" value={product.name} />
                    <input type="hidden" name="description" value={product.description ?? ''} />
                    <input type="hidden" name="tag" value={product.category ?? 'ai_product'} />
                    <input type="hidden" name="return_to" value={`/ai-products/${product.id}`} />
                    <button type="submit" className="inline-flex h-11 items-center gap-2 border border-outline-soft bg-white px-4 text-sm font-bold text-ink hover:border-ink">
                      <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-ink text-ink' : ''}`} />
                      {existingScrap ? '저장됨' : '저장'}
                    </button>
                  </form>
                ) : (
                  <Link href="/login" className="inline-flex h-11 items-center gap-2 border border-outline-soft bg-white px-4 text-sm font-bold text-ink hover:border-ink">
                    <Bookmark className="h-4 w-4" />
                    로그인 후 저장
                  </Link>
                )}
                {homepage && (
                  <Link href={homepage} target="_blank" className="inline-flex h-11 items-center gap-2 bg-ink px-4 text-sm font-bold text-white hover:bg-muted">
                    <ExternalLink className="h-4 w-4" />
                    사이트 방문
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-7 grid gap-4 border-t border-outline-soft pt-5 md:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase text-muted">평균 평점</p>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-3xl font-black text-ink">{rating}</p>
                  <RatingStars rating={roundedRating} />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted">리뷰</p>
                <p className="mt-2 text-3xl font-black text-ink">{reviews.length}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted">평가 참여</p>
                <p className="mt-2 text-3xl font-black text-ink">{product.rating_count ?? 0}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted">조회</p>
                <p className="mt-2 text-3xl font-black text-ink">{Number(product.view_count ?? 0) + 1}</p>
              </div>
            </div>
          </section>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <section className="border border-outline-soft bg-white p-5 md:p-7">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-outline-soft pb-4">
                  <div>
                    <h2 className="text-xl font-black text-ink">평점 남기기</h2>
                    <p className="mt-1 text-sm text-muted">써본 사람의 짧은 평가가 다른 개발자에게 제일 도움이 됩니다.</p>
                  </div>
                </div>
                {isLoggedIn ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <form key={score} action={rateAIProduct}>
                        <input type="hidden" name="product_id" value={product.id} />
                        <input type="hidden" name="rating" value={score} />
                        <input type="hidden" name="return_to" value={`/ai-products/${product.id}`} />
                        <button type="submit" className="inline-flex h-10 items-center gap-1 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink">
                          <Star className="h-4 w-4" />
                          {score}
                        </button>
                      </form>
                    ))}
                  </div>
                ) : (
                  <Link href="/login" className="inline-flex h-11 items-center border border-outline-soft bg-ink px-4 text-sm font-bold text-white">
                    로그인하고 평점 남기기
                  </Link>
                )}
              </section>

              <section className="border border-outline-soft bg-white p-5 md:p-7">
                <div className="mb-5 flex items-center gap-3 border-b border-outline-soft pb-4">
                  <MessageSquare className="h-5 w-5 text-ink" />
                  <div>
                    <h2 className="text-xl font-black text-ink">리뷰 작성</h2>
                    <p className="mt-1 text-sm text-muted">장점, 아쉬운 점, 실제 사용처를 짧게 남겨주세요.</p>
                  </div>
                </div>
                {isLoggedIn ? (
                  <form action={submitAIProductReview} className="grid gap-3">
                    <input type="hidden" name="product_id" value={product.id} />
                    <input type="hidden" name="return_to" value={`/ai-products/${product.id}`} />
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <label key={score} className="inline-flex h-10 cursor-pointer items-center gap-2 border border-outline-soft bg-surface px-3 text-sm font-bold text-ink">
                          <input className="accent-black" type="radio" name="rating" value={score} required />
                          {score}점
                        </label>
                      ))}
                    </div>
                    <input
                      name="title"
                      maxLength={80}
                      className="h-11 border border-outline-soft bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-ink"
                      placeholder="리뷰 제목"
                    />
                    <textarea
                      name="body"
                      minLength={5}
                      maxLength={1200}
                      required
                      className="min-h-36 resize-y border border-outline-soft bg-white p-3 text-sm leading-7 text-ink outline-none focus:border-ink"
                      placeholder="실제로 써보니 어떤 점이 좋았나요? 어떤 상황에서는 별로였나요?"
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="h-11 bg-ink px-5 text-sm font-bold text-white hover:bg-muted">
                        리뷰 등록
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="border border-outline-soft bg-surface p-5">
                    <p className="text-sm font-semibold leading-7 text-muted">리뷰를 남기려면 로그인이 필요합니다.</p>
                    <Link href="/login" className="mt-4 inline-flex h-11 items-center bg-ink px-4 text-sm font-bold text-white">
                      로그인하고 리뷰 작성
                    </Link>
                  </div>
                )}
              </section>

              <section className="border border-outline-soft bg-white p-5 md:p-7">
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-soft pb-4">
                  <div>
                    <h2 className="text-xl font-black text-ink">유저 리뷰</h2>
                    <p className="mt-1 text-sm text-muted">{reviews.length}개의 의견이 등록되어 있습니다.</p>
                  </div>
                </div>
                {reviews.length ? (
                  <div className="grid gap-4">
                    {reviews.map((review) => (
                      <article key={review.id} className="border border-outline-soft bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-ink">{review.author_name ?? 'Seedup user'}</p>
                            <p className="mt-1 text-xs font-bold uppercase text-muted">{new Date(review.created_at).toLocaleDateString('ko-KR')}</p>
                          </div>
                          <RatingStars rating={review.rating} />
                        </div>
                        {review.title && <h3 className="mt-4 text-lg font-black text-ink">{review.title}</h3>}
                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted">{review.body}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-outline-soft bg-surface p-8 text-center">
                    <p className="text-sm font-bold text-ink">아직 등록된 리뷰가 없습니다.</p>
                    <p className="mt-2 text-sm text-muted">첫 번째 사용 후기를 남겨주세요.</p>
                  </div>
                )}
              </section>
            </div>

            <aside className="w-full lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
              <section className="border border-outline-soft bg-white p-5">
                <h2 className="mb-2 text-xl font-black text-ink">제품 정보</h2>
                <dl>
                  <InfoRow label="category" value={product.category} />
                  <InfoRow label="pricing" value={product.pricing_type} />
                  <InfoRow label="target" value={product.target_user} />
                  <InfoRow label="status" value={product.status} />
                </dl>
              </section>

              <section className="mt-5 border border-outline-soft bg-white p-5">
                <h2 className="mb-4 text-xl font-black text-ink">반응</h2>
                <ContentEngagement
                  itemType="ai_product"
                  itemId={product.id}
                  returnTo={`/ai-products/${product.id}`}
                  views={Number(product.view_count ?? 0) + 1}
                  likes={product.like_count}
                  dislikes={product.dislike_count}
                />
              </section>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
