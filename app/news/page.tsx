import { saveScrap } from '@/app/actions/scraps';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getNewsItems, getResearchPapers, getScrapKeySet } from '@/lib/data';
import { ArrowRight, Bookmark, BookOpenText, Code2, Lightbulb, Newspaper } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

export default async function News({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const [news, researchPapers, scrapKeys] = await Promise.all([getNewsItems(), getResearchPapers(6), getScrapKeySet()]);
  const query = params.q?.trim().toLowerCase() ?? '';
  const selectedCategory = params.category?.trim() ?? '';
  const categories = Array.from(new Set(news.map((item) => item.category).filter(Boolean))) as string[];
  const filteredNews = news.filter((item) => {
    const matchesQuery = !query || [item.title, item.summary, item.content, item.category, item.source].some((value) => value?.toLowerCase().includes(query));
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });
  const [featured, ...rest] = filteredNews;
  const side = rest.slice(0, 3);
  const feed = rest.slice(3);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-14 px-4 py-12 md:px-10 md:py-16">
          <div className="border-b border-outline-soft pb-3">
            <h1 className="text-3xl font-semibold text-ink md:text-[32px]">News</h1>
          </div>

          {!featured ? (
            <EmptyState
              title={news.length ? '조건에 맞는 뉴스가 없습니다' : '아직 수집된 뉴스가 없습니다'}
              description={news.length ? '검색어 또는 카테고리 필터를 바꿔보세요.' : '관리자 수집 콘솔에서 RSS 수집을 실행하면 개발 뉴스가 이 화면에 표시됩니다.'}
              actionHref={news.length ? '/news' : '/admin/ingest'}
              actionLabel={news.length ? '필터 초기화' : '수집 콘솔 열기'}
            />
          ) : (
            <>
              <section className="grid gap-6 lg:grid-cols-12">
                <Link href={`/news/${featured.id}`} className="group cursor-pointer lg:col-span-8">
                  <div className="relative h-72 overflow-hidden rounded-xl border border-outline-soft bg-[#191c1d] md:h-96">
                    {featured.image_url && <Image src={featured.image_url} alt={featured.title} fill sizes="(min-width: 1024px) 66vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5">
                      {featured.category && <span className="mb-3 inline-block rounded bg-brand-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{featured.category}</span>}
                      <h2 className="mb-2 text-2xl font-semibold leading-tight text-white">{featured.title}</h2>
                      {featured.summary && <p className="line-clamp-2 max-w-2xl text-sm leading-6 text-white/80">{featured.summary}</p>}
                    </div>
                  </div>
                </Link>

                <aside className="flex flex-col gap-5 lg:col-span-4">
                  <h3 className="border-b border-outline-soft pb-2 text-sm font-semibold uppercase tracking-wider text-muted">최신 트렌드 브리핑</h3>
                  {side.map((item, index) => (
                    <Link key={item.id} href={`/news/${item.id}`} className="group flex cursor-pointer gap-4">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-soft bg-white">
                        <Newspaper className={`h-8 w-8 ${index === 0 ? 'text-brand-primary' : 'text-muted'}`} />
                      </div>
                      <div className="flex flex-col justify-center">
                        {item.category && <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary">{item.category}</span>}
                        <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-ink transition-colors group-hover:text-brand-primary">{item.title}</h4>
                        <span className="mt-1 text-xs text-muted">{formatDate(item.published_at)}</span>
                      </div>
                    </Link>
                  ))}
                </aside>
              </section>

              {!!researchPapers.length && (
                <section className="rounded-xl border border-outline-soft bg-white p-5 md:p-6">
                  <div className="mb-5 flex flex-col gap-2 border-b border-outline-soft pb-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                        <BookOpenText className="h-4 w-4" />
                        Seedup 논문 리뷰
                      </div>
                      <h2 className="text-2xl font-semibold text-ink">오늘 읽고 만들 거리로 바꿀 논문</h2>
                    </div>
                    <Link href="/admin/ingest" className="text-sm font-semibold text-brand-primary hover:underline">논문 수집 관리</Link>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {researchPapers.map((paper) => (
                      <article key={paper.id} className="flex min-h-[260px] flex-col rounded-lg border border-surface-high bg-surface p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-brand-primary px-2.5 py-1 text-xs font-bold text-white">{paper.review_type ?? '오늘 볼만한 논문'}</span>
                          {paper.has_code && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              <Code2 className="h-3.5 w-3.5" />
                              코드 공개
                            </span>
                          )}
                        </div>
                        <h3 className="line-clamp-2 text-xl font-semibold leading-snug text-ink">{paper.title}</h3>
                        {paper.beginner_summary && <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted">{paper.beginner_summary}</p>}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(paper.related_skills ?? paper.categories ?? []).slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded border border-outline-soft bg-white px-2 py-1 text-xs font-semibold text-muted">{tag}</span>
                          ))}
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-outline-soft pt-4">
                          <span className="text-xs font-bold text-muted">빌드 가능성 {paper.buildability_score ?? '-'}</span>
                          {paper.paper_url && (
                            <Link href={paper.paper_url} target="_blank" className="inline-flex items-center gap-1 text-sm font-bold text-brand-primary">
                              논문 보기
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid gap-8 lg:grid-cols-12">
                <div className="flex flex-col gap-6 lg:col-span-8">
                  <div className="flex items-center justify-between border-b border-outline-soft pb-4">
                    <h2 className="text-2xl font-semibold text-ink">모든 뉴스</h2>
                    {(query || selectedCategory) && (
                      <Link href="/news" className="text-sm font-semibold text-brand-primary hover:underline">
                        필터 초기화
                      </Link>
                    )}
                  </div>
                  {(feed.length ? feed : rest).map((item) => {
                    const isScrapped = scrapKeys.has(`news:${item.id}`);

                    return (
                    <article key={item.id} className="group border-b border-outline-soft/50 pb-6">
                      <div className="mb-2 flex items-center gap-2 text-xs">
                        {item.category && <span className="font-bold uppercase tracking-wide text-brand-primary">{item.category}</span>}
                        <span className="text-muted">•</span>
                        <span className="text-muted">{formatDate(item.published_at)}</span>
                      </div>
                      <Link href={`/news/${item.id}`}>
                        <h3 className="mb-2 text-2xl font-semibold leading-snug text-ink transition-colors hover:text-brand-primary">{item.title}</h3>
                      </Link>
                      {item.summary && <p className="mb-4 line-clamp-2 leading-7 text-muted">{item.summary}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {item.project_idea ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">
                            <Lightbulb className="h-3.5 w-3.5" />
                            프로젝트 아이디어: {item.project_idea}
                          </span>
                        ) : <span />}
                        <div className="flex gap-2">
                          <form action={saveScrap}>
                            <input type="hidden" name="item_type" value="news" />
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="title" value={item.title} />
                            <input type="hidden" name="description" value={item.summary ?? item.beginner_summary ?? ''} />
                            <input type="hidden" name="tag" value={item.category ?? 'news'} />
                            <input type="hidden" name="return_to" value="/news" />
                            <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-outline-soft px-3 py-2 text-xs font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                              <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-brand-primary text-brand-primary' : ''}`} />
                              {isScrapped ? '해제' : '스크랩'}
                            </button>
                          </form>
                          <Link href={`/news/${item.id}`} className="inline-flex items-center gap-1 rounded-lg border border-outline-soft px-3 py-2 text-xs font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                            자세히
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  )})}
                </div>
                <aside className="lg:col-span-4">
                  <div className="sticky top-24 rounded-xl border border-outline-soft bg-white p-5">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">추천 태그</h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((tag) => (
                        <Link
                          key={tag}
                          href={`/news?category=${encodeURIComponent(tag)}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedCategory === tag ? 'border-brand-primary bg-brand-primary text-white' : 'border-outline-soft bg-surface text-muted hover:border-brand-primary hover:text-brand-primary'}`}
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                    <Link href="/scrap" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-outline-soft bg-surface-low px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-primary hover:text-brand-primary">
                      <Bookmark className="h-4 w-4" />
                      스크랩북 보기
                    </Link>
                  </div>
                </aside>
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
