import { saveScrap } from '@/app/actions/scraps';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getExistingScrap, getProjectIdea } from '@/lib/data';
import { incrementContentView } from '@/lib/engagement';
import { cleanProjectTitle } from '@/lib/utils';
import MarkdownContent from '@/components/MarkdownContent';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
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

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, existingScrap] = await Promise.all([
    getProjectIdea(id),
    getExistingScrap('project', id),
  ]);

  if (!project) notFound();
  await incrementContentView('project', project.id);
  const displayTitle = cleanProjectTitle(project.title);

  const tools = [
    ...(project.stack ?? []),
    'Supabase',
    'OpenRouter',
    'Vercel 또는 Cloudflare',
  ]
    .filter((v, i, arr) => v && arr.indexOf(v) === i)
    .slice(0, 8);

  const planSteps = (project.plan ?? []).map((raw, index) => ({
    index,
    raw,
    ...parsePlanStep(raw),
  }));

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">

          {/* 뒤로가기 */}
          <Link
            href="/projects"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            프로젝트 목록으로
          </Link>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

            {/* ── 좌측 메인 컬럼 ── */}
            <div className="min-w-0 flex-1">

              {/* 헤더 카드 */}
              <div className="border border-outline-soft bg-white p-5 md:p-7">
                {/* 메타 배지 */}
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                  <span className="border border-ink bg-ink px-2 py-1 text-white">
                    {project.level ?? '추천'}
                  </span>
                  {project.duration_days && (
                    <span className="inline-flex items-center gap-1 border border-outline-soft bg-surface px-2 py-1 text-ink">
                      <Calendar className="h-3.5 w-3.5" />
                      {project.duration_days}일 플랜
                    </span>
                  )}
                  {project.related_trend && (
                    <span className="border border-outline-soft bg-surface px-2 py-1 text-ink">
                      {project.related_trend}
                    </span>
                  )}
                </div>

                <h1 className="max-w-3xl text-3xl font-black leading-tight text-ink md:text-4xl">
                  {displayTitle}
                </h1>
              </div>

              {/* 프로젝트 상세 설명 — 마크다운 렌더링 */}
              {project.description && (
                <div className="mt-4 border border-outline-soft bg-white p-5 md:p-7">
                  <MarkdownContent content={project.description} />
                </div>
              )}

              {/* 액션 바 */}
              <div className="mt-4 border border-outline-soft bg-white">
                <div className="flex flex-wrap gap-2 border-b border-outline-soft p-3">
                  <form action={saveScrap}>
                    <input type="hidden" name="item_type" value="project" />
                    <input type="hidden" name="item_id" value={project.id} />
                    <input type="hidden" name="title" value={displayTitle} />
                    <input type="hidden" name="description" value={project.description ?? ''} />
                    <input type="hidden" name="tag" value={project.related_trend ?? project.level ?? 'project'} />
                    <input type="hidden" name="return_to" value={`/projects/${project.id}`} />
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink"
                      aria-label={`${displayTitle} ${existingScrap ? '저장 해제' : '내 프로젝트 후보에 저장하기'}`}
                    >
                      <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-ink text-ink' : ''}`} />
                      {existingScrap ? '저장 해제' : '저장'}
                    </button>
                  </form>
                  <Link
                    href="/projects"
                    className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink"
                  >
                    <ExternalLink className="h-4 w-4" />
                    다른 프로젝트
                  </Link>
                </div>
                <div className="p-3">
                  <ContentEngagement
                    itemType="project"
                    itemId={project.id}
                    returnTo={`/projects/${project.id}`}
                    views={Number(project.view_count ?? 0) + 1}
                    likes={project.like_count}
                    dislikes={project.dislike_count}
                  />
                </div>
              </div>

              {/* 프로젝트 개요 카드 3열 */}
              <div className="mt-4 grid gap-0 border border-outline-soft bg-white md:grid-cols-3">
                <div className="border-b border-outline-soft p-5 md:border-b-0 md:border-r">
                  <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-muted">
                    <Rocket className="h-4 w-4" />
                    완성 목표
                  </div>
                  <p className="text-sm leading-7 text-ink">
                    작게라도 배포 가능한 MVP를 만들고 README에 문제 정의, 핵심 기능, 배운 점을 정리합니다.
                  </p>
                </div>
                <div className="border-b border-outline-soft p-5 md:border-b-0 md:border-r">
                  <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-muted">
                    <Code2 className="h-4 w-4" />
                    추천 수준
                  </div>
                  <p className="text-sm leading-7 text-ink">
                    {project.level ?? '초급'} 개발자가 {project.duration_days ?? 7}일 안에 따라 만들 수 있게 범위를 줄여 시작합니다.
                  </p>
                </div>
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-muted">
                    <Trophy className="h-4 w-4" />
                    포트폴리오 포인트
                  </div>
                  <p className="text-sm leading-7 text-ink">
                    {project.portfolio_value ?? '뉴스나 트렌드를 실제 사용자 문제로 바꾸고, 데이터 저장/화면 구현/배포 흐름을 보여줄 수 있습니다.'}
                  </p>
                </div>
              </div>

              {/* 기술 스택 */}
              <section className="mt-4 border border-outline-soft bg-white p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-ink">
                  <Layers className="h-4 w-4" />
                  Tech Stack
                </div>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool) => (
                    <span
                      key={tool}
                      className="border border-outline-soft bg-surface px-3 py-1.5 text-sm font-bold text-ink"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </section>

              {/* Day별 빌드 플랜 */}
              <section className="mt-4 border border-outline-soft bg-white">
                <div className="flex items-center gap-2 border-b border-outline-soft p-5">
                  <Terminal className="h-5 w-5 text-ink" />
                  <h2 className="text-lg font-black uppercase text-ink">Build Plan</h2>
                  <span className="ml-auto text-xs font-bold uppercase text-muted">
                    {planSteps.length || 7}days
                  </span>
                </div>

                <div className="divide-y divide-outline-soft">
                  {planSteps.length > 0
                    ? planSteps.map(({ index, day, title, meta }) => (
                        <div key={`${index}-${title}`} className="p-5">
                          <div className="flex items-start gap-4">
                            {/* Day 번호 */}
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-ink bg-ink text-sm font-black text-white">
                              {day ? day.replace(/Day\s*/i, '') : index + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* 작업 제목 */}
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-ink" />
                                <span className="font-black text-ink">{title}</span>
                              </div>

                              {/* 도구/언어/방법 태그 */}
                              {meta.length > 0 && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {meta.map(({ label, value }) => (
                                    <div
                                      key={label}
                                      className="flex gap-2 border border-outline-soft bg-surface p-3 text-sm"
                                    >
                                      <span className="shrink-0 font-black uppercase text-ink">
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
                            { day: '1', title: '문제 정의 & 기획', tool: '노션 or 마크다운', method: '핵심 기능 3개로 범위를 좁히고 화면을 스케치한다' },
                            { day: '2', title: '데이터 모델 설계', tool: 'Supabase Table Editor', lang: 'SQL', method: '필요한 테이블을 설계하고 Supabase에서 생성한다' },
                            { day: '3-5', title: '핵심 기능 구현', tool: 'Next.js API Route, Supabase Client', lang: 'TypeScript', method: 'CRUD 로직과 화면을 연결한다' },
                            { day: '6', title: 'UI 다듬기 & 테스트', tool: '브라우저 DevTools', method: '모바일 반응형을 확인하고 엣지 케이스를 테스트한다' },
                            { day: '7', title: '배포 & README', tool: 'Vercel 또는 Cloudflare Pages', method: 'main 브랜치를 연결해 자동 배포하고 README를 작성한다' },
                          ].map((step) => (
                            <div key={step.day} className="flex items-start gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-ink bg-ink text-sm font-black text-white">
                                {step.day}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-ink" />
                                  <span className="font-black text-ink">{step.title}</span>
                                </div>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <div className="flex gap-2 border border-outline-soft bg-surface p-3 text-sm">
                                    <span className="shrink-0 font-black uppercase text-ink">도구</span>
                                    <span className="text-muted">{step.tool}</span>
                                  </div>
                                  {'lang' in step && (
                                    <div className="flex gap-2 border border-outline-soft bg-surface p-3 text-sm">
                                      <span className="shrink-0 font-black uppercase text-ink">언어</span>
                                      <span className="text-muted">{step.lang}</span>
                                    </div>
                                  )}
                                  <div className="flex gap-2 border border-outline-soft bg-surface p-3 text-sm sm:col-span-2">
                                    <span className="shrink-0 font-black uppercase text-ink">방법</span>
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
            <aside className="w-full lg:sticky lg:top-24 lg:w-72 lg:shrink-0">
              {/* Next Actions */}
              <div className="border border-outline-soft bg-white">
                <div className="border-b border-outline-soft p-4 text-sm font-black uppercase text-ink">
                  <Lightbulb className="mb-1 h-4 w-4" />
                  Next Actions
                </div>
                <div className="divide-y divide-outline-soft">
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
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex items-center justify-between gap-3 p-4 text-sm font-bold text-ink hover:bg-surface"
                    >
                      <div>
                        <div>{action.label}</div>
                        <div className="mt-0.5 text-xs font-normal text-muted">{action.desc}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  ))}
                </div>
              </div>
            </aside>

          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
