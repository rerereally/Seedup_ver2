import { saveScrap } from '@/app/actions/scraps';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getGitHubTrends, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Bookmark, Code2, ExternalLink, GitFork, Github, Star } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 10;

function buildHref(page: number) {
  return page <= 1 ? '/github-trends' : `/github-trends?page=${page}`;
}

export default async function GitHubTrendsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const [repos, scrapKeys] = await Promise.all([getGitHubTrends(), getScrapKeySet()]);
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
            eyebrow="Open Source"
            title="최근 주목받는 오픈소스"
            description="최근 인기 저장소를 초보자 관점에서 리뷰하고, 따라 만들어볼 프로젝트 단서로 연결합니다."
            icon={Github}
            meta={`총 ${repos.length}개 저장소`}
          />

          <div className="mt-9">
          {!repos.length ? (
            <EmptyState title="아직 수집된 오픈소스가 없습니다" description="/api/ingest/github를 실행하면 인기 저장소 리뷰가 이곳에 표시됩니다." />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {paginatedRepos.map((repo) => {
                const miniProject = repo.project_idea ? cleanProjectTitle(repo.project_idea) : '이 저장소의 핵심 흐름을 작게 구현해보기';
                const isScrapped = scrapKeys.has(`github:${repo.id}`);

                return (
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
                        <button type="submit" className="rounded-full border border-outline-soft p-2 text-muted hover:border-brand-primary hover:text-brand-primary" aria-label={`${repo.repo_full_name} ${isScrapped ? '저장 해제' : '저장하기'}`}>
                          <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-brand-primary text-brand-primary' : ''}`} />
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
                    <span>오픈소스 수집 데이터</span>
                  </div>
                  <div className="grid gap-3 rounded-lg border border-outline-soft bg-surface p-4 text-sm leading-7">
                    <div>
                      <div className="text-xs font-bold text-brand-primary">왜 볼만한가</div>
                      <p className="mt-1 line-clamp-2 text-muted">{repo.ai_review ?? repo.beginner_summary ?? '최근 오픈소스 신호를 바탕으로 학습과 프로젝트 참고 가치가 있는 저장소입니다.'}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-bold text-brand-primary">초보자가 배울 점</div>
                        <p className="mt-1 line-clamp-2 text-muted">{repo.beginner_summary ?? `${repo.language ?? '주요 기술'} 기반 구조와 저장소 구성을 살펴볼 수 있습니다.`}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-brand-primary">따라 만들 프로젝트</div>
                        <p className="mt-1 line-clamp-2 text-muted">{miniProject}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/projects" className="inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-xs font-semibold text-ink hover:border-brand-primary hover:text-brand-primary" aria-label={`${repo.repo_full_name} 미니 프로젝트 보기`}>
                      <Code2 className="h-4 w-4" />
                      미니 프로젝트 보기
                    </Link>
                  </div>
                </article>
              )})}
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
