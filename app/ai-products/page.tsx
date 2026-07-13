import { saveScrap } from '@/app/actions/scraps';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import type { AIProduct } from '@/lib/data';
import { getAIProducts, getScrapKeySet } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { ArrowRight, Bookmark, Bot, Code2, ImageIcon, Search, SquareTerminal, Star } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 9;

function displayRating(score: number | null, ratingCount: number | null) {
  const raw = Number(score ?? 0);
  if (!raw) return '-';
  return (ratingCount && ratingCount > 0 ? raw : raw > 10 ? raw / 20 : raw / 2).toFixed(1);
}

function buildHref(params: { q?: string; category?: string; pricing?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.pricing && params.pricing !== 'all') query.set('pricing', params.pricing);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const search = query.toString();
  return `/ai-products${search ? `?${search}` : ''}`;
}

function normalized(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function categoryLabel(category?: string | null) {
  if (!category) return 'AI Tool';
  if (category.toLowerCase().includes('llm')) return 'LLM';
  if (category.toLowerCase().includes('image')) return 'Image Gen';
  if (category.toLowerCase().includes('coding')) return 'Coding Assistant';
  return category;
}

function ProductIcon({ product }: { product: AIProduct }) {
  const text = `${product.name} ${product.category ?? ''}`.toLowerCase();
  if (text.includes('chatgpt') || text.includes('llm')) return <Bot className="h-5 w-5" />;
  if (text.includes('image') || text.includes('midjourney')) return <ImageIcon className="h-5 w-5" />;
  if (text.includes('code') || text.includes('cursor') || text.includes('copilot')) return <Code2 className="h-5 w-5" />;
  return <SquareTerminal className="h-5 w-5" />;
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-2 text-sm text-muted hover:text-ink">
      <span className={`flex h-4 w-4 items-center justify-center border ${active ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-white'}`}>
        {active ? '✓' : ''}
      </span>
      <span className={active ? 'font-black text-ink' : ''}>{children}</span>
    </Link>
  );
}

