import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import ContentEngagement from '@/components/ContentEngagement';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getArticleFeedItems, getScrapKeySet, type ArticleFeedItem } from '@/lib/data';
import { getOpportunities } from '@/lib/opportunities/data';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '오늘의 신호',
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

function buildHref(params: { tab: string; page?: number; category?: string; q?: string }) {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== 'new') query.set('tab', params.tab);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  if (params.category) query.set('category', params.category);
  if (params.q) query.set('q', params.q);
  const search = query.toString();
  return `/news${search ? `?${search}` : ''}`;
}

/** One row of the feed. The first one on a page is set larger and carries the save and ask actions. */
function ArticleRow({ item, isScrapped, returnTo, lead }: { item: ArticleFeedItem; isScrapped: boolean; returnTo: string; lead: boolean }) {
  const itemType = item.type === 'paper' ? 'paper' : 'news';
  const section = item.newsletter_section ? NEWSLETTER_SECTION_LABELS[item.newsletter_section] ?? item.newsletter_section : null;
  const summary = item.short_summary ?? item.summary ?? item.beginner_summary;
  const meta = [item.type === 'paper' ? '논문 리뷰' : categoryLabel(item.category), section, item.source ?? 'Seedup', formatDate(item.published_at)].filter(Boolean).join(' · ');

  return (
    <article className={lead ? 'pb-10 pt-2' : 'py-7'}>
      <p className="text-[13px] text-muted">{meta}</p>
      <Link href={itemHref(item)} className="mt-2 block underline-offset-4 hover:underline">
        <h2 className={lead ? 'text-[clamp(24px,3vw,34px)] font-bold leading-tight tracking-[-0.03em] text-ink' : 'text-xl font-semibold leading-snug tracking-tight text-ink'}>{item.title}</h2>
      </Link>
      {summary && <p className={lead ? 'mt-3 text-[17px] leading-8 text-tertiary' : 'mt-3 line-clamp-2 text-[15px] leading-7 text-muted'}>{summary}</p>}
      {lead && item.why_it_matters && <p className="mt-4 text-[15px] leading-7 text-tertiary"><span className="font-semibold text-ink">왜 중요한가</span> · {item.why_it_matters}</p>}
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${lead ? 'mt-6' : 'mt-3'}`}>
        {lead && <ScrapButton itemType={itemType} itemId={item.id} title={item.title} description={item.summary ?? item.beginner_summary} tag={item.category ?? 'article'} initialSaved={isScrapped} className="btn-quiet" />}
        {lead && <Link href={itemHref(item)} className="text-sm text-tertiary underline-offset-4 hover:text-ink hover:underline">이 글에 질문하기</Link>}
        {lead && <Link href="/opportunities" className="link-seed">관련 기회 보기 ›</Link>}
        <span className={lead ? 'ml-auto' : ''}><ContentEngagement itemType={itemType} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} /></span>
      </div>
    </article>
  );
}

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; tab?: string; page?: string }> }) {
  const params = await searchParams;
  const [articles, scrapKeys, { opportunities }] = await Promise.all([getArticleFeedItems(), getScrapKeySet(), getOpportunities()]);
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

  const today = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date());
  // Verified problems first, then the ones closest to the bar.
  const grown = [...opportunities].sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.evidence.length - a.evidence.length).slice(0, 3);

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grid grow content-start gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <p className="text-sm text-muted">{today} · 고른 글 {articles.length}편</p>
          <h1 className="page-intro-title mt-2">오늘의 신호</h1>

          <nav aria-label="글 분류" className="tabs mt-8">
            {tabs.map((item) => (
              <Link key={item.key} href={buildHref({ tab: item.key, category: selectedCategory, q: params.q?.trim() })} scroll={false} aria-current={tab === item.key ? 'page' : undefined} className="tab">{item.label}</Link>
            ))}
          </nav>

          {paginatedArticles.length ? (
            <div className="mt-8 divide-y divide-outline-soft border-b border-outline-soft">
              {paginatedArticles.map((item, index) => {
                const itemType = item.type === 'paper' ? 'paper' : 'news';
                return <ArticleRow key={item.id} item={item} isScrapped={scrapKeys.has(`${itemType}:${item.id}`)} returnTo={currentHref} lead={index === 0 && currentPage === 1} />;
              })}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                title={articles.length ? '조건에 맞는 글이 없습니다' : '아직 정리된 글이 없습니다'}
                description={articles.length ? '분류를 바꿔 보세요.' : '수집이 한 번 돌고 나면 여기에 한국어로 정리된 글이 올라옵니다.'}
                actionHref={articles.length ? '/news' : '/opportunities'}
                actionLabel={articles.length ? '전체 보기' : '기회부터 보기'}
              />
            </div>
          )}

          {sortedArticles.length > PAGE_SIZE && (
            <nav aria-label="쪽 이동" className="pager pt-8">
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

        <aside className="flex flex-col gap-10">
          {grown.length > 0 && (
            <section aria-labelledby="grown-heading">
              <h2 id="grown-heading" className="text-lg font-semibold tracking-tight">이번 주 자란 기회</h2>
              <p className="mt-1 text-sm text-muted">개발자 원문이 모여 검증을 통과한 문제</p>
              <ul className="rows mt-5">
                {grown.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/opportunities/${item.slug}`} className="block py-5 hover:bg-surface-low">
                      <span className="block font-semibold text-ink">{item.name}</span>
                      <span className="mt-1.5 block text-sm text-muted">
                        {item.qualified && <><span className="font-medium text-seed">기준 통과</span> · </>}
                        원문 {item.evidence.length}건 · {item.directCount ? `경쟁 도구 ${item.directCount}개` : '경쟁 도구 없음'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/opportunities" className="link-seed mt-4">기회 전체 보기 ›</Link>
            </section>
          )}
          <section className="card p-6">
            <h2 className="text-lg font-semibold tracking-tight">주간 신호</h2>
            <p className="mt-2 text-sm leading-6 text-muted">이 피드에서 내 관심 분야만 골라 매주 월요일 메일로 보냅니다.</p>
            <Link href="/newsletter-preview" className="btn mt-5 h-12 w-full text-[15px]">구독 설정하기</Link>
          </section>
        </aside>
      </main>
      <Footer />
    </>
  );
}
