import { saveScrap } from '@/app/actions/scraps';
import ArticleHeroCarousel from '@/components/ArticleHeroCarousel';
import ContentEngagement from '@/components/ContentEngagement';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getArticleFeedItems, getScrapKeySet, type ArticleFeedItem } from '@/lib/data';
import { ArrowLeft, ArrowRight, Bookmark, Flame, Newspaper } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 10;

const CATEGORY_LABELS: Record<string, string> = {
  'AI Agent': 'AI 에이전트',
  Frontend: '프론트엔드',
  Backend: '백엔드',
  DevTools: '개발 도구',
  Product: '제품',
  Trend: '트렌드',
  Other: '기타',
};

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function categoryLabel(value: string | null) {
  if (!value) return '아티클';
  return CATEGORY_LABELS[value] ?? value;
}

function itemHref(item: ArticleFeedItem) {
  return item.type === 'paper' ? `/papers/${item.id}` : `/news/${item.id}`;
}

function scoreOf(item: ArticleFeedItem) {
  return Number(item.relevance_score ?? 0) + Number(item.like_count ?? 0) * 2 + Number(item.view_count ?? 0) * 0.05;
}

function buildHref(params: { tab: string; page?: number; category?: string; q?: string }) {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== 'new') query.set('tab', params.tab);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  if (params.category) query.set('category', params.category);
  if (params.q) query.set('q', params.q);
  const search = query.toString();
  return `/news${search ? `?${search}` : ''}`;
}

