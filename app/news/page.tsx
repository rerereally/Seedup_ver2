import ScrapButton from '@/components/ScrapButton';
import ArticleHeroCarousel from '@/components/ArticleHeroCarousel';
import ContentEngagement from '@/components/ContentEngagement';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getArticleFeedItems, getScrapKeySet, type ArticleFeedItem } from '@/lib/data';
import { ArrowLeft, ArrowRight, FileText, Lightbulb, Newspaper } from 'lucide-react';
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

const NEWSLETTER_SECTION_LABELS: Record<string, string> = {
  daily_briefing: '핵심 뉴스',
  ai_product_radar: 'AI 제품',
  github_project_pick: 'GitHub Pick',
  build_idea: 'Build Idea',
  career_tip: 'Career Tip',
  deep_dive: 'Deep Dive',
  paper_to_project: '논문→프로젝트',
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

function categorySignal(item: ArticleFeedItem) {
  const category = `${item.category ?? ''} ${item.newsletter_section ?? ''}`.toLowerCase();
  const relevance = Number(item.relevance_score ?? 0);
  const quality = Number(item.source_quality_score ?? 0);
  const novelty = Number(item.novelty_score ?? 0);
  const buildability = Number(item.buildability_score ?? 0);
  const project = Number(item.project_connect_score ?? 0);
  if (item.type === 'paper' || category.includes('paper') || category.includes('논문')) return relevance * 0.45 + novelty * 0.25 + buildability * 0.3;
  if (/frontend|프론트|ui|ux/.test(category)) return relevance * 0.35 + quality * 0.3 + novelty * 0.2 + buildability * 0.15;
  if (/backend|백엔드|server|database/.test(category)) return relevance * 0.35 + quality * 0.25 + buildability * 0.3 + novelty * 0.1;
  if (/product|제품|build|아이디어|github|open.source|오픈소스/.test(category)) return project * 0.35 + buildability * 0.3 + relevance * 0.2 + novelty * 0.15;
  return relevance * 0.35 + novelty * 0.25 + quality * 0.2 + buildability * 0.2;
}

function engagementScore(item: ArticleFeedItem) {
  return Number(item.like_count ?? 0) * 10 + Number(item.view_count ?? 0) * 0.15 - Number(item.dislike_count ?? 0) * 5;
}

function popularityCompare(left: ArticleFeedItem, right: ArticleFeedItem, editorialWeight = 0.5) {
  const engagementDiff = engagementScore(right) - engagementScore(left);
  if (engagementDiff !== 0) return engagementDiff;
  return (categorySignal(right) - categorySignal(left)) * editorialWeight;
}

function isWithinDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= Date.now() - days * 24 * 60 * 60 * 1000;
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
  const itemType = item.type === 'paper' ? 'paper' : 'news';
  const recommendedFor = [...(item.target_levels ?? []), ...(item.target_goals ?? [])].slice(0, 2).join(' · ');
  const trustLabel = item.published_at ? `수집 기준 ${formatDate(item.published_at)}` : item.source ? `출처 ${item.source}` : 'Seedup 검토';
  const newsletterLabel = item.newsletter_section ? NEWSLETTER_SECTION_LABELS[item.newsletter_section] ?? item.newsletter_section : '브리핑 후보';
  const scoreLabel = Number(item.newsletter_priority ?? 0) >= 40
    ? `우선순위 ${Math.round(Number(item.newsletter_priority))}`
    : Number(item.daily_rank_score ?? 0) >= 40
      ? `랭킹 ${Math.round(Number(item.daily_rank_score))}`
      : null;
  const summary = item.short_summary ?? item.summary ?? item.beginner_summary;
  const reasons = item.recommendation_reasons?.length
    ? item.recommendation_reasons
    : item.personalization_hooks?.length
      ? item.personalization_hooks
      : item.project_convertible
        ? ['프로젝트로 확장 가능']
        : [];

  return (
    <article className="group border border-outline-soft bg-white p-5 transition-colors hover:border-ink">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-muted">
        <span className="border border-outline-soft bg-surface px-2 py-1 text-ink">{item.type === 'paper' ? '논문 리뷰' : categoryLabel(item.category)}</span>
        <span className="border border-outline-soft bg-ink px-2 py-1 text-white">{newsletterLabel}</span>
        {scoreLabel && <span>{scoreLabel}</span>}
        <span>{item.source ?? 'Seedup'}</span>
        <span>{formatDate(item.published_at)}</span>
      </div>
      <Link href={itemHref(item)}>
        <h3 className="line-clamp-2 text-xl font-black leading-snug text-ink transition-colors group-hover:underline">{item.title}</h3>
      </Link>
      {summary && (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{summary}</p>
      )}
      <div className="mt-4 grid gap-3 border border-outline-soft bg-surface p-4 text-sm leading-6">
        <div>
          <div className="text-xs font-bold uppercase text-ink">왜 중요한가</div>
          <p className="mt-1 line-clamp-2 text-muted">{item.why_it_matters ?? '개발 흐름을 이해하고 다음 프로젝트 주제를 고르는 데 참고할 수 있습니다.'}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase text-ink">추천 대상</div>
            <p className="mt-1 line-clamp-1 text-muted">{recommendedFor || (item.type === 'paper' ? '논문을 프로젝트로 연결하고 싶은 개발자' : '트렌드를 빠르게 파악하고 싶은 개발자')}</p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-ink">추천 이유</div>
            <p className="mt-1 line-clamp-1 text-muted">{reasons[0] ?? item.project_idea ?? '뉴스레터 추천 후보'}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {[...(item.skill_tags ?? []), ...(item.related_skills ?? []), ...(item.topic_tags ?? [])].slice(0, 3).map((skill) => (
          <span key={skill} className="border border-outline-soft bg-surface px-2 py-1 text-xs font-semibold text-muted">{skill}</span>
        ))}
        <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-semibold text-muted">{trustLabel}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-outline-soft pt-4">
        <ContentEngagement itemType={itemType} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} />
        <div className="flex gap-2">
          <ScrapButton itemType={itemType} itemId={item.id} title={item.title} description={item.summary ?? item.beginner_summary} tag={item.category ?? 'article'} initialSaved={isScrapped} className="inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-xs font-bold text-ink hover:border-ink" />
          <Link href={itemHref(item)} className="inline-flex h-10 items-center gap-1 bg-ink px-3 text-xs font-bold text-white transition-opacity hover:opacity-90">
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
    if (tab === 'popular') return popularityCompare(a, b) || new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });
  const todayPopularArticles = [...articles.filter((item) => isWithinDays(item.published_at, 1))].sort((a, b) => popularityCompare(a, b, 1)).slice(0, 5);
  const weeklyCandidates = [...articles.filter((item) => isWithinDays(item.published_at, 7))].sort((a, b) => popularityCompare(a, b));
  const popularArticles = (weeklyCandidates.length ? weeklyCandidates : [...articles].sort((a, b) => popularityCompare(a, b))).slice(0, 5);
  const featuredArticles = todayPopularArticles.length ? todayPopularArticles : [...articles].sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()).slice(0, 5);
  const totalPages = Math.max(1, Math.ceil(sortedArticles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedArticles = sortedArticles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const currentHref = buildHref({ tab, page: currentPage, category: selectedCategory, q: params.q?.trim() });

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-5 md:px-10 md:py-6">
          <section className="border-b border-outline-soft pb-4">
            <div className="inline-flex items-center gap-2 border border-outline-soft bg-white px-3 py-1 text-xs font-bold uppercase text-ink">
              <Newspaper className="h-4 w-4" />
              Article Feed
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight text-ink md:text-[38px]">오늘 읽을 기술 브리핑</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              뉴스, 논문, 개발 흐름을 한국어로 압축해 읽고 바로 다음 판단으로 이어갈 수 있게 정리합니다.
            </p>
          </section>

          {featuredArticles.length > 0 && (
            <section className="flex flex-col gap-5 lg:h-[520px] lg:flex-row">
              <div className="min-w-0 flex-1">
                <ArticleHeroCarousel items={featuredArticles} label="오늘 인기" />
              </div>
              <aside className="lg:w-72 lg:shrink-0">
                <section className="flex h-full flex-col border border-outline-soft bg-white p-5">
                  <h2 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-black uppercase text-ink">
                    <FileText className="h-4 w-4 text-ink" />
                    이번 주 인기 글 Top 5
                  </h2>
                  <div className="grid min-h-0 flex-1 grid-rows-5 gap-2">
                    {popularArticles.map((item, index) => (
                      <Link key={item.id} href={itemHref(item)} className="group flex min-h-0 items-start gap-3 overflow-hidden border border-outline-soft bg-surface p-2.5 transition-colors hover:border-ink">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-ink text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0 overflow-hidden">
                          <h3 className="line-clamp-2 break-words text-[13px] font-bold leading-5 text-ink transition-colors group-hover:underline">{item.title}</h3>
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
              <div className="flex flex-col gap-4 border border-outline-soft bg-white p-4 md:flex-row md:items-center md:justify-between">
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 hide-scrollbar md:mx-0 md:px-0 md:pb-0">
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
                      className={`inline-flex h-11 shrink-0 items-center px-4 text-sm font-bold transition-colors ${tab === item.key ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="self-start text-sm font-semibold text-muted md:self-auto">총 {sortedArticles.length}개 아티클</div>
              </div>

              {paginatedArticles.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {paginatedArticles.map((item) => {
                    const itemType = item.type === 'paper' ? 'paper' : 'news';

                    return (
                      <ArticleCard key={item.id} item={item} isScrapped={scrapKeys.has(`${itemType}:${item.id}`)} returnTo={currentHref} />
                    );
                  })}
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
                    className={`inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-sm font-semibold ${currentPage === 1 ? 'pointer-events-none opacity-40' : 'hover:border-ink hover:text-ink'}`}
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
                        className={`inline-flex h-10 w-10 items-center justify-center text-sm font-bold ${currentPage === pageNumber ? 'bg-ink text-white' : 'border border-outline-soft bg-white text-muted hover:border-ink hover:text-ink'}`}
                      >
                        {pageNumber}
                      </Link>
                    );
                  })}
                  <Link
                    href={buildHref({ tab, page: Math.min(totalPages, currentPage + 1), category: selectedCategory, q: params.q?.trim() })}
                    className={`inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-sm font-semibold ${currentPage === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-ink hover:text-ink'}`}
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
