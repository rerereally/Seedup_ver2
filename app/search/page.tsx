import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAIProducts, getArticleFeedItems, getGitHubTrends, getProjectIdeas } from '@/lib/data';
import { getContentHref } from '@/lib/content-targets';
import { cleanProjectTitle } from '@/lib/utils';
import { getOpportunities } from '@/lib/opportunities/data';
import { Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '검색',
};

const EXAMPLES = ['MCP', '에이전트', 'RAG', 'CLI'];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const rawQuery = params.q?.trim() ?? '';
  const query = rawQuery.toLowerCase();
  const [articles, repos, products, projects, { opportunities }] = await Promise.all([getArticleFeedItems(), getGitHubTrends(), getAIProducts(), getProjectIdeas(), getOpportunities()]);
  const articleResults = query
    ? articles.filter((item) => [item.title, item.summary, item.category, item.source, ...(item.related_skills ?? [])].some((value) => value?.toLowerCase().includes(query))).slice(0, 12)
    : [];
  const repoResults = query
    ? repos.filter((repo) => [repo.repo_full_name, repo.description, repo.beginner_summary, repo.language, ...(repo.topics ?? [])].some((value) => value?.toLowerCase().includes(query))).slice(0, 8)
    : [];
  const projectResults = query
    ? projects.filter((project) => [project.title, project.description, project.related_trend, project.level, ...(project.stack ?? [])].some((value) => value?.toLowerCase().includes(query))).slice(0, 8)
    : [];
  const productResults = query
    ? products.filter((product) => [product.name, product.description, product.category, product.target_user, ...(product.use_cases ?? []), ...(product.topic_tags ?? []), ...(product.skill_tags ?? [])].some((value) => value?.toLowerCase().includes(query))).slice(0, 8)
    : [];
  const opportunityResults = query
    ? opportunities.filter((item) => [item.name, item.problem, item.gap, ...item.keywords].some((value) => value?.toLowerCase().includes(query))).slice(0, 6)
    : [];
  const totalResults = opportunityResults.length + articleResults.length + repoResults.length + productResults.length + projectResults.length;

  return (
    <>
      <Header />
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack max-w-[880px]">
          <header>
            <h1 className="page-intro-title">검색</h1>
            <form action="/search" role="search" className="mt-6 flex h-14 items-center gap-3 rounded-full border border-outline-soft bg-white pl-5 pr-2 transition-colors focus-within:border-ink">
              <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
              <label htmlFor="search-page-query" className="sr-only">Seedup 검색</label>
              <input id="search-page-query" name="q" defaultValue={rawQuery} placeholder="기회, 글, 저장소, 제품, 프로젝트" className="min-w-0 flex-1 rounded-none border-0 bg-transparent text-base text-ink placeholder:text-muted" style={{ outline: 'none' }} />
              <button type="submit" className="btn shrink-0">찾기</button>
            </form>
            {rawQuery
              ? <p className="page-intro-meta">‘{rawQuery}’ 결과 <span className="num text-ink">{totalResults}</span>건</p>
              : (
                <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                  이런 말로 찾아보세요
                  {EXAMPLES.map((example) => <Link key={example} href={`/search?q=${encodeURIComponent(example)}`} className="chip transition-colors hover:bg-outline-strong">{example}</Link>)}
                </p>
              )}
          </header>

          {rawQuery && !totalResults && <p className="empty-state">찾는 말이 들어간 것이 없습니다. 더 짧은 말이나 영어 이름으로 찾아보세요.</p>}

          {totalResults > 0 && (
            <div className="flex flex-col gap-9">
              <ResultSection title="기회" count={opportunityResults.length}>
                {opportunityResults.map((item) => (
                  <ResultRow key={item.slug} href={`/opportunities/${item.slug}`} label={`근거 ${item.evidence.length}건`} title={item.name} description={item.problem} />
                ))}
              </ResultSection>
              <ResultSection title="글과 논문" count={articleResults.length}>
                {articleResults.map((item) => (
                  <ResultRow key={`${item.type}-${item.id}`} href={item.type === 'paper' ? `/papers/${item.id}` : `/news/${item.id}`} label={item.type === 'paper' ? '논문' : item.category ?? '글'} title={item.title} description={item.summary} />
                ))}
              </ResultSection>
              <ResultSection title="오픈소스" count={repoResults.length}>
                {repoResults.map((repo) => (
                  <ResultRow key={repo.id} href={getContentHref('github', repo.id)} label={repo.language ?? ''} title={repo.repo_full_name} description={repo.beginner_summary ?? repo.description} />
                ))}
              </ResultSection>
              <ResultSection title="AI 제품" count={productResults.length}>
                {productResults.map((product) => (
                  <ResultRow key={product.id} href={getContentHref('ai_product', product.id)} label={product.category ?? ''} title={product.name} description={product.short_summary ?? product.description} />
                ))}
              </ResultSection>
              <ResultSection title="프로젝트" count={projectResults.length}>
                {projectResults.map((project) => (
                  <ResultRow key={project.id} href={getContentHref('project', project.id)} label={project.level ?? ''} title={cleanProjectTitle(project.title)} description={project.description} />
                ))}
              </ResultSection>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

// A group with nothing in it is left out, so the page is only as long as what was found.
function ResultSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <section>
      <h2 className="label">{title} <span className="num">{count}</span></h2>
      <div className="mt-2 divide-y divide-outline-soft border-y border-outline-soft">{children}</div>
    </section>
  );
}

function ResultRow({ href, label, title, description }: { href: string; label: string; title: string; description?: string | null }) {
  return (
    <Link href={href} className="group flex items-baseline gap-4 py-4">
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-snug text-ink group-hover:underline group-hover:underline-offset-4">{title}</span>
        {description && <span className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{description}</span>}
      </span>
      {label && <span className="hidden shrink-0 text-[13px] text-muted sm:inline">{label}</span>}
    </Link>
  );
}
