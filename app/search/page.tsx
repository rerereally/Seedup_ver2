import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getArticleFeedItems, getGitHubTrends, getProjectIdeas } from '@/lib/data';
import { getContentHref } from '@/lib/content-targets';
import { cleanProjectTitle } from '@/lib/utils';
import { Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? '';
  const [articles, repos, projects] = await Promise.all([getArticleFeedItems(), getGitHubTrends(), getProjectIdeas()]);
  const articleResults = query
    ? articles.filter((item) => [item.title, item.summary, item.category, item.source, ...(item.related_skills ?? [])].some((value) => value?.toLowerCase().includes(query))).slice(0, 12)
    : [];
  const repoResults = query
    ? repos.filter((repo) => [repo.repo_full_name, repo.description, repo.beginner_summary, repo.language, ...(repo.topics ?? [])].some((value) => value?.toLowerCase().includes(query))).slice(0, 8)
    : [];
  const projectResults = query
    ? projects.filter((project) => [project.title, project.description, project.related_trend, project.level, ...(project.stack ?? [])].some((value) => value?.toLowerCase().includes(query))).slice(0, 8)
    : [];

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-12 md:px-10 md:py-16">
          <section className="border-b border-outline-soft pb-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
              <Search className="h-4 w-4" />
              Search
            </div>
            <h1 className="text-4xl font-bold text-ink">검색 결과</h1>
            <p className="mt-3 text-muted">{query ? `"${params.q}" 검색 결과입니다.` : '헤더 검색창에서 키워드를 입력해보세요.'}</p>
          </section>

          <div className="mt-8 grid gap-8">
            <ResultSection title="아티클" count={articleResults.length}>
              {articleResults.map((item) => (
                <Link key={`${item.type}-${item.id}`} href={item.type === 'paper' ? `/papers/${item.id}` : `/news/${item.id}`} className="group rounded-xl border border-outline-soft bg-white p-5 hover:border-brand-primary">
                  <div className="mb-2 text-xs font-bold text-brand-primary">{item.type === 'paper' ? '논문' : item.category ?? '아티클'}</div>
                  <h2 className="line-clamp-2 text-xl font-bold text-ink group-hover:text-brand-primary">{item.title}</h2>
                  {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.summary}</p>}
                </Link>
              ))}
            </ResultSection>

            <ResultSection title="오픈소스" count={repoResults.length}>
              {repoResults.map((repo) => (
                <Link key={repo.id} href={getContentHref('github', repo.id)} className="group rounded-xl border border-outline-soft bg-white p-5 hover:border-brand-primary">
                  <div className="mb-2 text-xs font-bold text-brand-primary">{repo.language ?? 'Open Source'}</div>
                  <h2 className="line-clamp-2 text-xl font-bold text-ink group-hover:text-brand-primary">{repo.repo_full_name}</h2>
                  {(repo.beginner_summary ?? repo.description) && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{repo.beginner_summary ?? repo.description}</p>}
                </Link>
              ))}
            </ResultSection>

            <ResultSection title="프로젝트" count={projectResults.length}>
              {projectResults.map((project) => {
                const displayTitle = cleanProjectTitle(project.title);

                return (
                  <Link key={project.id} href={getContentHref('project', project.id)} className="group rounded-xl border border-outline-soft bg-white p-5 hover:border-brand-primary">
                    <div className="mb-2 text-xs font-bold text-brand-primary">{project.level ?? 'Project'}</div>
                    <h2 className="line-clamp-2 text-xl font-bold text-ink group-hover:text-brand-primary">{displayTitle}</h2>
                    {project.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{project.description}</p>}
                  </Link>
                );
              })}
            </ResultSection>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ResultSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-ink">{title}</h2>
        <span className="text-sm font-bold text-muted">{count}개</span>
      </div>
      {count ? (
        <div className="grid gap-4 md:grid-cols-2">{children}</div>
      ) : (
        <div className="rounded-xl border border-outline-soft bg-white p-5 text-sm text-muted">
          검색 결과가 없습니다.
        </div>
      )}
    </section>
  );
}
