import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import ContentEngagement from '@/components/ContentEngagement';
import ViewTracker from '@/components/ViewTracker';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getExistingScrap, getProjectIdea } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import MarkdownContent from '@/components/MarkdownContent';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Code2,
  ExternalLink,
  Layers,
  Lightbulb,
  Rocket,
  Terminal,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '프로젝트 상세',
};

/** "Day N: 작업 | 도구: X | 언어: Y | 방법: Z" 형태의 plan 항목을 파싱 */
function parsePlanStep(raw: string) {
  // Day N: 으로 시작하는 구조 처리
  const dayMatch = raw.match(/^(Day\s*\d+)\s*[:：]\s*/i);
  const rest = dayMatch ? raw.slice(dayMatch[0].length) : raw;

  // 파이프(|)로 분리된 섹션들 파싱
  const parts = rest.split('|').map((p) => p.trim());

  let title = parts[0] ?? rest;
  const meta: { label: string; value: string }[] = [];

  for (const part of parts.slice(1)) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const label = part.slice(0, colonIdx).trim();
    const value = part.slice(colonIdx + 1).trim();
    if (label && value) meta.push({ label, value });
  }

  return { day: dayMatch?.[1] ?? null, title, meta };
}

function normalizeBuildPlan(project: {
  build_plan?: Array<Record<string, unknown>> | null;
  plan?: string[] | null;
}) {
  if (Array.isArray(project.build_plan) && project.build_plan.length) {
    return project.build_plan.map((step, index) => ({
      index,
      day: String(step.order ?? index + 1),
      title: String(step.title ?? `실행 단계 ${index + 1}`),
      objective: String(step.objective ?? ''),
      tasks: Array.isArray(step.tasks) ? step.tasks.map(String) : [],
      tools: Array.isArray(step.tools) ? step.tools.map(String) : [],
      deliverable: String(step.deliverable ?? ''),
      doneWhen: String(step.done_when ?? ''),
      acceptanceCriteria: Array.isArray(step.acceptance_criteria) ? step.acceptance_criteria.map(String) : [],
      risks: Array.isArray(step.risks) ? step.risks.map(String) : [],
      hours: typeof step.estimated_hours_min === 'number' && typeof step.estimated_hours_max === 'number'
        ? `${step.estimated_hours_min}~${step.estimated_hours_max}시간`
        : null,
      meta: [],
    }));
  }
  return (project.plan ?? []).map((raw, index) => ({
    index,
    ...parsePlanStep(raw),
    objective: '',
    tasks: [],
    tools: [],
    deliverable: '',
    doneWhen: '',
    acceptanceCriteria: [],
    risks: [],
    hours: null,
  }));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, existingScrap] = await Promise.all([
    getProjectIdea(id),
    getExistingScrap('project', id),
  ]);

  if (!project) notFound();
  const displayTitle = cleanProjectTitle(project.title);

  const tools = (project.stack_details?.length ? project.stack_details.map((item) => item.name).filter(Boolean) : project.stack ?? []).filter((v, i, arr) => v && arr.indexOf(v) === i).slice(0, 8) as string[];
  const planSteps = normalizeBuildPlan(project);
  const duration = project.duration_estimate;
  const planHours = project.build_plan?.reduce((range, step) => ({
    min: range.min + (Number(step.estimated_hours_min) || 0),
    max: range.max + (Number(step.estimated_hours_max) || 0),
  }), { min: 0, max: 0 });
  const assumedHoursPerDay = duration?.assumed_hours_per_day ?? 2;
  const durationLabel = planHours?.min && planHours.max
    ? `${Math.ceil(planHours.min / assumedHoursPerDay)}~${Math.ceil(planHours.max / assumedHoursPerDay)}일`
    : duration?.minimum_days && duration.maximum_days
      ? `${duration.minimum_days}~${duration.maximum_days}일`
    : project.duration_days ? `${project.duration_days}일` : '기간 미정';
  const hoursLabel = planHours?.min && planHours.max
    ? `${planHours.min}~${planHours.max}시간`
    : duration?.estimated_hours_min && duration.estimated_hours_max
      ? `${duration.estimated_hours_min}~${duration.estimated_hours_max}시간`
      : null;

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">

        {/* 뒤로가기 */}
        <Link
          href="/projects"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          프로젝트 목록으로
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">

          {/* ── 좌측 메인 컬럼 ── */}
          <div className="flex min-w-0 flex-col gap-5">

            {/* 헤더 */}
            <div className="min-w-0">
              {/* 메타 배지 */}
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-muted">
                <span className="chip bg-ink text-white">
                  {project.level ?? '추천'}
                </span>
                {durationLabel && (
                  <span className="chip gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {durationLabel}
                  </span>
                )}
                {hoursLabel && (
                  <span className="chip">
                    {hoursLabel}
                  </span>
                )}
                {project.related_trend && (
                  <span className="chip">
                    {project.related_trend}
                  </span>
                )}
              </div>

              <h1 className="page-intro-title mt-4 max-w-3xl break-words md:text-[44px] md:leading-[1.14]">
                {displayTitle}
              </h1>
            </div>

            {/* 프로젝트 상세 설명 — 마크다운 렌더링 */}
            {project.description && (
              <div className="card p-5 md:p-7">
                <MarkdownContent content={project.description} />
              </div>
            )}

            {/* 액션 바 */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <ScrapButton itemType="project" itemId={project.id} title={displayTitle} description={project.description} tag={project.related_trend ?? project.level ?? 'project'} initialSaved={Boolean(existingScrap)} className="btn-quiet" />
                <Link
                  href="/projects"
                  className="btn-quiet"
                >
                  <ExternalLink className="h-4 w-4" />
                  다른 프로젝트
                </Link>
              </div>
              <div className="mt-4">
                <ViewTracker itemType="project" itemId={project.id} />
                <ContentEngagement
                  itemType="project"
                  itemId={project.id}
                  returnTo={`/projects/${project.id}`}
                  views={Number(project.view_count ?? 0)}
                  likes={project.like_count}
                  dislikes={project.dislike_count}
                />
              </div>
            </div>

            {/* 프로젝트 개요 카드 3열 */}
            <div className="card grid overflow-hidden md:grid-cols-3">
              <div className="border-b border-outline-soft p-5 md:border-b-0 md:border-r">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted">
                  <Rocket className="h-4 w-4" />
                  완성 목표
                </div>
                <p className="text-sm leading-7 text-ink">
                  작게라도 배포 가능한 MVP를 만들고 README에 문제 정의, 핵심 기능, 배운 점을 정리합니다.
                </p>
              </div>
              <div className="border-b border-outline-soft p-5 md:border-b-0 md:border-r">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted">
                  <Code2 className="h-4 w-4" />
                  추천 수준
                </div>
                <p className="text-sm leading-7 text-ink">
                  {project.level ?? '초급'} 개발자 기준 {durationLabel} 플랜입니다. {project.project_constraints?.primary_language ? `${project.project_constraints.primary_language} 한 가지 언어와 핵심 기능 ${project.project_constraints.core_feature_count ?? 3}개 기준으로 범위를 제한했습니다. ` : ''}{project.schedule_reasoning ?? duration?.reasoning ?? '핵심 흐름을 먼저 검증하고 확장 기능은 뒤로 미룹니다.'}
                </p>
              </div>
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted">
                  <Trophy className="h-4 w-4" />
                  포트폴리오 포인트
                </div>
                <p className="text-sm leading-7 text-ink">
                  {project.portfolio_value ?? '뉴스나 트렌드를 실제 사용자 문제로 바꾸고, 데이터 저장/화면 구현/배포 흐름을 보여줄 수 있습니다.'}
                </p>
              </div>
            </div>

            {(project.mvp_acceptance || project.scope || project.prerequisites?.length || project.difficulty_reasons?.length || project.technical_limitations?.length || project.assumptions?.length || project.validation_metrics?.length) && (
              <section className="grid gap-4 md:grid-cols-2">
                {project.mvp_acceptance && <div className="card border-ink bg-ink p-5 text-white md:col-span-2"><p className="text-[13px] font-medium text-white/60">완료 기준</p><p className="mt-3 max-w-3xl text-sm leading-7">{project.mvp_acceptance}</p></div>}
                {project.scope && <div className="card p-5 md:col-span-2"><h2 className="text-base font-extrabold tracking-tight text-ink">MVP 범위</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{[['이번 플랜에 포함', project.scope.must_have], ['권장 확장', project.scope.should_have], ['이번 플랜에서 제외', project.scope.excluded]].map(([label, items]) => <div key={String(label)}><p className="text-[13px] font-medium text-muted">{String(label)}</p><ul className="mt-2 grid gap-1">{(Array.isArray(items) ? items : []).map((item, itemIndex) => <li key={`${String(label)}-${itemIndex}`} className="text-xs leading-5 text-muted">- {item}</li>)}</ul></div>)}</div></div>}
                {project.prerequisites?.length ? <div className="card p-5"><h2 className="text-base font-extrabold tracking-tight text-ink">필요한 선행 지식</h2><ul className="mt-3 grid gap-2">{project.prerequisites.map((item, itemIndex) => <li key={`prerequisite-${itemIndex}`} className="text-sm leading-6 text-muted">- {item}</li>)}</ul></div> : null}
                {project.difficulty_reasons?.length ? <div className="card p-5"><h2 className="text-base font-extrabold tracking-tight text-ink">추천 수준인 이유</h2><ul className="mt-3 grid gap-2">{project.difficulty_reasons.map((item, itemIndex) => <li key={`difficulty-reason-${itemIndex}`} className="text-sm leading-6 text-muted">- {item}</li>)}</ul></div> : null}
                {project.technical_limitations?.length ? <div className="card p-5"><h2 className="text-base font-extrabold tracking-tight text-ink">기술적 한계</h2><ul className="mt-3 grid gap-2">{project.technical_limitations.map((item, itemIndex) => <li key={`limitation-${itemIndex}`} className="text-sm leading-6 text-muted">- {item}</li>)}</ul></div> : null}
                {project.assumptions?.length ? <div className="card p-5"><h2 className="text-base font-extrabold tracking-tight text-ink">전제 조건</h2><ul className="mt-3 grid gap-2">{project.assumptions.map((item, itemIndex) => <li key={`assumption-${itemIndex}`} className="text-sm leading-6 text-muted">- {item}</li>)}</ul></div> : null}
                {project.validation_metrics?.length ? <div className="card p-5 md:col-span-2"><h2 className="text-base font-extrabold tracking-tight text-ink">검증 지표</h2><div className="mt-3 grid gap-2 md:grid-cols-3">{project.validation_metrics.map((item, itemIndex) => <div key={`metric-${itemIndex}`} className="rounded-2xl bg-surface p-4"><p className="text-xs font-extrabold text-ink">{item.metric ?? '검증 항목'}</p><p className="mt-1 text-xs leading-5 text-muted">목표: {item.target ?? '-'}</p><p className="mt-1 text-xs leading-5 text-muted">방법: {item.method ?? '-'}</p></div>)}</div></div> : null}
              </section>
            )}

            {/* 기술 스택 */}
            <section className="card p-5 md:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink">
                <Layers className="h-4 w-4" />
                Tech Stack
              </h2>
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <span
                    key={tool}
                    className="chip px-3 py-1.5 text-sm font-bold"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </section>

            {/* Day별 빌드 플랜 */}
            <section className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-soft p-5">
                <Terminal className="h-5 w-5 text-ink" />
                <h2 className="text-xl font-extrabold tracking-tight text-ink">만드는 순서</h2>
                <span className="ml-auto text-[13px] font-medium text-muted">
                  {durationLabel}{hoursLabel ? ` · ${hoursLabel}` : ''}
                </span>
              </div>

              <div className="divide-y divide-outline-soft">
                {planSteps.length > 0
                  ? planSteps.map(({ index, day, title, meta, objective, tasks, tools: stepTools, deliverable, doneWhen, acceptanceCriteria, risks, hours }) => (
                      <div key={`${index}-${title}`} className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Day 번호 */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white">
                            {day ? day.replace(/Day\s*/i, '') : index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* 작업 제목 */}
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-ink" />
                              <span className="font-extrabold text-ink">{title}</span>
                            </div>

                            {objective && <p className="mt-2 text-sm leading-6 text-muted">{objective}</p>}
                            {!!tasks.length && <ul className="mt-3 grid gap-1">{tasks.map((task) => <li key={task} className="text-xs leading-5 text-muted">- {task}</li>)}</ul>}
                            {(deliverable || doneWhen || hours || stepTools.length > 0 || acceptanceCriteria.length || risks.length) && <div className="mt-3 grid gap-2 sm:grid-cols-2">{hours && <div className="rounded-2xl bg-surface p-3 text-xs"><span className="font-extrabold text-ink">예상 시간 </span><span className="text-muted">{hours}</span></div>}{stepTools.length > 0 && <div className="rounded-2xl bg-surface p-3 text-xs"><span className="font-extrabold text-ink">도구 </span><span className="text-muted">{stepTools.join(', ')}</span></div>}{deliverable && <div className="rounded-2xl bg-surface p-3 text-xs sm:col-span-2"><span className="font-extrabold text-ink">산출물 </span><span className="text-muted">{deliverable}</span></div>}{doneWhen && <div className="rounded-2xl bg-surface p-3 text-xs sm:col-span-2"><span className="font-extrabold text-ink">완료 조건 </span><span className="text-muted">{doneWhen}</span></div>}{acceptanceCriteria.length > 0 && <div className="rounded-2xl bg-surface p-3 text-xs sm:col-span-2"><span className="font-extrabold text-ink">검증 기준 </span><span className="text-muted">{acceptanceCriteria.join(' · ')}</span></div>}{risks.length > 0 && <div className="rounded-2xl bg-surface p-3 text-xs sm:col-span-2"><span className="font-extrabold text-ink">주의할 점 </span><span className="text-muted">{risks.join(' · ')}</span></div>}</div>}

                            {/* 이전 문자열 plan 호환용 메타 */}
                            {meta.length > 0 && (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {meta.map(({ label, value }, metaIndex) => (
                                  <div
                                    key={`${label}-${metaIndex}`}
                                    className="flex gap-2 rounded-2xl bg-surface p-3 text-sm"
                                  >
                                    <span className="shrink-0 font-bold text-ink">
                                      {label}
                                    </span>
                                    <span className="text-muted leading-6">{value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  : (
                    // 플랜 없을 때 기본 안내
                    <div className="p-5 text-sm leading-7 text-muted">
                      <div className="grid gap-3">
                        {[
                          { day: '01', title: '문제 정의와 핵심 화면', tool: '마크다운, Figma', method: '핵심 사용자와 기능 3개를 정하고 제외 범위를 기록한다' },
                          { day: '02', title: '데이터와 핵심 기능', tool: 'Next.js, Supabase', lang: 'TypeScript', method: '대표 사용 흐름을 실제 데이터와 연결한다' },
                          { day: '03', title: '실패 처리와 검증', tool: '브라우저 DevTools', method: '빈 값, API 실패, 모바일 화면을 테스트한다' },
                          { day: '04', title: '배포와 README', tool: 'Vercel', method: '배포 URL과 실행 방법, 제한 사항을 문서화한다' },
                        ].map((step) => (
                          <div key={step.day} className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white">
                              {step.day}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-ink" />
                                <span className="font-extrabold text-ink">{step.title}</span>
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <div className="flex gap-2 rounded-2xl bg-surface p-3 text-sm">
                                  <span className="shrink-0 font-bold text-ink">도구</span>
                                  <span className="text-muted">{step.tool}</span>
                                </div>
                                {'lang' in step && (
                                  <div className="flex gap-2 rounded-2xl bg-surface p-3 text-sm">
                                    <span className="shrink-0 font-bold text-ink">언어</span>
                                    <span className="text-muted">{step.lang}</span>
                                  </div>
                                )}
                                <div className="flex gap-2 rounded-2xl bg-surface p-3 text-sm sm:col-span-2">
                                  <span className="shrink-0 font-bold text-ink">방법</span>
                                  <span className="text-muted">{step.method}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </section>
          </div>

          {/* ── 우측 사이드바 ── */}
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            {/* Next Actions */}
            <section className="card overflow-hidden">
              <h2 className="flex items-center gap-2 border-b border-outline-soft p-5 text-xl font-extrabold tracking-tight text-ink">
                <Lightbulb className="h-4 w-4" />
                Next Actions
              </h2>
              <ul className="divide-y divide-outline-soft">
                {[
                  {
                    label: '아이디어 평가하기',
                    desc: '이 프로젝트의 시장성과 난이도를 분석합니다',
                    href: `/ideas?idea=${encodeURIComponent(`${displayTitle}를 7일 안에 만들 수 있는 초보자용 프로젝트로 평가해줘`)}`,
                  },
                  {
                    label: '다른 프로젝트 보기',
                    desc: '더 많은 실전 프로젝트를 확인합니다',
                    href: '/projects',
                  },
                  {
                    label: '최신 뉴스 읽기',
                    desc: '관련 트렌드를 파악합니다',
                    href: '/news',
                  },
                ].map((action) => (
                  <li key={action.label}>
                    <Link
                      href={action.href}
                      className="flex items-center justify-between gap-3 p-4 text-sm font-bold text-ink hover:bg-surface"
                    >
                      <div>
                        <div>{action.label}</div>
                        <div className="mt-0.5 text-xs font-normal text-muted">{action.desc}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

        </div>
      </main>
      <Footer />
    </>
  );
}
