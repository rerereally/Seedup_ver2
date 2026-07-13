import ScrapButton from '@/components/ScrapButton';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getGitHubTrends, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Code2, ExternalLink, GitFork, Github, Star } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 10;

function buildHref(page: number) {
  return page <= 1 ? '/github-trends' : `/github-trends?page=${page}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export default async function GitHubTrendsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const [repos, scrapKeys] = await Promise.all([getGitHubTrends(), getScrapKeySet()]);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const totalPages = Math.max(1, Math.ceil(repos.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRepos = repos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const topRepo = repos[0];

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Open Source Radar"
            title="주목할 오픈소스 저장소"
            description="GitHub에서 감지한 인기 저장소를 개발자 관점으로 정리하고, 배울 점과 따라 만들어볼 프로젝트 단서까지 연결합니다."
            icon={Github}
            meta={(
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [`${repos.length}개`, '수집 저장소'],
                  [topRepo?.repo_full_name ?? '-', '최상위 저장소'],
                  [`${topRepo?.stars ?? '-'}개`, '최상위 stars'],
                ].map(([value, label]) => (
                  <div key={label} className="border border-outline-soft bg-white px-4 py-3">
                    <p className="text-2xl font-black text-ink">{value}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
                  </div>
                ))}
              </div>
            )}
          />

          {!repos.length ? (
            <EmptyState title="아직 수집된 오픈소스가 없습니다" description="/api/ingest/github를 실행하면 인기 저장소 리뷰가 이곳에 표시됩니다." />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {paginatedRepos.map((repo) => {
                const miniProject = repo.project_idea ? cleanProjectTitle(repo.project_idea) : '이 저장소의 핵심 흐름을 작게 구현해보기';
                const isScrapped = scrapKeys.has(`github:${repo.id}`);

                return (
                  <article key={repo.id} className="group flex min-h-80 flex-col border border-outline-soft bg-white p-5 transition-colors hover:border-ink">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-muted">
                          {repo.language && <span className="border border-outline-soft bg-surface px-2 py-1 text-ink">{repo.language}</span>}
                          <span>GITHUB</span>
                        </div>
                        <Link href={`/github-trends/${repo.id}`}>
                          <h2 className="break-words text-2xl font-black leading-tight text-ink group-hover:underline">{repo.repo_full_name}</h2>
                        </Link>
                        {repo.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{repo.description}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <ScrapButton itemType="github" itemId={repo.id} title={repo.repo_full_name} description={repo.beginner_summary ?? repo.description} tag={repo.language ?? 'github'} initialSaved={isScrapped} iconOnly className="border border-outline-soft bg-white p-2 text-muted hover:border-ink hover:text-ink" />
                        <Link href={repo.repo_url} target="_blank" className="border border-outline-soft bg-white p-2 text-muted hover:border-ink hover:text-ink" aria-label={`${repo.repo_full_name} 원문 보기`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        [<Star key="star" className="h-4 w-4" />, repo.stars ?? 0, 'stars'],
                        [<Star key="delta" className="h-4 w-4" />, `${Number(repo.stars_delta_7d ?? 0) >= 0 ? '+' : ''}${repo.stars_delta_7d ?? 0}`, '7d stars'],
                        [<GitFork key="fork" className="h-4 w-4" />, repo.forks ?? 0, 'forks'],
                        [<Code2 key="code" className="h-4 w-4" />, formatDate(repo.last_seen_at), 'seen'],
                      ].map(([icon, value, label]) => (
                        <div key={String(label)} className="border border-outline-soft bg-surface p-3">
                          <div className="flex items-center gap-1 text-ink">{icon}<span className="text-lg font-black">{value}</span></div>
                          <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid flex-1 gap-3 border border-outline-soft bg-surface p-4 text-sm leading-7">
                      <div>
                        <div className="text-xs font-black uppercase text-ink">왜 볼만한가</div>
                        <p className="mt-1 line-clamp-2 text-muted">{repo.ai_review ?? repo.beginner_summary ?? '최근 오픈소스 신호를 바탕으로 학습과 프로젝트 참고 가치가 있는 저장소입니다.'}</p>
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-ink">따라 만들 프로젝트</div>
                        <p className="mt-1 line-clamp-2 text-muted">{miniProject}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/github-trends/${repo.id}`} className="inline-flex h-10 items-center gap-1 bg-ink px-3 text-xs font-bold text-white">
                        상세 보기
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link href="/projects" className="inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-xs font-bold text-ink hover:border-ink" aria-label={`${repo.repo_full_name} 미니 프로젝트 보기`}>
                        <Code2 className="h-4 w-4" />
                        미니 프로젝트
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {repos.length > PAGE_SIZE && (
            <nav className="flex justify-center gap-2">
              <Link href={buildHref(Math.max(1, currentPage - 1))} className={`inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-sm font-semibold ${currentPage === 1 ? 'pointer-events-none opacity-40' : 'hover:border-ink hover:text-ink'}`}>
                <ArrowLeft className="h-4 w-4" />
                이전
              </Link>
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <Link key={pageNumber} href={buildHref(pageNumber)} className={`inline-flex h-10 w-10 items-center justify-center text-sm font-bold ${currentPage === pageNumber ? 'bg-ink text-white' : 'border border-outline-soft bg-white text-muted hover:border-ink hover:text-ink'}`}>
                    {pageNumber}
                  </Link>
                );
              })}
              <Link href={buildHref(Math.min(totalPages, currentPage + 1))} className={`inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-sm font-semibold ${currentPage === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-ink hover:text-ink'}`}>
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
