import { saveScrap } from '@/app/actions/scraps';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getProjectIdeas, getScrapKeySet } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowRight, Bookmark, Calendar, Filter, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const FILTERS = ['전체', '초급', '중급', '7일 플랜', '트렌드 연동'];
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
    if (activeFilter === '7일 플랜') return Number(project.duration_days ?? 0) <= 7;
    if (activeFilter === '트렌드 연동') return Boolean(project.related_trend);
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Projects"
            title="이번 주 만들 만한 프로젝트"
            description="개발 뉴스와 제품 트렌드를 기반으로 초보자가 바로 시작할 수 있는 프로젝트를 추천합니다."
            icon={Sparkles}
          />

          <section className="flex flex-wrap items-center gap-4 rounded-lg border border-outline-soft bg-surface p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Filter className="h-5 w-5" />
              필터
            </div>
            {FILTERS.map((filter) => (
              <Link key={filter} href={buildHref(filter)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${activeFilter === filter ? 'border-brand-primary bg-brand-primary text-white' : 'border-outline-soft bg-white text-muted hover:border-brand-primary hover:text-brand-primary'}`}>
                {filter}
              </Link>
            ))}
          </section>

          {!filteredProjects.length ? (
            <EmptyState title={projects.length ? '조건에 맞는 프로젝트가 없습니다' : '아직 등록된 프로젝트가 없습니다'} description={projects.length ? '필터를 바꾸거나 전체 프로젝트를 확인해보세요.' : 'Supabase의 project_ideas 테이블에 데이터를 넣으면 프로젝트 카드가 자동으로 표시됩니다.'} />
          ) : (
            <section className="grid gap-5 lg:grid-cols-3">
              {paginatedProjects.map((project) => {
                const isScrapped = scrapKeys.has(`project:${project.id}`);
                const displayTitle = cleanProjectTitle(project.title);

                return (
                <article key={project.id} className="group flex min-h-[360px] flex-col rounded-lg border border-outline-soft bg-white p-6 transition-all hover:border-l-2 hover:border-l-brand-primary hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                  <div className="mb-5 flex items-center justify-between">
                    {project.level && <span className="rounded bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">{project.level} 프로젝트</span>}
                    {project.duration_days && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                        <Calendar className="h-3.5 w-3.5" />
                        {project.duration_days}일 완성
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-semibold leading-snug text-ink transition-colors group-hover:text-brand-primary">{displayTitle}</h2>
                  {project.description && <p className="mt-3 flex-1 text-sm leading-6 text-muted">{project.description}</p>}
                  <div className="mt-5 grid gap-3 rounded-lg border border-outline-soft bg-surface-lowest p-4 text-sm leading-6">
                    <div>
                      <div className="text-xs font-bold text-brand-primary">결과물</div>
                      <p className="mt-1 line-clamp-2 text-muted">{project.description ?? '작게 배포 가능한 MVP와 README를 완성합니다.'}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-bold text-brand-primary">추천 대상</div>
                        <p className="mt-1 line-clamp-1 text-muted">{project.level ?? '초급'} 개발자</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-brand-primary">포트폴리오 포인트</div>
                        <p className="mt-1 line-clamp-1 text-muted">{project.portfolio_value ?? '트렌드를 실제 결과물로 바꾸는 실행력'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted/70">Technology Stack</div>
                    <div className="flex flex-wrap gap-2">
                      {(project.stack ?? []).map((tech) => (
                        <span key={tech} className="rounded border border-surface-high bg-surface px-2 py-1 text-xs text-muted">{tech}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-outline-soft/60 pt-5">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary">
                      <TrendingUp className="h-4 w-4" />
                      {project.related_trend}
                    </span>
                    <div className="flex gap-2">
                      <form action={saveScrap}>
                        <input type="hidden" name="item_type" value="project" />
                        <input type="hidden" name="item_id" value={project.id} />
                        <input type="hidden" name="title" value={displayTitle} />
                        <input type="hidden" name="description" value={project.description ?? ''} />
                        <input type="hidden" name="tag" value={project.related_trend ?? project.level ?? 'project'} />
                        <input type="hidden" name="return_to" value="/projects" />
                        <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-outline-soft px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand-primary hover:text-brand-primary" aria-label={`${displayTitle} ${isScrapped ? '저장 해제' : '내 프로젝트 후보에 저장하기'}`}>
                          <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-brand-primary text-brand-primary' : ''}`} />
                        </button>
                      </form>
                      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 rounded-lg border border-outline-soft px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand-primary hover:text-brand-primary">
                        플랜 보기
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              )})}
            </section>
          )}

          {filteredProjects.length > PAGE_SIZE && (
            <nav className="flex justify-center gap-2">
              <Link href={buildHref(activeFilter, Math.max(1, currentPage - 1))} className={`inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-sm font-semibold ${currentPage === 1 ? 'pointer-events-none opacity-40' : 'hover:border-brand-primary hover:text-brand-primary'}`}>
                이전
              </Link>
              {Array.from({ length: totalPages }).slice(0, 8).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <Link key={pageNumber} href={buildHref(activeFilter, pageNumber)} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${currentPage === pageNumber ? 'bg-brand-primary text-white' : 'border border-outline-soft bg-white text-muted hover:border-brand-primary hover:text-brand-primary'}`}>
                    {pageNumber}
                  </Link>
                );
              })}
              <Link href={buildHref(activeFilter, Math.min(totalPages, currentPage + 1))} className={`inline-flex h-10 items-center gap-1 rounded-lg border border-outline-soft px-3 text-sm font-semibold ${currentPage === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-brand-primary hover:text-brand-primary'}`}>
                다음
              </Link>
            </nav>
          )}

          <section className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-brand-primary" />
              <h2 className="text-2xl font-semibold text-ink">표준 7일 빌드 플랜 구조</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {['설계 및 환경 세팅', '핵심 기능 개발', 'UI/UX 다듬기', '배포 및 회고'].map((step, index) => (
                <div key={step} className="relative overflow-hidden rounded-lg border border-surface-high bg-surface p-5">
                  <div className="absolute -right-2 -top-4 text-6xl font-black text-surface-high">{index + 1}</div>
                  <div className="relative">
                    <div className="mb-1 text-sm font-bold text-brand-primary">Day {index === 0 ? '1-2' : index === 1 ? '3-4' : index === 2 ? '5-6' : '7'}</div>
                    <h3 className="font-semibold text-ink">{step}</h3>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
