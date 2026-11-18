import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ExploreTabs from '@/components/ExploreTabs';
import { getProjectIdeas, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '프로젝트',
};

const FILTERS = ['전체', '초급', '중급', '빠른 MVP', '트렌드 연동'];
const PAGE_SIZE = 9;

function buildHref(filter: string, page?: number) {
  const query = new URLSearchParams();
  if (filter !== '전체') query.set('filter', filter);
  if (page && page > 1) query.set('page', String(page));
  const search = query.toString();
  return `/projects${search ? `?${search}` : ''}`;
}

export default async function Projects({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const params = await searchParams;
  const activeFilter = params.filter ?? '전체';
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const [projects, scrapKeys] = await Promise.all([getProjectIdeas(), getScrapKeySet()]);
  const filteredProjects = projects.filter((project) => {
    if (activeFilter === '전체') return true;
    if (activeFilter === '초급' || activeFilter === '중급') return project.level === activeFilter;
    if (activeFilter === '빠른 MVP') return Number(project.duration_estimate?.maximum_days ?? project.duration_days ?? 99) <= 10;
    if (activeFilter === '트렌드 연동') return Boolean(project.related_trend);
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const beginnerProjects = projects.filter((project) => project.level === '초급').length;

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <ExploreTabs />

          {projects.length > 0 && <nav aria-label="프로젝트 조건" className="seg self-start">
            {FILTERS.map((filter) => (
              <Link key={filter} href={buildHref(filter)} aria-current={activeFilter === filter ? 'page' : undefined}>
                {filter}
                {activeFilter === filter && <span className="num text-xs text-muted">{filteredProjects.length}</span>}
              </Link>
            ))}
          </nav>}

          {!filteredProjects.length ? (
            <EmptyState title={projects.length ? '조건에 맞는 프로젝트가 없습니다' : '아직 정리된 프로젝트가 없습니다'} description={projects.length ? '조건을 바꾸거나 전체를 확인해 보세요.' : '수집이 한 번 돌고 나면 여기에 프로젝트가 올라옵니다.'} />
          ) : (
            <div>
              <table className="w-full table-fixed border-collapse text-[15px]">
                <colgroup>
                  <col className="sm:w-[36%] lg:w-[30%]" />
                  <col className="hidden sm:table-column" />
                  <col className="hidden w-[90px] lg:table-column" />
                  <col className="w-[84px]" />
                  <col className="w-[48px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted">프로젝트</th>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted hidden sm:table-cell">설명</th>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted hidden lg:table-cell">난이도</th>
                    <th scope="col" className="py-3 text-left text-[13px] font-normal text-muted !text-right">기간</th>
                    <th scope="col"><span className="sr-only">저장</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProjects.map((project) => {
                    const isScrapped = scrapKeys.has(`project:${project.id}`);
                    const displayTitle = cleanProjectTitle(project.title);
                    const durationLabel = project.duration_estimate?.minimum_days && project.duration_estimate.maximum_days
                      ? `${project.duration_estimate.minimum_days}~${project.duration_estimate.maximum_days}일`
                      : project.duration_days ? `${project.duration_days}일` : null;
                    const sub = [project.related_trend, ...(project.stack ?? []).slice(0, 4)].filter(Boolean).join(', ');

                    return (
                      <tr key={project.id} className="group relative border-t border-outline-soft align-top transition-colors last:border-b hover:bg-surface-low">
                        <td className="py-5 pr-4">
                          {/* The stretched link makes the whole row a target; the save button sits above it. */}
                          <Link href={`/projects/${project.id}`} className="font-semibold text-ink after:absolute after:inset-0 after:content-['']">{displayTitle}</Link>
                          {project.level && <p className="mt-1 text-[13px] text-muted lg:hidden">{project.level}</p>}
                        </td>
                        <td className="hidden py-5 pr-6 sm:table-cell">
                          {project.description && <p className="line-clamp-2 leading-6 text-tertiary">{project.description}</p>}
                          {sub && <p className="mt-1 line-clamp-1 text-[13px] text-muted">{sub}</p>}
                        </td>
                        <td className="hidden py-5 text-muted lg:table-cell">{project.level ?? '-'}</td>
                        <td className="num py-5 text-right text-ink">{durationLabel ?? '-'}</td>
                        <td className="py-3">
                          <ScrapButton itemType="project" itemId={project.id} title={displayTitle} description={project.description} tag={project.related_trend ?? project.level ?? 'project'} initialSaved={isScrapped} iconOnly className="relative z-10 ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-mid hover:text-ink" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-5 text-[13px] leading-6 text-muted">뉴스, 논문, 오픈소스에서 본 것을 작게 배포할 수 있는 크기로 줄였습니다. 단계별 계획은 각 프로젝트 안에 있습니다. 프로젝트 <span className="num">{projects.length}</span>개, 초급 <span className="num">{beginnerProjects}</span>개.</p>
            </div>
          )}

          {filteredProjects.length > PAGE_SIZE && (
            <nav aria-label="쪽 이동" className="pager">
              <Link href={buildHref(activeFilter, Math.max(1, currentPage - 1))} aria-disabled={currentPage === 1}>이전</Link>
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => (
                <Link key={index + 1} href={buildHref(activeFilter, index + 1)} aria-current={currentPage === index + 1 ? 'page' : undefined} className="num">{index + 1}</Link>
              ))}
              <Link href={buildHref(activeFilter, Math.min(totalPages, currentPage + 1))} aria-disabled={currentPage === totalPages}>다음</Link>
            </nav>
          )}
      </main>
      <Footer />
    </>
  );
}
