import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import ArticleHeroCarousel from '@/components/ArticleHeroCarousel';
import ContentEngagement from '@/components/ContentEngagement';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getArticleFeedItems, getScrapKeySet, type ArticleFeedItem } from '@/lib/data';
import PageIntro from '@/components/PageIntro';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '아티클',
};

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
  github_project_pick: 'GitHub 추천',
  build_idea: '만들어 볼 것',
  career_tip: '커리어',
  deep_dive: '깊이 읽기',
  paper_to_project: '논문→프로젝트',
};

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function categoryLabel(value: string | null) {
  if (!value) return '글';
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
  const section = item.newsletter_section ? NEWSLETTER_SECTION_LABELS[item.newsletter_section] ?? item.newsletter_section : null;
  const summary = item.short_summary ?? item.summary ?? item.beginner_summary;
  const audience = [...(item.target_levels ?? []), ...(item.target_goals ?? [])].slice(0, 2).join(' · ');
  const tags = [...new Set([...(item.skill_tags ?? []), ...(item.related_skills ?? []), ...(item.topic_tags ?? [])])].slice(0, 3);
  const meta = [item.type === 'paper' ? '논문 리뷰' : categoryLabel(item.category), section, item.source ?? 'Seedup', formatDate(item.published_at)].filter(Boolean);

  return (
    <article className="card flex flex-col p-5 transition-colors hover:border-outline-strong md:p-6">
      <p className="text-[13px] text-muted"><span className="font-bold text-ink">{meta[0]}</span>{meta.slice(1).map((part) => ` · ${part}`).join('')}</p>
      <Link href={itemHref(item)} className="mt-2.5 block">
        <h3 className="line-clamp-2 text-[19px] font-bold leading-snug text-ink">{item.title}</h3>
      </Link>
      {summary && <p className="mt-2.5 line-clamp-3 text-[15px] leading-7 text-muted">{summary}</p>}
      {item.why_it_matters && (
        <p className="mt-4 line-clamp-2 border-l-2 border-outline-strong pl-3 text-sm leading-6 text-ink">
          <span className="text-muted">왜 중요한가 · </span>{item.why_it_matters}
        </p>
      )}
      {(tags.length > 0 || audience) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
          {audience && <span className="text-[13px] text-muted">{tags.length > 0 ? '· ' : ''}{audience}</span>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <ContentEngagement itemType={itemType} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} />
        <div className="flex gap-2">
          <ScrapButton itemType={itemType} itemId={item.id} title={item.title} description={item.summary ?? item.beginner_summary} tag={item.category ?? 'article'} initialSaved={isScrapped} className="btn-quiet" />
          <Link href={itemHref(item)} className="btn">
            읽기
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
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

  const tabs = [
    { key: 'new', label: '최신' },
    { key: 'popular', label: '인기' },
    { key: 'news', label: '뉴스·글' },
    { key: 'paper', label: '논문' },
  ];
  const linkTo = (target: number) => buildHref({ tab, page: target, category: selectedCategory, q: params.q?.trim() });

  return (
    <>
      <Header />
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            title="오늘 읽을 것"
            description="뉴스와 논문을 한국어로 줄여 두었습니다. 읽고 나서 무엇을 만들지 정할 수 있게, 왜 중요한지를 함께 적습니다."
            meta={articles.length ? <>글 <span className="num text-ink">{articles.length}</span>편</> : undefined}
          />

          {featuredArticles.length > 0 && (
            <section className="grid gap-5 lg:h-[440px] lg:grid-cols-[minmax(0,1fr)_320px]">
              <ArticleHeroCarousel items={featuredArticles} label="오늘 가장 많이 읽힌 글" />
              <aside className="card flex min-h-0 flex-col p-5 md:p-6">
                <h2 className="label">이번 주 많이 읽힌 글</h2>
                <ol className="mt-1 flex min-h-0 flex-1 flex-col divide-y divide-outline-soft">
                  {popularArticles.map((item, index) => (
                    <li key={item.id} className="flex min-h-0 flex-1 items-center">
                      <Link href={itemHref(item)} className="group flex w-full items-baseline gap-3 py-2">
                        <span className="num w-4 shrink-0 text-sm text-muted">{index + 1}</span>
                        <span className="line-clamp-2 min-w-0 text-sm font-bold leading-5 text-ink group-hover:underline group-hover:underline-offset-4">{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </aside>
            </section>
          )}

          <section className="flex flex-col gap-5">
            <nav aria-label="글 분류" className="tabs self-start">
              {tabs.map((item) => (
                <Link key={item.key} href={buildHref({ tab: item.key, category: selectedCategory, q: params.q?.trim() })} scroll={false} aria-current={tab === item.key ? 'page' : undefined} className="tab">
                  {item.label}
                  {tab === item.key && <span className="num">{sortedArticles.length}</span>}
                </Link>
              ))}
            </nav>

            {paginatedArticles.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {paginatedArticles.map((item) => {
                  const itemType = item.type === 'paper' ? 'paper' : 'news';
                  return <ArticleCard key={item.id} item={item} isScrapped={scrapKeys.has(`${itemType}:${item.id}`)} returnTo={currentHref} />;
                })}
              </div>
            ) : (
              <EmptyState
                title={articles.length ? '조건에 맞는 글이 없습니다' : '아직 정리된 글이 없습니다'}
                description={articles.length ? '분류를 바꿔 보세요.' : '수집이 한 번 돌고 나면 여기에 한국어로 정리된 글이 올라옵니다.'}
                actionHref={articles.length ? '/news' : '/opportunities'}
                actionLabel={articles.length ? '전체 보기' : '기회부터 보기'}
              />
            )}

            {sortedArticles.length > PAGE_SIZE && (
              <nav aria-label="쪽 이동" className="pager pt-2">
                <Link href={linkTo(Math.max(1, currentPage - 1))} aria-disabled={currentPage === 1}>
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  이전
                </Link>
                {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => (
                  <Link key={index + 1} href={linkTo(index + 1)} aria-current={currentPage === index + 1 ? 'page' : undefined} className="num">{index + 1}</Link>
                ))}
                <Link href={linkTo(Math.min(totalPages, currentPage + 1))} aria-disabled={currentPage === totalPages}>
                  다음
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </nav>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
