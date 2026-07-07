import { saveScrap } from '@/app/actions/scraps';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import type { AIProduct } from '@/lib/data';
import { getAIProduct, getExistingScrap } from '@/lib/data';
import { ArrowLeft, ArrowRight, Bookmark, Bot, CheckCircle2, ExternalLink, Lightbulb, Star, Target, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function tags(product: AIProduct) {
  return [product.category, product.pricing_type, product.target_user, ...(product.use_cases ?? [])]
    .filter(Boolean)
    .slice(0, 8) as string[];
}

function reviewMetrics(product: AIProduct) {
  const raw = Number(product.score ?? 0);
  const score = Math.max(0, Math.min(5, raw > 10 ? raw / 20 : raw / 2));
  return [
    { label: '초보자 활용성', value: Math.min(5, score + 0.3) },
    { label: '프로젝트 영감', value: Math.min(5, score + 0.1) },
    { label: '업무 자동화', value: score },
    { label: '검증 필요도', value: Math.max(1, 5 - score + 1.2) },
  ];
}

function cautionTags(product: AIProduct) {
  const result = ['결과 검증 필요', '비용 구조 확인'];
  if (product.pricing_type === 'Unknown') result.unshift('요금제 확인 필요');
  if (!product.website_url) result.unshift('공식 사이트 확인 필요');
  return result.slice(0, 4);
}

function StarRating({ score }: { score: number | null }) {
  const raw = Number(score ?? 0);
  const normalized = Math.max(0, Math.min(5, raw > 10 ? raw / 20 : raw / 2));
  const filled = Math.round(normalized);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`h-6 w-6 ${index < filled ? 'fill-yellow-400 text-yellow-400' : 'fill-surface-high text-surface-high'}`} />
      ))}
    </div>
  );
}

function displayRating(score: number | null) {
  const raw = Number(score ?? 0);
  if (!raw) return '-';
  return (raw > 10 ? raw / 20 : raw / 2).toFixed(2);
}