function ArticleCard({ item, isScrapped, returnTo }: { item: ArticleFeedItem; isScrapped: boolean; returnTo: string }) {
  return (
    <article className="group rounded-xl border border-outline-soft bg-white p-5 transition-all hover:border-brand-primary/50 hover:shadow-[0_12px_36px_rgba(25,28,29,0.06)]">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
        <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-brand-primary">{item.type === 'paper' ? '논문 리뷰' : categoryLabel(item.category)}</span>
        <span>{item.source ?? 'Seedup'}</span>
        <span>{formatDate(item.published_at)}</span>
      </div>
      <Link href={itemHref(item)}>
        <h3 className="line-clamp-2 text-xl font-bold leading-snug text-ink transition-colors group-hover:text-brand-primary">{item.title}</h3>
      </Link>
      {(item.summary || item.beginner_summary) && (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{item.summary ?? item.beginner_summary}</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {(item.related_skills ?? []).slice(0, 3).map((skill) => (
          <span key={skill} className="rounded border border-outline-soft bg-surface-lowest px-2 py-1 text-xs font-semibold text-muted">{skill}</span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-outline-soft pt-4">
        <ContentEngagement itemType={item.type === 'paper' ? 'paper' : 'news'} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} />
        <div className="flex gap-2">
          <form action={saveScrap}>
            <input type="hidden" name="item_type" value={item.type === 'paper' ? 'paper' : 'news'} />
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="title" value={item.title} />
            <input type="hidden" name="description" value={item.summary ?? item.beginner_summary ?? ''} />
            <input type="hidden" name="tag" value={item.category ?? 'article'} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" className="inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-xs font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
              <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-brand-primary text-brand-primary' : ''}`} />
              {isScrapped ? '해제' : '스크랩'}
            </button>
          </form>
          <Link href={itemHref(item)} className="inline-flex h-10 items-center gap-1 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90">
            읽기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; tab?: string; page?: string }> }) {
  const params = await searchParams;
  const [articles, scrapKeys] = await Promise.all([getArticleFeedItems(), getScrapKeySet()]);
  const tab = ['popular', 'news', 'paper'].includes(params.tab ?? '') ? params.tab as 'popular' | 'news' | 'paper' : 'new';
  const query = params.q?.trim().toLowerCase() ?? '';
  const selectedCategory = params.category?.trim() ?? '';
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const baseFiltered = articles.filter((item) => {
    const matchesQuery = !query || [item.title, item.summary, item.content, item.category, item.source, item.beginner_summary, ...(item.related_skills ?? [])]
      .some((value) => value?.toLowerCase().includes(query));
    const matchesCategory = !selectedCategory || (selectedCategory === '논문' ? item.type === 'paper' : item.category === selectedCategory);
    const matchesTab = tab === 'news' ? item.type === 'news' : tab === 'paper' ? item.type === 'paper' : true;
    return matchesQuery && matchesCategory && matchesTab;
  });
  const sortedArticles = [...baseFiltered].sort((a, b) => {
    if (tab === 'popular') return scoreOf(b) - scoreOf(a) || new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });
  const popularArticles = [...articles].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 5);
  const totalPages = Math.max(1, Math.ceil(sortedArticles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedArticles = sortedArticles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const currentHref = buildHref({ tab, page: currentPage, category: selectedCategory, q: params.q?.trim() });

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Articles"
            title="아티클"
            description="개발 뉴스, AI 제품 흐름, 오픈소스 신호, 논문 리뷰를 한국어로 정리해 바로 읽고 만들 수 있게 모았습니다."
            icon={Newspaper}
          />

          {popularArticles.length > 0 && (
            <section className="flex flex-col gap-5 lg:h-[400px] lg:flex-row">
              <div className="min-w-0 flex-1 h-full">
                <ArticleHeroCarousel items={popularArticles} />
              </div>
              <aside className="lg:w-[280px] lg:shrink-0 h-full">
                <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-outline-soft bg-white p-5 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
                    <Flame className="h-4 w-4 text-brand-primary" />
                    인기 글 Top 5
                  </h2>
                  <div className="flex flex-1 flex-col justify-between gap-0">
                    {popularArticles.map((item, index) => (
                      <Link key={item.id} href={itemHref(item)} className="group flex items-start gap-3 rounded-lg py-2.5 transition-colors hover:bg-surface px-2 -mx-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-black ${index === 0 ? 'bg-brand-primary text-white' : 'bg-brand-primary/10 text-brand-primary'}`}>
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-ink transition-colors group-hover:text-brand-primary">{item.title}</h3>
                          <p className="mt-0.5 text-xs text-muted">{item.type === 'paper' ? '논문 리뷰' : categoryLabel(item.category)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              </aside>
            </section>
          )}

          <section>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 rounded-xl border border-outline-soft bg-white p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-2">
                  {[
                    { key: 'new', label: 'New' },
                    { key: 'popular', label: 'Popular' },
                    { key: 'news', label: '뉴스/글' },
                    { key: 'paper', label: '논문' },
                  ].map((item) => (
                    <Link
                      key={item.key}
                      href={buildHref({ tab: item.key, category: selectedCategory, q: params.q?.trim() })}
                      scroll={false}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === item.key ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="text-sm font-semibold text-muted">총 {sortedArticles.length}개 아티클</div>
              </div>

              {paginatedArticles.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {paginatedArticles.map((item) => (
                    <ArticleCard key={item.id} item={item} isScrapped={scrapKeys.has(`news:${item.id}`)} returnTo={currentHref} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={articles.length ? '조건에 맞는 아티클이 없습니다' : '아직 수집된 아티클이 없습니다'}
                  description={articles.length ? '필터를 바꿔보세요.' : '관리자 수집 콘솔에서 RSS/논문 수집을 실행하면 아티클이 표시됩니다.'}
                  actionHref={articles.length ? '/news' : '/admin/ingest'}
                  actionLabel={articles.length ? '필터 초기화' : '수집 콘솔 열기'}
                />
              )}

              {sortedArticles.length > PAGE_SIZE && (
                <nav className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Link
                    href={buildHref({ tab, page: Math.max(1, currentPage - 1), category: selectedCategory, q: params.q?.trim() })}
                    className={`inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-sm font-semibold ${currentPage === 1 ? 'pointer-events-none opacity-40' : 'hover:border-brand-primary hover:text-brand-primary'}`}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    이전
                  </Link>
                  {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <Link
                        key={pageNumber}
                        href={buildHref({ tab, page: pageNumber, category: selectedCategory, q: params.q?.trim() })}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${currentPage === pageNumber ? 'bg-brand-primary text-white' : 'border border-outline-soft bg-white text-muted hover:border-brand-primary hover:text-brand-primary'}`}
                      >
                        {pageNumber}
                      </Link>
                    );
                  })}
                  <Link
                    href={buildHref({ tab, page: Math.min(totalPages, currentPage + 1), category: selectedCategory, q: params.q?.trim() })}
                    className={`inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-sm font-semibold ${currentPage === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-brand-primary hover:text-brand-primary'}`}
                  >
                    다음
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </nav>
              )}
            </div>
          </section>

        </div>
      </main>
      <Footer />
    </>
  );
}
