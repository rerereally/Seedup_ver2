import ScrapButton from '@/components/ScrapButton';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getProjectIdeas, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowRight, Calendar, CheckCircle2, Code2, Filter, TerminalSquare, TrendingUp } from 'lucide-react';
import Link from 'next/link';

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
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Projects"
            title="오늘 시작할 수 있는 실전 프로젝트"
            description="뉴스, 논문, 오픈소스에서 나온 신호를 작게 배포 가능한 프로젝트로 바꿔 정리했습니다. 난이도와 기간을 보고 바로 고르세요."
            icon={TerminalSquare}
          />

          <section className="border border-outline-soft bg-white p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-3 border-b border-outline-soft pb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-ink">
                <Filter className="h-4 w-4" />
                build_filter
              </div>
              <div className="text-xs font-bold uppercase text-muted">
                {filteredProjects.length} results / {beginnerProjects} beginner friendly
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <Link key={filter} href={buildHref(filter)} className={`inline-flex h-10 items-center border px-3 text-sm font-bold transition-colors ${activeFilter === filter ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-surface text-muted hover:border-ink hover:text-ink'}`}>
                  {filter}
                </Link>
              ))}
            </div>
          </section>

          {!filteredProjects.length ? (
            <EmptyState title={projects.length ? '조건에 맞는 프로젝트가 없습니다' : '아직 등록된 프로젝트가 없습니다'} description={projects.length ? '필터를 바꾸거나 전체 프로젝트를 확인해보세요.' : 'Supabase의 project_ideas 테이블에 데이터를 넣으면 프로젝트 카드가 자동으로 표시됩니다.'} />
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
                  : project.duration_days ? `${project.duration_days}일` : '기간 미정';

                return (
                  <article key={project.id} className="group flex min-h-96 flex-col border border-outline-soft bg-white transition-colors hover:border-ink">
                    <div className="border-b border-outline-soft p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex h-7 items-center border border-ink bg-ink px-2 text-xs font-black uppercase text-white">{project.level ?? '추천'}</span>
                          {durationLabel && (
                            <span className="inline-flex h-7 items-center gap-1 border border-outline-soft bg-surface px-2 text-xs font-bold text-muted">
                              <Calendar className="h-3.5 w-3.5" />
                              {durationLabel}
                            </span>
                          )}
                        </div>
                        <ScrapButton itemType="project" itemId={project.id} title={displayTitle} description={project.description} tag={project.related_trend ?? project.level ?? 'project'} initialSaved={isScrapped} iconOnly className="inline-flex h-10 w-10 items-center justify-center border border-outline-soft bg-white text-ink transition-colors hover:border-ink" />
                      </div>
                      <Link href={`/projects/${project.id}`} className="block">
                        <h2 className="line-clamp-2 text-2xl font-black leading-tight text-ink group-hover:underline">{displayTitle}</h2>
                      </Link>
                      {project.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{project.description}</p>}
                    </div>

                    <div className="grid grid-cols-2 border-b border-outline-soft">
                      <div className="border-r border-outline-soft p-4">
                        <div className="text-xs font-bold uppercase text-muted">output</div>
                        <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-ink">{project.portfolio_value ?? '배포 가능한 MVP와 README'}</p>
                      </div>
                      <div className="p-4">
                        <div className="text-xs font-bold uppercase text-muted">target</div>
                        <p className="mt-1 text-sm font-bold text-ink">{project.level ?? '초급'} 개발자</p>
                      </div>
                    </div>

                    <div className="flex-1 p-5">
                      <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-muted">
                        <CheckCircle2 className="h-4 w-4" />
                        first_steps
                      </div>
                      <div className="space-y-2">
                        {(planPreview.length ? planPreview : ['문제 정의와 핵심 화면 정리', '데이터 구조 설계', 'MVP 기능 구현']).map((step, index) => (
                          <div key={`${project.id}-${step}`} className="grid grid-cols-[2rem_1fr] gap-2 text-sm leading-6">
                            <span className="font-black text-ink">{index + 1}</span>
                            <span className="line-clamp-1 text-muted">{step}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-muted">
                          <Code2 className="h-4 w-4" />
                          stack
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(project.stack?.length ? project.stack : ['Next.js', 'Supabase']).slice(0, 5).map((tech, techIndex) => (
                            <span key={`${project.id}-${tech}-${techIndex}`} className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{tech}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-outline-soft p-4">
                      <span className="inline-flex min-w-0 items-center gap-1 text-xs font-bold uppercase text-muted">
                        <TrendingUp className="h-4 w-4 shrink-0" />
                        <span className="truncate">{project.related_trend ?? 'trend signal'}</span>
                      </span>
                      <Link href={`/projects/${project.id}`} className="inline-flex h-10 shrink-0 items-center gap-1 bg-ink px-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
                        플랜 보기
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {filteredProjects.length > PAGE_SIZE && (
            <nav className="flex justify-center gap-2">
              <Link href={buildHref(activeFilter, Math.max(1, currentPage - 1))} className={`inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-sm font-bold ${currentPage === 1 ? 'pointer-events-none opacity-40' : 'hover:border-ink hover:text-ink'}`}>
                이전
              </Link>
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <Link key={pageNumber} href={buildHref(activeFilter, pageNumber)} className={`inline-flex h-10 w-10 items-center justify-center text-sm font-bold ${currentPage === pageNumber ? 'bg-ink text-white' : 'border border-outline-soft bg-white text-muted hover:border-ink hover:text-ink'}`}>
                    {pageNumber}
                  </Link>
                );
              })}
              <Link href={buildHref(activeFilter, Math.min(totalPages, currentPage + 1))} className={`inline-flex h-10 items-center gap-1 border border-outline-soft px-3 text-sm font-bold ${currentPage === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-ink hover:text-ink'}`}>
                다음
              </Link>
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
