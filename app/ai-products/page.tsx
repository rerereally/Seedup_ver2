import { saveScrap } from '@/app/actions/scraps';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import type { AIProduct } from '@/lib/data';
import { getAIProducts, getScrapKeySet } from '@/lib/data';
import { Bookmark, Bot, ChevronRight, Flame, Star, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';

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

export default async function AIProducts() {
  const [products, scrapKeys] = await Promise.all([getAIProducts(), getScrapKeySet()]);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-10 md:py-16">
          <section className="mb-10">
            <h1 className="text-3xl font-semibold text-ink md:text-[32px]">
              AI 제품랭크
              <Flame className="ml-2 inline h-7 w-7 fill-brand-primary text-brand-primary" />
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-muted">다음 프로젝트에 영감을 줄 AI 제품을 평가하고, 초보 개발자가 어디에 활용할 수 있는지 빠르게 확인하세요.</p>
          </section>

          {!products.length ? (
            <EmptyState title="아직 등록된 AI 제품이 없습니다" description="관리자 수집 콘솔에서 Product Hunt 수집을 실행하면 AI 제품 평가가 이 화면에 표시됩니다." actionHref="/admin/ingest" actionLabel="수집 콘솔 열기" />
          ) : (
            <section className="flex flex-col gap-4">
              {products.map((product, index) => {
                const isScrapped = scrapKeys.has(`ai_product:${product.id}`);
                const tags = productTags(product);
                const risks = riskTags(product).slice(0, 2);
                const displayScore = displayRating(product.score);

                return (
                  <article key={product.id} className="group rounded-xl border border-outline-soft bg-white p-4 transition-all hover:border-brand-primary hover:shadow-[0_10px_28px_-24px_rgba(25,28,29,0.45)] md:p-5">
                    <div className="grid gap-5 lg:grid-cols-[72px_1fr_auto] lg:items-center">
                      <div className="flex items-center gap-3 lg:flex-col lg:gap-2">
                        <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg text-sm font-black ${index === 0 ? 'bg-brand-primary text-white' : 'bg-surface-high text-muted'}`}>
                          {index + 1}
                        </span>
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-surface-high bg-surface-lowest text-2xl font-black text-ink shadow-sm">
                          {product.name.toLowerCase().includes('chatgpt') ? <Bot className="h-8 w-8 text-ink" /> : product.name.slice(0, 1)}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <h2 className="text-2xl font-semibold leading-tight text-ink transition-colors group-hover:text-brand-primary">{product.name}</h2>
                          <div className="flex items-center gap-2">
                            <StarRating score={product.score} />
                            <span className="text-base font-semibold text-muted">{displayScore} ({product.rating_count ?? 0})</span>
                          </div>
                          {product.status && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">
                              <Flame className="h-3.5 w-3.5" />
                              {product.status}
                            </span>
                          )}
                        </div>

                        {!!tags.length && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {tags.map((tag) => (
                              <span key={tag} className="rounded-full border border-surface-high bg-surface px-3 py-1 text-xs font-semibold text-muted">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 border-l-4 border-surface-high pl-4">
                          {product.description && <p className="line-clamp-2 text-base leading-7 text-muted">{product.description}</p>}
                          <div className="mt-4 flex flex-wrap gap-2">
                            {(product.use_cases ?? []).slice(0, 4).map((useCase) => (
                              <span key={useCase} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                {useCase}
                              </span>
                            ))}
                            {risks.map((risk) => (
                              <span key={risk} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
                                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                                {risk}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-outline-soft pt-4 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
                        <form action={saveScrap}>
                          <input type="hidden" name="item_type" value="ai_product" />
                          <input type="hidden" name="item_id" value={product.id} />
                          <input type="hidden" name="title" value={product.name} />
                          <input type="hidden" name="description" value={product.description ?? ''} />
                          <input type="hidden" name="tag" value={product.category ?? 'ai_product'} />
                          <input type="hidden" name="return_to" value="/ai-products" />
                          <button type="submit" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-outline-soft bg-surface-lowest text-muted transition-colors hover:border-brand-primary hover:text-brand-primary" aria-label={`${product.name} 스크랩`}>
                            <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-brand-primary text-brand-primary' : ''}`} />
                          </button>
                        </form>
                        <Link href={`/ai-products/${product.id}`} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-primary/90">
                          자세히 보기
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
