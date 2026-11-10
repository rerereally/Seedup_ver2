import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getProjectIdeas, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
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
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            title="만들어 볼 프로젝트"
            description="뉴스, 논문, 오픈소스에서 본 것을 작게 배포할 수 있는 크기로 줄였습니다. 난이도와 기간을 보고 고르세요."
            meta={projects.length ? <>프로젝트 <span className="num text-ink">{projects.length}</span>개 · 초급 <span className="num text-ink">{beginnerProjects}</span>개</> : undefined}
          />

          {projects.length > 0 && <nav aria-label="프로젝트 조건" className="tabs self-start">
            {FILTERS.map((filter) => (
              <Link key={filter} href={buildHref(filter)} aria-current={activeFilter === filter ? 'page' : undefined} className="tab">
                {filter}
                {activeFilter === filter && <span className="num">{filteredProjects.length}</span>}
              </Link>
            ))}
          </nav>}

          {!filteredProjects.length ? (
            <EmptyState title={projects.length ? '조건에 맞는 프로젝트가 없습니다' : '아직 정리된 프로젝트가 없습니다'} description={projects.length ? '조건을 바꾸거나 전체를 확인해 보세요.' : '수집이 한 번 돌고 나면 여기에 프로젝트가 올라옵니다.'} />
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedProjects.map((project) => {
                const isScrapped = scrapKeys.has(`project:${project.id}`);
                const displayTitle = cleanProjectTitle(project.title);
                const planPreview = project.build_plan?.length
                  ? project.build_plan.slice(0, 3).map((step) => step.title ?? '실행 단계')
                  : (project.plan ?? []).slice(0, 3);
                const durationLabel = project.duration_estimate?.minimum_days && project.duration_estimate.maximum_days
                  ? `${project.duration_estimate.minimum_days}~${project.duration_estimate.maximum_days}일`
                  : project.duration_days ? `${project.duration_days}일` : null;
                const meta = [project.level, durationLabel, project.related_trend].filter(Boolean);

                return (
                  <article key={project.id} className="card flex flex-col p-5 transition-colors hover:border-outline-strong md:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 pt-2.5 text-[13px] text-muted">{meta.length ? <><span className="font-bold text-ink">{meta[0]}</span>{meta.slice(1).map((part) => ` · ${part}`).join('')}</> : '프로젝트'}</p>
                      <ScrapButton itemType="project" itemId={project.id} title={displayTitle} description={project.description} tag={project.related_trend ?? project.level ?? 'project'} initialSaved={isScrapped} iconOnly className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-high hover:text-ink" />
                    </div>
                    <Link href={`/projects/${project.id}`} className="mt-1 block">
                      <h2 className="line-clamp-2 text-xl font-bold leading-snug text-ink">{displayTitle}</h2>
                    </Link>
                    {project.description && <p className="mt-2.5 line-clamp-3 text-[15px] leading-7 text-muted">{project.description}</p>}

                    {planPreview.length > 0 && (
                      <div className="mt-5">
                        <h3 className="label">처음 세 단계</h3>
                        <ol className="mt-1 divide-y divide-outline-soft">
                          {planPreview.map((step, index) => (
                            <li key={`${project.id}-${step}-${index}`} className="flex gap-3 py-2 text-sm leading-6">
                              <span className="num w-4 shrink-0 text-muted">{index + 1}</span>
                              <span className="line-clamp-1 text-ink">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {!!project.stack?.length && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {project.stack.slice(0, 5).map((tech, techIndex) => <span key={`${project.id}-${tech}-${techIndex}`} className="chip">{tech}</span>)}
                      </div>
                    )}

                    <div className="mt-auto pt-5">
                      <Link href={`/projects/${project.id}`} className="btn-quiet">
                        계획 보기
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>
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
        </div>
      </main>
      <Footer />
    </>
  );
}
