import type { Metadata } from 'next';
import { submitAIProductReview } from '@/app/actions/product-ratings';
import { AIProductRatingControl, ProductRatingSummary } from '@/components/AIProductRating';
import ScrapButton from '@/components/ScrapButton';
import ContentEngagement from '@/components/ContentEngagement';
import ViewTracker from '@/components/ViewTracker';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import type { AIProduct } from '@/lib/data';
import { getAIProduct, getAIProductReviews, getExistingScrap } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { Bot, Code2, ExternalLink, ImageIcon, SquareTerminal, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'AI 제품 상세',
};

const PRICING_LABELS: Record<string, string> = { free: '무료', freemium: '부분 무료', paid: '유료', 'open source': '오픈소스' };
const CATEGORY_LABELS: Record<string, string> = { devtools: '개발 도구', automation: '자동화', llm: 'LLM', productivity: '생산성', design: '디자인' };
const STATUS_LABELS: Record<string, string> = { new: '새로 나옴', active: '운영 중', beta: '베타' };

// Collectors write "Unknown" when a product page does not say, which is not worth a row.
function known(value: string | null | undefined, labels: Record<string, string> = {}) {
  const key = value?.trim().toLowerCase();
  if (!key || key === 'unknown') return null;
  return labels[key] ?? value;
}

