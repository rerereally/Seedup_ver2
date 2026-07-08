import { saveScrap } from '@/app/actions/scraps';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getGitHubTrends } from '@/lib/data';
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, GitFork, Github, Star } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 10;

function buildHref(page: number) {
  return page <= 1 ? '/github-trends' : `/github-trends?page=${page}`;
}

export default async function GitHubTrendsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const repos = await getGitHubTrends();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const totalPages = Math.max(1, Math.ceil(repos.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRepos = repos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell">
          <PageIntro
            eyebrow="GitHub Trends"
            title="최근 주목받는 개발 프로젝트"
            description="GitHub REST API로 수집한 인기 저장소를 초보자 관점에서 리뷰합니다."
            icon={Github}
            meta={`총 ${repos.length}개 저장소`}
          />

          <div className="mt-9">
          {!repos.length ? (
            <EmptyState title="아직 수집된 GitHub 트렌드가 없습니다" description="/api/ingest/github를 실행하면 인기 저장소 리뷰가 이곳에 표시됩니다." />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {paginatedRepos.map((repo) => (
                <article key={repo.id} className="rounded-xl border border-outline-soft bg-white p-5 transition-all hover:border-brand-primary hover:shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <Link href={`/github-trends/${repo.id}`}>
                        <h2 className="text-xl font-bold text-ink hover:text-brand-primary">{repo.repo_full_name}</h2>
                      </Link>
                      {repo.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{repo.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <form action={saveScrap}>
                        <input type="hidden" name="item_type" value="github" />
                        <input type="hidden" name="item_id" value={repo.id} />
                        <input type="hidden" name="title" value={repo.repo_full_name} />
                        <input type="hidden" name="description" value={repo.beginner_summary ?? repo.description ?? ''} />
                        <input type="hidden" name="tag" value={repo.language ?? 'github'} />
                        <input type="hidden" name="return_to" value="/github-trends" />
                        <button type="submit" className="rounded-full border border-outline-soft p-2 text-muted hover:border-brand-primary hover:text-brand-primary" aria-label={`${repo.repo_full_name} 스크랩`}>
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </form>
                      <Link href={repo.repo_url} target="_blank" className="rounded-full border border-outline-soft p-2 text-muted hover:border-brand-primary hover:text-brand-primary" aria-label={`${repo.repo_full_name} 원문 보기`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-3 text-sm text-muted">
                    <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-brand-primary" />{repo.stars ?? 0}</span>
                    <span className="inline-flex items-center gap-1"><GitFork className="h-4 w-4" />{repo.forks ?? 0}</span>
                    {repo.language && <span>{repo.language}</span>}
                  </div>
                  {repo.beginner_summary && <p className="rounded-lg border border-outline-soft bg-surface p-4 text-sm leading-7 text-muted">{repo.beginner_summary}</p>}
                  {repo.ai_review && <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted">{repo.ai_review}</p>}
                  {repo.project_idea && (
                    <div className="mt-4 rounded-lg bg-tertiary/10 p-4 text-sm font-semibold text-tertiary">
                      프로젝트 아이디어: {repo.project_idea}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
          </div>
          {repos.length > PAGE_SIZE && (
            <nav className="mt-8 flex justify-center gap-2">
              <Link href={buildHref(Math.max(1, currentPage - 1))} className={`inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-sm font-semibold ${currentPage === 1 ? 'pointer-events-none opacity-40' : 'hover:border-brand-primary hover:text-brand-primary'}`}>
                <ArrowLeft className="h-4 w-4" />
                이전
              </Link>
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <Link key={pageNumber} href={buildHref(pageNumber)} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${currentPage === pageNumber ? 'bg-brand-primary text-white' : 'border border-outline-soft bg-white text-muted hover:border-brand-primary hover:text-brand-primary'}`}>
                    {pageNumber}
                  </Link>
                );
              })}
              <Link href={buildHref(Math.min(totalPages, currentPage + 1))} className={`inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-sm font-semibold ${currentPage === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-brand-primary hover:text-brand-primary'}`}>
                다음
                <ArrowRight className="h-4 w-4" />
              </Link>
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
