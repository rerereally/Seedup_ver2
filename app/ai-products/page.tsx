import { saveScrap } from '@/app/actions/scraps';
import { rateAIProduct } from '@/app/actions/product-ratings';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import type { AIProduct } from '@/lib/data';
import { getAIProducts, getScrapKeySet } from '@/lib/data';
import { Bookmark, Bot, ChevronRight, Flame, Search, Star, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 10;

function productTags(product: AIProduct) {
  return [product.category, product.pricing_type, product.target_user, ...(product.use_cases ?? [])]
    .filter(Boolean)
    .slice(0, 6) as string[];
}

function riskTags(product: AIProduct) {
  const tags = ['실사용 검증 필요', '가격 확인 필요'];
  if (product.pricing_type === 'Unknown') tags.unshift('요금제 불명확');
  if (!product.website_url) tags.unshift('공식 링크 확인 필요');
  return tags.slice(0, 4);
}

function StarRating({ score }: { score: number | null }) {
  const raw = Number(score ?? 0);
  const normalized = Math.max(0, Math.min(5, raw > 10 ? raw / 20 : raw / 2));
  const filled = Math.round(normalized);

  return (
    <div className="flex items-center gap-0.5" aria-label={`평점 ${normalized.toFixed(1)}점`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`h-5 w-5 ${index < filled ? 'fill-yellow-400 text-yellow-400' : 'fill-surface-high text-surface-high'}`} />
      ))}
    </div>
  );
}

function displayRating(score: number | null) {
  const raw = Number(score ?? 0);
  if (!raw) return '-';
  return (raw > 10 ? raw / 20 : raw / 2).toFixed(2);
}

function buildHref(params: { q?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const search = query.toString();
  return `/ai-products${search ? `?${search}` : ''}`;
}

export default async function AIProducts({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? '';
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const [products, scrapKeys] = await Promise.all([getAIProducts(), getScrapKeySet()]);
  const filteredProducts = products.filter((product) => {
    if (!query) return true;
    return [product.name, product.description, product.category, product.target_user, ...(product.use_cases ?? [])]
      .some((value) => value?.toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell">
          <PageIntro
            eyebrow="AI Ranking"
            title="AI 제품랭크"
            description="다음 프로젝트에 영감을 줄 AI 제품을 평가하고, 초보 개발자가 어디에 활용할 수 있는지 빠르게 확인하세요."
            icon={Flame}
            meta={`총 ${products.length}개 제품`}
          />

          <form action="/ai-products" className="mb-6 mt-9 flex max-w-xl items-center gap-2 rounded-xl border border-outline-soft bg-white px-4 py-3">
            <Search className="h-4 w-4 text-muted" />
            <input name="q" defaultValue={params.q ?? ''} placeholder="AI 제품 검색" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
          </form>

          {!filteredProducts.length ? (
            <EmptyState
              title={products.length ? '검색 결과가 없습니다' : '아직 등록된 AI 제품이 없습니다'}
              description={products.length ? '다른 제품명이나 카테고리로 다시 검색해보세요.' : '곧 추천할 만한 AI 제품을 정리해 보여드릴게요.'}
              actionHref={products.length ? '/ai-products' : undefined}
              actionLabel={products.length ? '전체 제품 보기' : undefined}
            />
          ) : (
            <section className="flex flex-col gap-4">
              {paginatedProducts.map((product, index) => {
                const isScrapped = scrapKeys.has(`ai_product:${product.id}`);
                const tags = productTags(product);
                const risks = riskTags(product).slice(0, 2);
                const displayScore = displayRating(product.score);

                return (
                  <article key={product.id} className="group rounded-xl border border-outline-soft bg-white p-5 shadow-sm transition-all hover:border-brand-primary/60 hover:shadow-md">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                      <div className="flex items-center gap-3 lg:w-24 lg:flex-col lg:items-start">
                        <span className="inline-flex h-7 items-center rounded-md border border-outline-soft bg-surface px-2 text-xs font-black text-muted">
                          #{(currentPage - 1) * PAGE_SIZE + index + 1}
                        </span>
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-outline-soft bg-white text-2xl font-black text-ink">
                          {product.name.toLowerCase().includes('chatgpt') ? <Bot className="h-8 w-8 text-ink" /> : product.name.slice(0, 1)}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-2xl font-bold leading-tight text-ink transition-colors group-hover:text-brand-primary">{product.name}</h2>
                              {product.status && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-brand-primary/20 bg-brand-primary/10 px-2 py-1 text-xs font-bold text-brand-primary">
                                  <Flame className="h-3.5 w-3.5" />
                                  {product.status}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <StarRating score={product.score} />
                              <span className="text-sm font-semibold text-muted">{displayScore} / 5 · {product.rating_count ?? 0}명 평가</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <form action={saveScrap}>
                              <input type="hidden" name="item_type" value="ai_product" />
                              <input type="hidden" name="item_id" value={product.id} />
                              <input type="hidden" name="title" value={product.name} />
                              <input type="hidden" name="description" value={product.description ?? ''} />
                              <input type="hidden" name="tag" value={product.category ?? 'ai_product'} />
                              <input type="hidden" name="return_to" value="/ai-products" />
                              <button type="submit" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-outline-soft bg-white text-muted transition-colors hover:border-brand-primary hover:text-brand-primary" aria-label={`${product.name} 스크랩`}>
                                <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-brand-primary text-brand-primary' : ''}`} />
                              </button>
                            </form>
                            <Link href={`/ai-products/${product.id}`} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-ink px-4 text-sm font-bold text-white transition-opacity hover:opacity-90">
                              상세
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>

                        {product.description && <p className="mt-4 line-clamp-2 max-w-3xl text-sm leading-6 text-muted">{product.description}</p>}

                        {!!tags.length && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {tags.map((tag) => (
                              <span key={tag} className="rounded-md border border-outline-soft bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 grid gap-3 border-t border-outline-soft pt-4 md:grid-cols-[1fr_auto] md:items-center">
                          <div className="flex flex-wrap gap-2">
                            {(product.use_cases ?? []).slice(0, 3).map((useCase) => (
                              <span key={useCase} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                {useCase}
                              </span>
                            ))}
                            {risks.slice(0, 1).map((risk) => (
                              <span key={risk} className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                                {risk}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="mr-1 text-xs font-bold text-muted">내 평점</span>
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <form key={rating} action={rateAIProduct}>
                                <input type="hidden" name="product_id" value={product.id} />
                                <input type="hidden" name="rating" value={rating} />
                                <input type="hidden" name="return_to" value={buildHref({ q: params.q?.trim(), page: currentPage })} />
                                <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-soft bg-white text-xs font-black text-muted hover:border-brand-primary hover:text-brand-primary">{rating}</button>
                              </form>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
          {filteredProducts.length > PAGE_SIZE && (
            <nav className="mt-8 flex justify-center gap-2">
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <Link key={pageNumber} href={buildHref({ q: params.q?.trim(), page: pageNumber })} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${currentPage === pageNumber ? 'bg-brand-primary text-white' : 'border border-outline-soft bg-white text-muted hover:border-brand-primary hover:text-brand-primary'}`}>
                    {pageNumber}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