function productGlyph(product: AIProduct) {
  const text = `${product.name} ${product.category ?? ''}`.toLowerCase();
  if (text.includes('image') || text.includes('midjourney') || text.includes('photo')) return <ImageIcon className="h-6 w-6" />;
  if (text.includes('code') || text.includes('cursor') || text.includes('copilot')) return <Code2 className="h-6 w-6" />;
  if (text.includes('chat') || text.includes('llm') || text.includes('gpt')) return <Bot className="h-6 w-6" />;
  return <SquareTerminal className="h-6 w-6" />;
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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="text-right text-sm leading-6 text-ink">{value}</dd>
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

  const isLoggedIn = Boolean(userData.user);
  const homepage = product.website_url ?? product.product_hunt_url;
  const useCases = (product.use_cases ?? []).slice(0, 5);
  const meta = ['AI 제품', known(product.category, CATEGORY_LABELS), known(product.pricing_type, PRICING_LABELS)].filter(Boolean).join(' · ');

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <Link href="/ai-products" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><span aria-hidden="true">←</span> AI 제품 목록</Link>
        <div className="mt-4 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-high text-ink">{productGlyph(product)}</span>
              <p className="text-sm text-muted">{meta}</p>
            </div>
            <h1 className="page-intro-title mt-4 break-words md:text-[52px] md:leading-[1.08]">{product.name}</h1>
            {product.description && <p className="mt-4 max-w-[38em] text-lg leading-8 text-muted">{product.description}</p>}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {homepage && (
                <Link href={homepage} target="_blank" rel="noreferrer" className="btn">
                  사이트 열기
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </Link>
              )}
              <ScrapButton itemType="ai_product" itemId={product.id} title={product.name} description={product.description} tag={product.category ?? 'ai_product'} initialSaved={Boolean(existingScrap)} savedLabel="저장됨" className="btn-quiet" />
            </div>

            <dl className="card mt-8 grid grid-cols-2 overflow-hidden sm:grid-cols-4">
              <ProductRatingSummary productId={product.id} ratingAverage={product.user_rating_average ?? null} ratingCount={product.rating_count} />
              <div className="border-t border-outline-soft px-5 py-4 sm:border-l sm:border-t-0">
                <dt className="label">리뷰</dt>
                <dd className="num mt-1 text-[28px] font-semibold leading-tight text-ink">{reviews.length}</dd>
              </div>
              <div className="border-l border-t border-outline-soft px-5 py-4 sm:border-t-0">
                <dt className="label">조회</dt>
                <dd className="num mt-1 text-[28px] font-semibold leading-tight text-ink">{(Number(product.view_count ?? 0) + 1).toLocaleString('en-US')}</dd>
              </div>
            </dl>

            {useCases.length > 0 && (
              <section className="mt-10">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">이럴 때 씁니다</h2>
                <ul className="mt-2 divide-y divide-outline-soft">
                  {useCases.map((item) => <li key={item} className="py-3 text-[15px] leading-7 text-ink">{item}</li>)}
                </ul>
              </section>
            )}

            <section className="mt-12">
              <h2 className="flex items-baseline gap-2 text-xl font-extrabold tracking-tight text-ink">써 본 사람의 리뷰 <span className="num text-base font-medium text-muted">{reviews.length}</span></h2>
              {reviews.length ? (
                <ul className="mt-4 grid gap-3">
                  {reviews.map((review) => (
                    <li key={review.id} className="card p-5 md:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[13px] text-muted"><span className="font-bold text-ink">{review.author_name ?? 'Seedup 사용자'}</span> · {new Date(review.created_at).toLocaleDateString('ko-KR')}</p>
                        <RatingStars rating={review.rating} />
                      </div>
                      {review.title && <h3 className="mt-3 text-[17px] font-bold leading-snug text-ink">{review.title}</h3>}
                      <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-muted">{review.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted">아직 리뷰가 없습니다. 써 봤다면 첫 리뷰를 남겨 주세요.</p>
              )}

              <div className="card mt-5 p-5 md:p-6">
                <h3 className="text-[17px] font-bold text-ink">리뷰 남기기</h3>
                {isLoggedIn ? (
                  <form action={submitAIProductReview} className="mt-4 grid gap-3">
                    <input type="hidden" name="product_id" value={product.id} />
                    <input type="hidden" name="return_to" value={`/ai-products/${product.id}`} />
                    <fieldset>
                      <legend className="label">평점</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <label key={score} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-outline-soft px-3.5 text-sm text-ink has-[:checked]:border-ink has-[:checked]:font-bold">
                            <input className="sr-only" type="radio" name="rating" value={score} required />
                            <span className="num">{score}</span>점
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <input name="title" maxLength={80} aria-label="리뷰 제목" placeholder="제목 (선택)" className="h-11 border bg-transparent px-3.5 text-sm text-ink placeholder:text-muted" />
                    <textarea name="body" minLength={5} maxLength={1200} required aria-label="리뷰 내용" placeholder="써 보니 어떤 점이 좋았고, 어떤 상황에서는 아쉬웠나요?" className="min-h-32 resize-y border bg-transparent p-3.5 text-sm leading-7 text-ink placeholder:text-muted" />
                    <div className="flex justify-end">
                      <button type="submit" className="btn">리뷰 올리기</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="mt-1.5 text-sm leading-6 text-muted">리뷰는 로그인한 뒤에 남길 수 있습니다.</p>
                    <Link href={`/login?next=${encodeURIComponent(`/ai-products/${product.id}`)}`} className="btn-quiet mt-4">로그인</Link>
                  </>
                )}
              </div>
            </section>
          </article>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <section className="card p-5 md:p-6">
              <h2 className="label">별점만 남기기</h2>
              <div className="mt-3"><AIProductRatingControl productId={product.id} isLoggedIn={isLoggedIn} /></div>
            </section>

            <section className="card px-5 py-3 md:px-6">
              <dl className="divide-y divide-outline-soft">
                <InfoRow label="분류" value={known(product.category, CATEGORY_LABELS)} />
                <InfoRow label="가격" value={known(product.pricing_type, PRICING_LABELS)} />
                <InfoRow label="누구에게" value={known(product.target_user)} />
                <InfoRow label="상태" value={known(product.status, STATUS_LABELS)} />
              </dl>
              <div className="border-t border-outline-soft pt-1">
                <ViewTracker itemType="ai_product" itemId={product.id} />
                <ContentEngagement itemType="ai_product" itemId={product.id} returnTo={`/ai-products/${product.id}`} views={Number(product.view_count ?? 0) + 1} likes={product.like_count} dislikes={product.dislike_count} />
              </div>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
