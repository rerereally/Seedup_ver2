import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAIProducts, getArticleFeedItems, getGitHubTrends, getProjectIdeas } from '@/lib/data';
import { getContentHref } from '@/lib/content-targets';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowRight, Bot, FileText, Github, Lightbulb, Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const rawQuery = params.q?.trim() ?? '';
  const query = rawQuery.toLowerCase();
  const [articles, repos, products, projects] = await Promise.all([getArticleFeedItems(), getGitHubTrends(), getAIProducts(), getProjectIdeas()]);
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
  const totalResults = articleResults.length + repoResults.length + productResults.length + projectResults.length;

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
          <section className="border border-outline-soft bg-white">
            <div className="border-b border-outline-soft p-5 md:p-7">
              <div className="mb-4 inline-flex items-center gap-2 border border-outline-soft bg-surface px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-muted">
                <Search className="h-4 w-4" />
                콘텐츠 검색
              </div>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-4xl font-black leading-tight text-ink md:text-5xl">무엇을 찾고 있나요?</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Seedup에서 정리한 아티클, 오픈소스, AI 제품, 프로젝트 아이디어를 한 번에 찾아보세요.</p>
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{rawQuery ? `${totalResults}개 결과` : '검색어를 입력하세요'}</p>
              </div>
            </div>

            <form action="/search" className="flex gap-2 border-b border-outline-soft p-4 md:p-5">
              <label htmlFor="search-page-query" className="sr-only">Seedup 콘텐츠 검색</label>
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input id="search-page-query" name="q" defaultValue={rawQuery} placeholder="예: MCP, RAG, React, AI 에이전트" className="h-11 w-full border border-outline-soft bg-surface pl-10 pr-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-ink" />
              </div>
              <button type="submit" className="h-11 shrink-0 bg-ink px-5 text-sm font-bold text-white transition-opacity hover:opacity-90">검색</button>
            </form>
          </section>

          {!rawQuery ? (
            <section className="mt-6 border border-dashed border-outline-soft bg-white p-8 md:p-12">
              <p className="text-sm font-black text-ink">검색으로 다음 콘텐츠를 찾을 수 있습니다.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <SearchHint icon={<FileText className="h-4 w-4" />} label="아티클·논문" text="기술 흐름과 연구 내용을 찾아보세요." />
                <SearchHint icon={<Github className="h-4 w-4" />} label="오픈소스" text="저장소 이름, 언어, 토픽으로 검색하세요." />
                <SearchHint icon={<Bot className="h-4 w-4" />} label="AI 제품" text="제품명, 사용 사례와 기술로 검색하세요." />
                <SearchHint icon={<Lightbulb className="h-4 w-4" />} label="프로젝트" text="만들어볼 아이디어와 기술 스택을 찾아보세요." />
              </div>
            </section>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
              <ResultSection title="아티클·논문" count={articleResults.length} icon={<FileText className="h-4 w-4" />}>
                {articleResults.map((item) => (
                  <ResultRow key={`${item.type}-${item.id}`} href={item.type === 'paper' ? `/papers/${item.id}` : `/news/${item.id}`} label={item.type === 'paper' ? '논문' : item.category ?? '아티클'} title={item.title} description={item.summary} />
                ))}
              </ResultSection>
              <ResultSection title="오픈소스" count={repoResults.length} icon={<Github className="h-4 w-4" />}>
                {repoResults.map((repo) => (
                  <ResultRow key={repo.id} href={getContentHref('github', repo.id)} label={repo.language ?? 'Open Source'} title={repo.repo_full_name} description={repo.beginner_summary ?? repo.description} />
                ))}
              </ResultSection>
              <ResultSection title="AI 제품" count={productResults.length} icon={<Bot className="h-4 w-4" />}>
                {productResults.map((product) => (
                  <ResultRow key={product.id} href={getContentHref('ai_product', product.id)} label={product.category ?? 'AI Product'} title={product.name} description={product.short_summary ?? product.description} />
                ))}
              </ResultSection>
              <ResultSection title="프로젝트" count={projectResults.length} icon={<Lightbulb className="h-4 w-4" />}>
                {projectResults.map((project) => (
                  <ResultRow key={project.id} href={getContentHref('project', project.id)} label={project.level ?? 'Project'} title={cleanProjectTitle(project.title)} description={project.description} />
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

function SearchHint({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return <div className="border border-outline-soft bg-surface p-4"><div className="flex items-center gap-2 text-sm font-black text-ink">{icon}{label}</div><p className="mt-2 text-xs leading-6 text-muted">{text}</p></div>;
}

function ResultSection({ title, count, icon, children }: { title: string; count: number; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-outline-soft bg-white">
      <div className="flex items-center justify-between border-b border-outline-soft px-4 py-4">
        <h2 className="flex items-center gap-2 text-base font-black text-ink">{icon}{title}</h2>
        <span className="text-xs font-bold text-muted">{count}개</span>
      </div>
      {count ? <div className="divide-y divide-outline-soft">{children}</div> : <div className="p-5 text-sm leading-6 text-muted">이 영역에는 검색 결과가 없습니다.</div>}
    </section>
  );
}

function ResultRow({ href, label, title, description }: { href: string; label: string; title: string; description?: string | null }) {
  return (
    <Link href={href} className="group block p-4 transition-colors hover:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-black leading-6 text-ink">{title}</h3>
      {description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{description}</p>}
    </Link>
  );
}
