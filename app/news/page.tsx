import { onboardingAnswers } from '@/lib/db/onboarding';
import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import RepoPicks, { rankRepos } from '@/components/RepoPicks';
import ArticleImage from '@/components/ArticleImage';
import ContentEngagement from '@/components/ContentEngagement';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getArticleFeedItems, getGitHubTrends, getScrapKeySet, getScraps, type ArticleFeedItem, type GitHubTrend } from '@/lib/data';
import { ruleReads } from '@/lib/personal';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { getOpportunities } from '@/lib/opportunities/data';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '아티클',
};

// A lead plus four rows of two cards.
const PAGE_SIZE = 9;

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

// Cut in code rather than with line-clamp: clamped lines stay in the layout and sit under the row below.
const clipText = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

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

function articleMeta(item: ArticleFeedItem) {
  const section = item.newsletter_section ? NEWSLETTER_SECTION_LABELS[item.newsletter_section] ?? item.newsletter_section : null;
  return { kind: item.type === 'paper' ? '논문 리뷰' : categoryLabel(item.category), section, source: item.source ?? 'Seedup', date: formatDate(item.published_at) };
}

/** The first article on a page: its picture beside it when the source has one, and the save and ask actions. */
function ArticleLead({ item, isScrapped, returnTo, reason }: { item: ArticleFeedItem; isScrapped: boolean; returnTo: string; reason?: string }) {
  const itemType = item.type === 'paper' ? 'paper' : 'news';
  const summary = item.short_summary ?? item.summary ?? item.beginner_summary;
  const meta = articleMeta(item);

  return (
    // Two columns only while the picture is there, so a refused picture leaves a full-width text lead.
    <article className="group grid gap-6 border-b border-outline-soft pb-10 lg:items-center lg:has-[img]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {item.image_url && <ArticleImage src={item.image_url} href={itemHref(item)} className="aspect-[16/10]" />}
      <div className="min-w-0">
        <p className="flex flex-wrap gap-x-3 text-[13px] text-muted">{reason && <span className="font-semibold text-seed">{reason}</span>}<span className="font-semibold text-ink">{meta.kind}</span>{meta.section && <span>{meta.section}</span>}<span>{meta.source}</span><span>{meta.date}</span></p>
        <Link href={itemHref(item)} className="mt-2 block underline-offset-4 hover:underline">
          <h2 className="text-[clamp(22px,2.2vw,28px)] font-bold leading-snug tracking-[-0.025em] text-ink [text-wrap:balance]">{item.title}</h2>
        </Link>
        {summary && <p className="mt-3 text-[16px] leading-7 text-tertiary">{clipText(summary, 150)}</p>}
        {item.why_it_matters && <p className="mt-4 border-l-2 border-outline-strong pl-3 text-[15px] leading-7 text-tertiary"><span className="mr-2 font-semibold text-ink">왜 중요한가</span>{clipText(item.why_it_matters, 110)}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <ScrapButton itemType={itemType} itemId={item.id} title={item.title} description={item.summary ?? item.beginner_summary} tag={item.category ?? 'article'} initialSaved={isScrapped} className="btn-quiet" />
          <Link href={itemHref(item)} className="text-sm text-tertiary underline-offset-4 hover:text-ink hover:underline">이 글에 질문하기</Link>
          <Link href="/opportunities" className="link-seed">관련 기회 보기</Link>
          <span className="ml-auto"><ContentEngagement itemType={itemType} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} /></span>
        </div>
      </div>
    </article>
  );
}

