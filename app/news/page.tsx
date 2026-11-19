import { onboardingAnswers } from '@/lib/db/onboarding';
import type { Metadata } from 'next';
import RepoPicks, { rankRepos } from '@/components/RepoPicks';
import { ArticleCard, ArticleLead } from '@/components/ArticleCards';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getArticleFeedItems, getGitHubTrends, getScrapKeySet, getScraps, type ArticleFeedItem } from '@/lib/data';
import { leadRead, ruleReads } from '@/lib/personal';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { getOpportunities } from '@/lib/opportunities/data';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '아티클',
};

// A lead plus four rows of two cards.
const PAGE_SIZE = 9;

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

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; tab?: string; page?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const user = supabase ? await getCurrentUser() : null;
  const [articles, scrapKeys, { opportunities }, trends] = await Promise.all([getArticleFeedItems(), getScrapKeySet(), getOpportunities(), getGitHubTrends()]);
  // Open source lives under 트렌드 now (/github-trends); an old ?tab=github link lands on the newest reads.
  const tab = ['popular', 'news', 'paper', ...(user ? ['for-you'] : [])].includes(params.tab ?? '') ? params.tab as 'popular' | 'news' | 'paper' | 'for-you' : 'new';
  // For a signed-in reader: their onboarding answers plus what they kept, liked or disliked, scored without embeddings.
  const personal = new Map<string, { score: number; reason?: string }>();
  let reads: Awaited<ReturnType<typeof ruleReads>> = [];
  if (user && supabase) {
    const [answers, kept] = await Promise.all([onboardingAnswers(supabase, user.id), getScraps()]);
    reads = await ruleReads(user.id, answers as Parameters<typeof ruleReads>[1], kept).catch(() => []);
    for (const row of reads) personal.set(row.content.id, { score: row.score, reason: row.reasons[0] });
  }
  const repos = rankRepos(trends);
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
  const pool = tab === 'for-you' ? baseFiltered.filter((item) => personal.has(`${item.type}:${item.id}`)) : baseFiltered;
  const sortedArticles = [...pool].sort((a, b) => {
    if (tab === 'for-you') return (personal.get(`${b.type}:${b.id}`)?.score ?? 0) - (personal.get(`${a.type}:${a.id}`)?.score ?? 0);
    if (tab === 'popular') return popularityCompare(a, b) || new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });
  // The banner (first article of page 1) is the reader's own best pick on the plain lists; a search or category keeps its order.
  const lead = tab !== 'for-you' && !query && !selectedCategory ? leadRead(sortedArticles, reads) : null;
  if (lead) {
    sortedArticles.splice(sortedArticles.indexOf(lead.item), 1);
    sortedArticles.unshift(lead.item);
  }
  const listLength = sortedArticles.length;
  const totalPages = Math.max(1, Math.ceil(listLength / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedArticles = sortedArticles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const currentHref = buildHref({ tab, page: currentPage, category: selectedCategory, q: params.q?.trim() });

  const tabs = [
    ...(user ? [{ key: 'for-you', label: '나에게 맞는' }] : []),
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
      <main id="main-content" className="page-shell grow">
        <header>
          <h1 id="reads-heading" className="page-intro-title">아티클</h1>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted"><span>{today}</span><span>고른 글 {articles.length}편</span></p>
          <p className="mt-3 max-w-[40em] text-[15px] leading-7 text-tertiary">뉴스, 논문, 오픈소스에서 오늘 읽을 만한 글을 골라 한국어로 정리했습니다. 문제와 기회는 <Link href="/newsletter-preview" className="text-seed underline-offset-4 hover:underline">인사이트</Link>에 있습니다.</p>

          <nav aria-label="글 분류" className="tabs mt-4">
            {tabs.map((item) => (
              <Link key={item.key} href={buildHref({ tab: item.key, category: selectedCategory, q: params.q?.trim() })} scroll={false} aria-current={tab === item.key ? 'page' : undefined} className="tab">{item.label}</Link>
            ))}
          </nav>
        </header>

        <div className="page-split mt-6">
        <section className="min-w-0" aria-labelledby="reads-heading">

          {paginatedArticles.length ? (
            <>
            {tab === 'for-you' && <p className="mt-6 rounded-xl bg-surface-low px-4 py-3 text-[14px] leading-6 text-tertiary">고른 관심 분야와 킵하거나 좋아요한 글의 주제로 순서를 정했습니다. 킵한 글과 싫어요한 글은 빠집니다. <Link href="/onboarding" className="text-seed underline-offset-4 hover:underline">관심 분야 바꾸기</Link></p>}
            {/* One lead with its picture, then the rest as a two-column grid of cards. */}
            {(() => {
              const [first, ...rest] = paginatedArticles;
              const reasonOf = (item: ArticleFeedItem) => (tab === 'for-you' ? personal.get(`${item.type}:${item.id}`)?.reason : lead && currentPage === 1 && item === lead.item ? (lead.reason ? `나에게 맞는 글, ${lead.reason}` : '오늘의 추천') : undefined);
              return (
                <>
                  <div className="mt-8"><ArticleLead item={first} isScrapped={scrapKeys.has(`${first.type === 'paper' ? 'paper' : 'news'}:${first.id}`)} returnTo={currentHref} reason={reasonOf(first)} /></div>
                  {rest.length > 0 && (
                    <div className="mt-10 grid gap-x-8 gap-y-12 border-b border-outline-soft pb-10 sm:grid-cols-2">
                      {rest.map((item) => <ArticleCard key={item.id} item={item} returnTo={currentHref} reason={reasonOf(item)} />)}
                    </div>
                  )}
                </>
              );
            })()}
            </>
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

          {listLength > PAGE_SIZE && (
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

        <aside className="page-side">
          {grown.length > 0 && (
            <section aria-labelledby="grown-heading">
              <h2 id="grown-heading" className="text-[16px] font-bold">이번 주 자란 기회</h2>
              <p className="mt-1 text-sm text-muted">개발자 원문이 모여 검증을 통과한 문제</p>
              <ul className="rows mt-5">
                {grown.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/opportunities/${item.slug}`} className="block py-5 hover:bg-surface-low">
                      <span className="block font-semibold text-ink">{item.name}</span>
                      <span className="mt-1.5 flex flex-wrap gap-x-3 text-sm text-muted">
                        {item.qualified && <span className="font-semibold text-seed">원문 3건, 2곳 이상</span>}
                        <span>원문 {item.evidence.length}건</span>
                        <span>{item.directCount ? `직접 경쟁 ${item.directCount}개` : '직접 경쟁 없음'}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/opportunities" className="link-seed mt-4">인사이트 전체 보기</Link>
            </section>
          )}
          {repos.length > 0 && (
            <section aria-labelledby="repos-heading">
              <h2 id="repos-heading" className="text-[16px] font-bold">이번 주 오픈소스</h2>
              <p className="mt-1 text-sm text-muted">킵해 두면 코딩 에이전트가 MCP로 가져갑니다</p>
              <div className="mt-5"><RepoPicks repos={repos} kept={scrapKeys} /></div>
              <Link href="/github-trends" className="link-seed mt-4">오픈소스 전체 보기</Link>
            </section>
          )}
          <section className="card p-6">
            <h2 className="text-[16px] font-bold">주간 신호 받기</h2>
            <p className="mt-2 text-sm leading-6 text-muted">이 피드에서 내 관심 분야만 골라 매주 월요일 메일로 보냅니다.</p>
            <Link href="/newsletter-preview#subscription" className="btn mt-5 h-12 w-full text-[15px]">구독 설정하기</Link>
          </section>
        </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
