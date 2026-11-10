import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import type { AIProduct } from '@/lib/data';
import { getAIProducts, getScrapKeySet } from '@/lib/data';
import PageIntro from '@/components/PageIntro';
import { Bot, Code2, ImageIcon, Search, SquareTerminal, Star } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI 제품',
};

const PAGE_SIZE = 9;

function displayRating(average: number | null, ratingCount: number | null) {
  if (!ratingCount || ratingCount < 1 || average === null) return '-';
  return Math.max(0, Math.min(5, Number(average))).toFixed(1);
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

const CATEGORY_LABELS: Record<string, string> = { devtools: '개발 도구', automation: '자동화', llm: 'LLM', productivity: '생산성', design: '디자인' };
const PRICING_LABELS: Record<string, string> = { free: '무료', freemium: '부분 무료', paid: '유료', 'open source': '오픈소스' };

function categoryLabel(category?: string | null) {
  if (!category) return 'AI 도구';
  return CATEGORY_LABELS[normalized(category)] ?? category;
}

// Collectors write "Unknown" when a product page does not say. That is not a price, so it is not shown.
function pricingLabel(pricing?: string | null) {
  const key = normalized(pricing);
  if (!key || key === 'unknown') return null;
  return PRICING_LABELS[key] ?? pricing;
}

function ProductIcon({ product }: { product: AIProduct }) {
  const text = `${product.name} ${product.category ?? ''}`.toLowerCase();
  if (text.includes('chatgpt') || text.includes('llm')) return <Bot className="h-5 w-5" />;
  if (text.includes('image') || text.includes('midjourney')) return <ImageIcon className="h-5 w-5" />;
  if (text.includes('code') || text.includes('cursor') || text.includes('copilot')) return <Code2 className="h-5 w-5" />;
  return <SquareTerminal className="h-5 w-5" />;
}

export default async function AIProducts({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; category?: string; pricing?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const category = params.category ?? 'all';
  const pricing = params.pricing ?? 'all';
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const [products, scrapKeys] = await Promise.all([getAIProducts(), getScrapKeySet()]);
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[])).slice(0, 6);
  const pricingTypes = Array.from(new Set(products.map((product) => product.pricing_type).filter((value): value is string => Boolean(pricingLabel(value))))).slice(0, 5);
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
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            title="AI 제품"
            description="개발할 때 붙여 쓸 만한 AI 제품을 모았습니다. 무엇을 하는 제품인지 한국어로 줄여 두었습니다."
            meta={products.length ? <>제품 <span className="num text-ink">{products.length}</span>개</> : undefined}
            aside={(
              <form action="/ai-products" role="search" className="flex h-11 w-full items-center gap-2.5 rounded-full border border-outline-soft bg-white px-4 transition-colors focus-within:border-ink sm:w-72">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                <input name="q" defaultValue={query} aria-label="AI 제품 검색" placeholder="제품 이름이나 쓰임새" className="min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm text-ink placeholder:text-muted" style={{ outline: 'none' }} />
                {category !== 'all' && <input type="hidden" name="category" value={category} />}
                {pricing !== 'all' && <input type="hidden" name="pricing" value={pricing} />}
              </form>
            )}
          />

          {products.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <nav aria-label="분류" className="tabs">
                <Link href={buildHref({ q: query, pricing })} aria-current={category === 'all' ? 'page' : undefined} className="tab">전체</Link>
                {categories.map((item) => (
                  <Link key={item} href={buildHref({ q: query, category: item, pricing })} aria-current={normalized(category) === normalized(item) ? 'page' : undefined} className="tab">{categoryLabel(item)}</Link>
                ))}
              </nav>
              {pricingTypes.length > 0 && (
                <nav aria-label="가격" className="tabs">
                  <Link href={buildHref({ q: query, category })} aria-current={pricing === 'all' ? 'page' : undefined} className="tab">가격 전체</Link>
                  {pricingTypes.map((item) => (
                    <Link key={item} href={buildHref({ q: query, category, pricing: item })} aria-current={normalized(pricing) === normalized(item) ? 'page' : undefined} className="tab">{pricingLabel(item)}</Link>
                  ))}
                </nav>
              )}
            </div>
          )}

          {!filteredProducts.length ? (
            <EmptyState
              title={products.length ? '찾는 제품이 없습니다' : '아직 모인 AI 제품이 없습니다'}
              description={products.length ? '다른 이름이나 분류로 찾아보세요.' : '수집이 한 번 돌고 나면 여기에 제품이 올라옵니다.'}
              actionHref={products.length ? '/ai-products' : undefined}
              actionLabel={products.length ? '전체 보기' : undefined}
            />
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedProducts.map((product) => {
                const isScrapped = scrapKeys.has(`ai_product:${product.id}`);
                const rating = displayRating(product.user_rating_average ?? null, product.rating_count);
                const ratingCount = product.rating_count ?? 0;
                const meta = [categoryLabel(product.category), pricingLabel(product.pricing_type)].filter(Boolean).join(' · ');

                return (
                  <article key={product.id} className="card group relative flex min-h-[230px] flex-col p-5 transition-colors hover:border-outline-strong md:p-6">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-high text-ink"><ProductIcon product={product} /></span>
                      <div className="min-w-0">
                        {/* The stretched link makes the whole card a target; the save button sits above it. */}
                        <h2 className="truncate text-lg font-bold leading-snug text-ink"><Link href={`/ai-products/${product.id}`} className="after:absolute after:inset-0 after:content-['']">{product.name}</Link></h2>
                        <p className="text-[13px] text-muted">{meta}</p>
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-3 text-[15px] leading-7 text-muted">{product.description ?? product.target_user ?? ''}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px] text-muted">
                      {ratingCount > 0
                        ? <span className="inline-flex items-center gap-1.5"><Star aria-hidden="true" className="h-3.5 w-3.5" /><span className="num text-ink">{rating}</span><span className="num">({ratingCount.toLocaleString('en-US')})</span></span>
                        : <span>아직 평가가 없습니다</span>}
                      <ScrapButton itemType="ai_product" itemId={product.id} title={product.name} description={product.description} tag={product.category ?? 'ai_product'} initialSaved={isScrapped} iconOnly className="relative z-10 -mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-high hover:text-ink" />
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {filteredProducts.length > PAGE_SIZE && (
            <nav aria-label="쪽 이동" className="pager">
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => (
                <Link key={index + 1} href={buildHref({ q: query, category, pricing, page: index + 1 })} aria-current={currentPage === index + 1 ? 'page' : undefined} className="num">{index + 1}</Link>
              ))}
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