/** Every other article: picture on top when there is one, then what it is, the title and two lines. */
function ArticleCard({ item, returnTo, reason }: { item: ArticleFeedItem; returnTo: string; reason?: string }) {
  const itemType = item.type === 'paper' ? 'paper' : 'news';
  const summary = item.short_summary ?? item.summary ?? item.beginner_summary;
  const meta = articleMeta(item);

  return (
    <article className="group flex min-w-0 flex-col">
      {item.image_url && <ArticleImage src={item.image_url} href={itemHref(item)} className="mb-4 aspect-[16/9]" />}
      <p className="flex flex-wrap gap-x-3 text-[13px] text-muted">{reason && <span className="font-semibold text-seed">{reason}</span>}<span className="font-semibold text-ink">{meta.kind}</span><span>{meta.source}</span></p>
      <Link href={itemHref(item)} className="mt-1.5 block underline-offset-4 hover:underline">
        <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-ink [text-wrap:balance]">{clipText(item.title, 90)}</h2>
      </Link>
      {summary && <p className="mt-2 text-[14px] leading-6 text-muted">{clipText(summary, item.image_url ? 80 : 150)}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-3 text-[13px] text-muted">
        <time dateTime={item.published_at ?? undefined}>{meta.date}</time>
        <ContentEngagement itemType={itemType} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} />
      </div>
    </article>
  );
}

const KEEP = { savedLabel: '킵함', unsavedLabel: '킵하기' };
const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });

/** One repository in the feed: what it is, why it is here this week, and a keep button that MCP can read later. */
function RepoRow({ repo, isKept, lead }: { repo: GitHubTrend; isKept: boolean; lead: boolean }) {
  const [owner, name] = repo.repo_full_name.includes('/') ? repo.repo_full_name.split('/') : ['', repo.repo_full_name];
  const summary = repo.short_summary ?? repo.beginner_summary ?? repo.description;
  const gain = Number(repo.stars_delta_7d ?? 0);
  return (
    <article className={lead ? 'pb-9 pt-2' : 'py-7'}>
      <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
        {repo.language && <span>{repo.language}</span>}
        {repo.stars !== null && <span className="inline-flex items-center gap-1"><Star aria-hidden="true" className="h-3.5 w-3.5" /><span className="num">{compact.format(Number(repo.stars))}</span><span className="sr-only">스타</span></span>}
        {gain > 0 && <span className="font-semibold text-seed">이번 주 +{compact.format(gain)}</span>}
      </p>
      <Link href={`/github-trends/${repo.id}`} className="mt-2 block underline-offset-4 hover:underline">
        <h2 className={`${lead ? 'text-[22px] font-bold tracking-[-0.025em]' : 'text-[18px] font-semibold tracking-tight'} leading-tight text-ink [overflow-wrap:anywhere]`}>
          {owner && <span className="font-normal text-muted">{owner}/</span>}{name}
        </h2>
      </Link>
      {summary && <p className={`mt-3 text-tertiary ${lead ? 'text-[17px] leading-8' : 'text-[15px] leading-7'}`}>{clipText(summary, lead ? 150 : 95)}</p>}
      {lead && repo.project_idea && <p className="mt-3 text-[15px] leading-7 text-tertiary"><span className="mr-2 font-semibold text-ink">이렇게 써 볼 수 있어요</span>{clipText(repo.project_idea, 110)}</p>}
      {(repo.topics ?? []).length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="주제">
          {(repo.topics ?? []).slice(0, 4).map((topic) => <li key={topic} className="chip">{topic}</li>)}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ScrapButton itemType="github" itemId={repo.id} title={repo.repo_full_name} description={summary} tag={repo.language ?? 'github'} initialSaved={isKept} className="btn-quiet h-10" {...KEEP} />
        <a href={repo.repo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-tertiary underline-offset-4 hover:text-ink hover:underline">GitHub에서 보기</a>
      </div>
    </article>
  );
}

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; tab?: string; page?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const user = supabase ? await getCurrentUser() : null;
  const [articles, scrapKeys, { opportunities }, trends] = await Promise.all([getArticleFeedItems(), getScrapKeySet(), getOpportunities(), getGitHubTrends()]);
  const tab = ['popular', 'news', 'paper', 'github', ...(user ? ['for-you'] : [])].includes(params.tab ?? '') ? params.tab as 'popular' | 'news' | 'paper' | 'github' | 'for-you' : 'new';
  // For a signed-in reader: their onboarding answers plus what they kept, liked or disliked, scored without embeddings.
  const personal = new Map<string, { score: number; reason?: string }>();
  if (user && supabase && tab === 'for-you') {
    const [answers, kept] = await Promise.all([onboardingAnswers(supabase, user.id), getScraps()]);
    for (const row of await ruleReads(user.id, answers as Parameters<typeof ruleReads>[1], kept).catch(() => [])) personal.set(row.content.id, { score: row.score, reason: row.reasons[0] });
  }
  const repos = rankRepos(trends);
  const repoQuery = (repo: GitHubTrend) => !params.q || [repo.repo_full_name, repo.description, repo.short_summary, repo.language, ...(repo.topics ?? [])].some((value) => value?.toLowerCase().includes(params.q!.trim().toLowerCase()));
  const shownRepos = repos.filter(repoQuery);
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
  const listLength = tab === 'github' ? shownRepos.length : sortedArticles.length;
  const totalPages = Math.max(1, Math.ceil(listLength / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedArticles = sortedArticles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginatedRepos = shownRepos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const currentHref = buildHref({ tab, page: currentPage, category: selectedCategory, q: params.q?.trim() });

  const tabs = [
    ...(user ? [{ key: 'for-you', label: '나에게 맞는' }] : []),
    { key: 'new', label: '최신' },
    { key: 'popular', label: '인기' },
    { key: 'news', label: '뉴스·글' },
    { key: 'paper', label: '논문' },
    { key: 'github', label: '오픈소스' },
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

          {tab === 'github' ? (
            paginatedRepos.length ? (
              <>
                <p className="mt-6 rounded-xl bg-surface-low px-4 py-3 text-[14px] leading-6 text-tertiary">이번 주 스타가 많이 늘어난 저장소를 골랐습니다. <b className="font-semibold text-ink">킵하기</b>로 모아 두면 북마크에 남고, 코딩 에이전트가 MCP <code className="font-mono text-[13px]">get_kept_items</code>로 가져갑니다. <Link href="/agents" className="text-seed underline-offset-4 hover:underline">MCP 연동</Link></p>
                <div className="mt-6 divide-y divide-outline-soft border-b border-outline-soft">
                  {paginatedRepos.map((repo, index) => <RepoRow key={repo.id} repo={repo} isKept={scrapKeys.has(`github:${repo.id}`)} lead={index === 0 && currentPage === 1} />)}
                </div>
              </>
            ) : (
              <div className="mt-8">
                <EmptyState title={repos.length ? '조건에 맞는 저장소가 없습니다' : '아직 모인 저장소가 없습니다'} description={repos.length ? '검색어를 바꿔 보세요.' : '수집이 한 번 돌고 나면 이번 주 주목받는 저장소가 올라옵니다.'} actionHref="/news?tab=github" actionLabel="전체 보기" />
              </div>
            )
          ) : paginatedArticles.length ? (
            <>
            {tab === 'for-you' && <p className="mt-6 rounded-xl bg-surface-low px-4 py-3 text-[14px] leading-6 text-tertiary">고른 관심 분야와 킵하거나 좋아요한 글의 주제로 순서를 정했습니다. 킵한 글과 싫어요한 글은 빠집니다. <Link href="/onboarding" className="text-seed underline-offset-4 hover:underline">관심 분야 바꾸기</Link></p>}
            {/* One lead with its picture, then the rest as a two-column grid of cards. */}
            {(() => {
              const [first, ...rest] = paginatedArticles;
              const reasonOf = (item: ArticleFeedItem) => (tab === 'for-you' ? personal.get(`${item.type}:${item.id}`)?.reason : undefined);
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
          {tab !== 'github' && repos.length > 0 && (
            <section aria-labelledby="repos-heading">
              <h2 id="repos-heading" className="text-[16px] font-bold">이번 주 오픈소스</h2>
              <p className="mt-1 text-sm text-muted">킵해 두면 코딩 에이전트가 MCP로 가져갑니다</p>
              <div className="mt-5"><RepoPicks repos={repos} kept={scrapKeys} /></div>
              <Link href="/news?tab=github" className="link-seed mt-4">오픈소스 전체 보기</Link>
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