export default async function AIProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, existingScrap] = await Promise.all([
    getAIProduct(id),
    getExistingScrap('ai_product', id),
  ]);

  if (!product) notFound();

  const productTags = tags(product);
  const metrics = reviewMetrics(product);
  const cautions = cautionTags(product);
  const displayScore = displayRating(product.score);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-10 md:py-14">
          <Link href="/ai-products" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            AI 제품랭크로
          </Link>

          <section className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
            <div className="grid gap-7 lg:grid-cols-[112px_1fr_auto]">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-surface-high bg-surface-lowest text-3xl font-black text-ink shadow-sm">
                {product.name.toLowerCase().includes('chatgpt') ? <Bot className="h-12 w-12 text-ink" /> : product.name.slice(0, 1)}
              </div>
              <div>
                <h1 className="text-4xl font-semibold leading-tight text-ink md:text-5xl">{product.name}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <StarRating score={product.score} />
                  <span className="text-lg font-semibold text-muted">{displayScore} ({product.rating_count ?? 0})</span>
                  {product.status && <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-sm font-bold text-brand-primary">{product.status}</span>}
                </div>
                {!!productTags.length && (
                  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-lg font-semibold text-muted">
                    {productTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-2">
                        <span className="text-xl">#</span>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-3 lg:justify-end">
                <form action={saveScrap}>
                  <input type="hidden" name="item_type" value="ai_product" />
                  <input type="hidden" name="item_id" value={product.id} />
                  <input type="hidden" name="title" value={product.name} />
                  <input type="hidden" name="description" value={product.description ?? ''} />
                  <input type="hidden" name="tag" value={product.category ?? 'ai_product'} />
                  <input type="hidden" name="return_to" value={`/ai-products/${product.id}`} />
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-outline-soft bg-white px-5 py-3 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                    <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-brand-primary text-brand-primary' : ''}`} />
                    {existingScrap ? '스크랩됨' : '스크랩'}
                  </button>
                </form>
                {(product.website_url || product.product_hunt_url) && (
                  <Link href={product.website_url ?? product.product_hunt_url ?? '#'} target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-bold text-white hover:bg-brand-primary/90">
                    <ExternalLink className="h-4 w-4" />
                    사이트 방문
                  </Link>
                )}
              </div>
            </div>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-8">
              <section className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
                <h2 className="text-2xl font-semibold text-ink">프로덕트 소개</h2>
                <p className="mt-5 text-lg leading-9 text-muted">{product.description ?? '제품 설명이 아직 수집되지 않았습니다. 다음 수집 실행 후 소개 문장이 자동으로 채워집니다.'}</p>
              </section>

              <section className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
                <div className="flex items-center gap-3">
                  <Bot className="h-6 w-6 text-brand-primary" />
                  <h2 className="text-2xl font-semibold text-ink">Seedup AI 리뷰 분석</h2>
                </div>
                <p className="mt-5 text-lg leading-9 text-muted">
                  이 제품은 {product.target_user ?? '초기 제품 빌더와 개발자'} 관점에서 {product.category ?? 'AI 제품'} 영역에 속합니다.
                  {product.use_cases?.length ? ` 특히 ${product.use_cases.slice(0, 3).join(', ')} 같은 작업에 바로 적용해볼 만합니다.` : ' 구체적인 활용 사례는 추가 분석이 필요합니다.'}
                </p>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-surface-high bg-surface p-4">
                      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-muted">
                        <span>{metric.label}</span>
                        <span>{metric.value.toFixed(1)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-high">
                        <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.max(8, (metric.value / 5) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                  <div className="mb-4 flex items-center gap-2 text-lg font-bold text-emerald-900">
                    <CheckCircle2 className="h-5 w-5" />
                    프로덕트 장점
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(product.use_cases?.length ? product.use_cases : ['생산성 향상', '업무 자동화']).map((item) => (
                      <span key={item} className="rounded-full border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                  <div className="mb-4 flex items-center gap-2 text-lg font-bold text-red-900">
                    <TriangleAlert className="h-5 w-5" />
                    확인할 점
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cautions.map((item) => (
                      <span key={item} className="rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-900">{item}</span>
                    ))}
                  </div>
                </div>
              </section>

              {!!product.related_project_ideas?.length && (
                <section className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <Lightbulb className="h-6 w-6 text-brand-primary" />
                    <h2 className="text-2xl font-semibold text-ink">이 제품으로 만들 만한 프로젝트</h2>
                  </div>
                  <div className="grid gap-3">
                    {product.related_project_ideas.map((idea) => (
                      <div key={idea} className="rounded-lg border border-surface-high bg-surface p-4 text-base font-semibold leading-7 text-ink">{idea}</div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-outline-soft bg-white p-6">
                <h2 className="text-xl font-semibold text-ink">제품 정보</h2>
                <dl className="mt-5 divide-y divide-outline-soft/70 text-sm">
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">카테고리</dt>
                    <dd className="font-semibold text-ink">{product.category ?? '-'}</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">가격</dt>
                    <dd className="font-semibold text-ink">{product.pricing_type ?? '-'}</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">추천 대상</dt>
                    <dd className="max-w-[180px] text-right font-semibold text-ink">{product.target_user ?? '-'}</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">리뷰 수</dt>
                    <dd className="font-semibold text-ink">{product.rating_count ?? 0}</dd>
                  </div>
                </dl>
                <Link href={`/projects?filter=${encodeURIComponent('트렌드 연동')}`} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-outline-soft bg-surface px-4 py-3 text-sm font-bold text-ink hover:border-brand-primary hover:text-brand-primary">
                  관련 프로젝트 보기
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="mt-5 rounded-lg border border-surface-high bg-surface p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Target className="h-4 w-4 text-brand-primary" />
                    Seedup 관점
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">뉴스처럼 읽고 끝내기보다, 이 제품의 핵심 기능을 작은 프로젝트로 따라 만들어보는 것을 추천합니다.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
