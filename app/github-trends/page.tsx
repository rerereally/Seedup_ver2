import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ExploreTabs from '@/components/ExploreTabs';
import { getGitHubTrends, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
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
      <main id="main-content" className="page-shell page-stack grow">
        <ExploreTabs />

          {!repos.length ? (
            <EmptyState title="아직 모인 저장소가 없습니다" description="수집이 한 번 돌고 나면 여기에 저장소 리뷰가 올라옵니다." />
          ) : (
            <div>
              <table className="w-full table-fixed border-collapse text-[15px]">
                <colgroup>
                  <col className="sm:w-[34%] lg:w-[27%]" />
                  <col className="hidden sm:table-column" />
                  <col className="hidden w-[120px] lg:table-column" />
                  <col className="w-[92px]" />
                  <col className="w-[84px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted">저장소</th>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted hidden sm:table-cell">설명</th>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted hidden lg:table-cell">언어</th>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted !text-right">별</th>
                    <th scope="col"><span className="sr-only">저장, 원본</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRepos.map((repo) => {
                    const miniProject = repo.project_idea ? cleanProjectTitle(repo.project_idea) : null;
                    const isScrapped = scrapKeys.has(`github:${repo.id}`);
                    const delta = Number(repo.stars_delta_7d ?? 0);
                    const review = repo.ai_review ?? repo.beginner_summary ?? repo.description;

                    return (
                      <tr key={repo.id} className="group relative border-t border-outline-soft align-top transition-colors last:border-b hover:bg-surface-low">
                        <td className="py-5 pr-4">
                          {/* The stretched link makes the whole row a target while the table stays a real table. */}
                          <Link href={`/github-trends/${repo.id}`} className="break-words font-semibold text-ink after:absolute after:inset-0 after:content-['']">{repo.repo_full_name}</Link>
                          <p className="mt-1 text-[13px] text-muted lg:hidden">{[repo.language, `${formatDate(repo.last_seen_at)} 확인`].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className="hidden py-5 pr-6 sm:table-cell">
                          {review && <p className="line-clamp-2 leading-6 text-tertiary">{review}</p>}
                          {miniProject && <p className="mt-1 line-clamp-1 text-[13px] text-muted">따라 만들어 볼 것 · {miniProject}</p>}
                        </td>
                        <td className="hidden py-5 text-muted lg:table-cell">{repo.language ?? '-'}</td>
                        <td className="py-5 text-right">
                          <span className="num text-ink">{count(repo.stars)}</span>
                          {delta !== 0 && <span className={`num block text-[13px] ${delta > 0 ? 'text-seed' : 'text-muted'}`}>7일 {delta > 0 ? '+' : ''}{count(delta)}</span>}
                        </td>
                        <td className="py-3">
                          <div className="relative z-10 flex justify-end">
                            <ScrapButton itemType="github" itemId={repo.id} title={repo.repo_full_name} description={repo.beginner_summary ?? repo.description} tag={repo.language ?? 'github'} initialSaved={isScrapped} iconOnly className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-mid hover:text-ink" />
                            <Link href={repo.repo_url} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-mid hover:text-ink" aria-label={`${repo.repo_full_name} GitHub에서 보기`}>
                              <ExternalLink aria-hidden="true" className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-5 text-[13px] leading-6 text-muted">
                각 저장소에는 &quot;따라 만들어 볼 것&quot;이 함께 붙습니다. 관심 분야에 맞는 항목은 주간 신호에도 들어갑니다.
                {topRepo && <> 저장소 <span className="num">{repos.length}</span>개 · 별이 가장 많은 곳 {topRepo.repo_full_name} <span className="num">{count(topRepo.stars)}</span>.</>}
              </p>
            </div>
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
      </main>
      <Footer />
    </>
  );
}
