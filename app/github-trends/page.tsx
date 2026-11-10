import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getGitHubTrends, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowLeft, ArrowRight, ExternalLink, GitFork, Star } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '오픈소스',
};

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

  const count = (value: number | null | undefined) => Number(value ?? 0).toLocaleString('en-US');

  return (
    <>
      <Header />
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            title="주목할 오픈소스"
            description="요즘 별이 빠르게 붙는 저장소를 골라, 왜 볼 만한지와 따라 만들어 볼 것을 한국어로 적어 두었습니다."
            meta={topRepo ? <>저장소 <span className="num text-ink">{repos.length}</span>개 · 별이 가장 많은 곳 <strong className="text-ink">{topRepo.repo_full_name}</strong> <span className="num text-ink">★{count(topRepo.stars)}</span></> : undefined}
          />

          {!repos.length ? (
            <EmptyState title="아직 모인 저장소가 없습니다" description="수집이 한 번 돌고 나면 여기에 저장소 리뷰가 올라옵니다." />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {paginatedRepos.map((repo) => {
                const miniProject = repo.project_idea ? cleanProjectTitle(repo.project_idea) : null;
                const isScrapped = scrapKeys.has(`github:${repo.id}`);
                const [owner, name] = repo.repo_full_name.includes('/') ? repo.repo_full_name.split('/') : ['', repo.repo_full_name];
                const delta = Number(repo.stars_delta_7d ?? 0);
                const review = repo.ai_review ?? repo.beginner_summary;

                return (
                  <article key={repo.id} className="card flex flex-col p-5 transition-colors hover:border-outline-strong md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[13px] text-muted">{[repo.language, `${formatDate(repo.last_seen_at)} 확인`].filter(Boolean).join(' · ')}</p>
                        <Link href={`/github-trends/${repo.id}`} className="mt-1.5 block">
                          <h2 className="break-words text-xl font-bold leading-snug text-ink">{owner && <span className="font-normal text-muted">{owner}/</span>}{name}</h2>
                        </Link>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <ScrapButton itemType="github" itemId={repo.id} title={repo.repo_full_name} description={repo.beginner_summary ?? repo.description} tag={repo.language ?? 'github'} initialSaved={isScrapped} iconOnly className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-high hover:text-ink" />
                        <Link href={repo.repo_url} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-high hover:text-ink" aria-label={`${repo.repo_full_name} GitHub에서 보기`}>
                          <ExternalLink aria-hidden="true" className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                      <div className="flex items-center gap-1.5"><dt><Star aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">별</span></dt><dd className="num text-ink">{count(repo.stars)}</dd></div>
                      {delta !== 0 && <div className="flex items-center gap-1.5"><dt>7일</dt><dd className={`num ${delta > 0 ? 'text-[#5fe3a1]' : 'text-ink'}`}>{delta > 0 ? '+' : ''}{count(delta)}</dd></div>}
                      <div className="flex items-center gap-1.5"><dt><GitFork aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">포크</span></dt><dd className="num text-ink">{count(repo.forks)}</dd></div>
                    </dl>

                    {(review || repo.description) && <p className="mt-4 line-clamp-3 text-[15px] leading-7 text-ink">{review ?? repo.description}</p>}
                    {miniProject && (
                      <p className="mt-4 line-clamp-2 border-l-2 border-outline-strong pl-3 text-sm leading-6 text-ink">
                        <span className="text-muted">따라 만들어 볼 것 · </span>{miniProject}
                      </p>
                    )}

                    <div className="mt-auto pt-5">
                      <Link href={`/github-trends/${repo.id}`} className="btn-quiet">
                        자세히 보기
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {repos.length > PAGE_SIZE && (
            <nav aria-label="쪽 이동" className="pager">
              <Link href={buildHref(Math.max(1, currentPage - 1))} aria-disabled={currentPage === 1}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                이전
              </Link>
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => (
                <Link key={index + 1} href={buildHref(index + 1)} aria-current={currentPage === index + 1 ? 'page' : undefined} className="num">{index + 1}</Link>
              ))}
              <Link href={buildHref(Math.min(totalPages, currentPage + 1))} aria-disabled={currentPage === totalPages}>
                다음
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