export default async function AIProducts({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; category?: string; pricing?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const category = params.category ?? 'all';
  const pricing = params.pricing ?? 'all';
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const supabase = await createClient();
  const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const isLoggedIn = Boolean(userData.user);
  const [products, scrapKeys] = await Promise.all([getAIProducts(), getScrapKeySet()]);
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[])).slice(0, 6);
  const pricingTypes = Array.from(new Set(products.map((product) => product.pricing_type).filter(Boolean) as string[])).slice(0, 5);
  const filteredProducts = products.filter((product) => {
    const q = query.toLowerCase();
    const matchesQuery = !q || [product.name, product.description, product.category, product.target_user, ...(product.use_cases ?? [])]
      .some((value) => value?.toLowerCase().includes(q));
    const matchesCategory = category === 'all' || normalized(product.category) === normalized(category);
    const matchesPricing = pricing === 'all' || normalized(product.pricing_type) === normalized(pricing);
    return matchesQuery && matchesCategory && matchesPricing;
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
          <section className="border-b border-outline-soft pb-7">
            <div className="mb-4 text-xs font-black uppercase text-muted">directory</div>
            <h1 className="text-4xl font-black leading-tight text-ink md:text-5xl">AI Tools Directory</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
              개발자를 위한 생산성 향상 AI 도구 모음. 카테고리별로 필터링하여 프로젝트에 필요한 도구를 빠르게 찾아보세요.
            </p>
            <form action="/ai-products" className="mt-6 flex max-w-xl items-center gap-2 border border-outline-soft bg-white px-4 py-3">
              <Search className="h-4 w-4 text-muted" />
              <input name="q" defaultValue={query} placeholder="Search AI tools..." className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
              {category !== 'all' && <input type="hidden" name="category" value={category} />}
              {pricing !== 'all' && <input type="hidden" name="pricing" value={pricing} />}
            </form>
          </section>

          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
            <aside className="w-full space-y-4 lg:sticky lg:top-20 lg:w-60 lg:shrink-0">
              <div className="border border-outline-soft bg-white p-4">
                <div className="mb-3 border-b border-outline-soft pb-3 text-xs font-black uppercase text-ink">Category</div>
                <div className="space-y-3">
                  <FilterLink href={buildHref({ q: query, pricing })} active={category === 'all'}>All Tools</FilterLink>
                  {categories.map((item) => (
                    <FilterLink key={item} href={buildHref({ q: query, category: item, pricing })} active={normalized(category) === normalized(item)}>
                      {item}
                    </FilterLink>
                  ))}
                </div>
              </div>
              <div className="border border-outline-soft bg-white p-4">
                <div className="mb-3 border-b border-outline-soft pb-3 text-xs font-black uppercase text-ink">Pricing</div>
                <div className="space-y-3">
                  <FilterLink href={buildHref({ q: query, category })} active={pricing === 'all'}>All Pricing</FilterLink>
                  {pricingTypes.map((item) => (
                    <FilterLink key={item} href={buildHref({ q: query, category, pricing: item })} active={normalized(pricing) === normalized(item)}>
                      {item}
                    </FilterLink>
                  ))}
                </div>
              </div>
            </aside>

            <section className="min-w-0 flex-1">
              {!filteredProducts.length ? (
                <EmptyState
                  title={products.length ? '검색 결과가 없습니다' : '아직 등록된 AI 제품이 없습니다'}
                  description={products.length ? '다른 제품명이나 카테고리로 다시 검색해보세요.' : '곧 추천할 만한 AI 제품을 정리해 보여드릴게요.'}
                  actionHref={products.length ? '/ai-products' : undefined}
                  actionLabel={products.length ? '전체 제품 보기' : undefined}
                />
              ) : (
                <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase text-muted">
                  <span>{filteredProducts.length} tools indexed</span>
                  <span>Updated weekly</span>
                </div>
                <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedProducts.map((product, index) => {
                    const isScrapped = scrapKeys.has(`ai_product:${product.id}`);
                    const rating = displayRating(product.score, product.rating_count);
                    const ratingCount = product.rating_count ?? 0;
                    const globalIndex = (currentPage - 1) * PAGE_SIZE + index + 1;

                    return (
                      <article key={product.id} className="group flex min-h-[268px] flex-col border border-outline-soft bg-white p-4 transition-colors hover:border-ink">
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center border border-outline-soft bg-surface text-ink">
                            <ProductIcon product={product} />
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">
                              #{globalIndex}
                            </span>
                            <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">
                              {product.pricing_type ?? product.status ?? 'Tool'}
                            </span>
                          </div>
                        </div>

                        <Link href={`/ai-products/${product.id}`} className="block">
                          <h2 className="line-clamp-2 text-2xl font-black leading-tight text-ink group-hover:underline">{product.name}</h2>
                          <div className="mt-2 inline-flex border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">
                            {categoryLabel(product.category)}
                          </div>
                          <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">
                            {product.description ?? product.target_user ?? '개발 워크플로우에 붙여볼 만한 AI 제품입니다.'}
                          </p>
                        </Link>

                        <div className="mt-auto border-t border-outline-soft pt-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1 text-xs font-black text-ink">
                              <Star className="h-3.5 w-3.5" />
                              {rating} <span className="font-bold text-muted">({ratingCount.toLocaleString()})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isLoggedIn ? (
                                <form action={saveScrap}>
                                  <input type="hidden" name="item_type" value="ai_product" />
                                  <input type="hidden" name="item_id" value={product.id} />
                                  <input type="hidden" name="title" value={product.name} />
                                  <input type="hidden" name="description" value={product.description ?? ''} />
                                  <input type="hidden" name="tag" value={product.category ?? 'ai_product'} />
                                  <input type="hidden" name="return_to" value={buildHref({ q: query, category, pricing, page: currentPage })} />
                                  <button type="submit" className="inline-flex h-8 w-8 items-center justify-center border border-outline-soft bg-white text-muted hover:border-ink hover:text-ink" aria-label={`${product.name} ${isScrapped ? '저장 해제' : '저장하기'}`}>
                                    <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-ink text-ink' : ''}`} />
                                  </button>
                                </form>
                              ) : (
                                <Link href="/login" className="text-xs font-bold uppercase text-muted hover:text-ink">Login</Link>
                              )}
                              <Link href={`/ai-products/${product.id}`} className="text-muted transition-colors group-hover:text-ink" aria-label={`${product.name} 상세 보기`}>
                                <ArrowRight className="h-5 w-5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {filteredProducts.length > PAGE_SIZE && (
                  <nav className="mt-8 flex justify-center gap-2">
                    {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => {
                      const pageNumber = index + 1;
                      return (
                        <Link key={pageNumber} href={buildHref({ q: query, category, pricing, page: pageNumber })} className={`inline-flex h-10 w-10 items-center justify-center text-sm font-bold ${currentPage === pageNumber ? 'bg-ink text-white' : 'border border-outline-soft bg-white text-muted hover:border-ink hover:text-ink'}`}>
                          {pageNumber}
                        </Link>
                      );
                    })}
                  </nav>
                )}
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
