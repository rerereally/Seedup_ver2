import { saveScrap } from '@/app/actions/scraps';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getExistingScrap, getProjectIdea } from '@/lib/data';
import { incrementContentView } from '@/lib/engagement';
import { ArrowLeft, Bookmark, Calendar, CheckCircle2, Code2, Lightbulb, Rocket, Wrench } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, existingScrap] = await Promise.all([
    getProjectIdea(id),
    getExistingScrap('project', id),
  ]);

  if (!project) notFound();
  await incrementContentView('project', project.id);
  const tools = [
    ...(project.stack ?? []),
    'Supabase',
    'OpenRouter',
    'Vercel 또는 Cloudflare',
  ].filter((value, index, array) => value && array.indexOf(value) === index).slice(0, 8);

  return (
    <>
      <Header />
      <main className="blueprint-grid grow">
        <div className="mx-auto max-w-[980px] px-4 py-12 md:px-10 md:py-16">
          <Link href="/projects" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            프로젝트 목록으로
          </Link>
          <div className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                <Calendar className="h-4 w-4" />
                {project.duration_days ?? 7}일 빌드 플랜
              </div>
              <form action={saveScrap}>
                <input type="hidden" name="item_type" value="project" />
                <input type="hidden" name="item_id" value={project.id} />
                <input type="hidden" name="title" value={project.title} />
                <input type="hidden" name="description" value={project.description ?? ''} />
                <input type="hidden" name="tag" value={project.related_trend ?? project.level ?? 'project'} />
                <input type="hidden" name="return_to" value={`/projects/${project.id}`} />
                <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-outline-soft bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                  <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-brand-primary text-brand-primary' : ''}`} />
                  {existingScrap ? '스크랩 해제' : '스크랩'}
                </button>
              </form>
            </div>
            <h1 className="text-4xl font-bold leading-tight text-ink">{project.title}</h1>
            {project.description && <p className="mt-4 text-lg leading-8 text-muted">{project.description}</p>}
            <div className="mt-6">
              <ContentEngagement itemType="project" itemId={project.id} returnTo={`/projects/${project.id}`} views={Number(project.view_count ?? 0) + 1} likes={project.like_count} dislikes={project.dislike_count} />
            </div>

            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-outline-soft bg-surface p-5">
                <Rocket className="mb-3 h-5 w-5 text-brand-primary" />
                <h2 className="font-bold text-ink">완성 목표</h2>
                <p className="mt-2 text-sm leading-6 text-muted">작게라도 배포 가능한 MVP를 만들고 README에 문제 정의, 핵심 기능, 배운 점을 정리합니다.</p>
              </div>
              <div className="rounded-lg border border-outline-soft bg-surface p-5">
                <Code2 className="mb-3 h-5 w-5 text-brand-primary" />
                <h2 className="font-bold text-ink">추천 수준</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{project.level ?? '초급'} 개발자가 {project.duration_days ?? 7}일 안에 따라 만들 수 있게 범위를 줄여 시작합니다.</p>
              </div>
              <div className="rounded-lg border border-outline-soft bg-surface p-5">
                <Lightbulb className="mb-3 h-5 w-5 text-brand-primary" />
                <h2 className="font-bold text-ink">포트폴리오 포인트</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{project.portfolio_value ?? '뉴스나 트렌드를 실제 사용자 문제로 바꾸고, 데이터 저장/화면 구현/배포 흐름을 보여줄 수 있습니다.'}</p>
              </div>
            </section>

            <section className="mt-8 rounded-xl border border-outline-soft bg-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-brand-primary" />
                <h2 className="text-xl font-bold text-ink">추천 도구</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <span key={tool} className="rounded-full border border-outline-soft bg-white px-3 py-1.5 text-sm font-semibold text-muted">{tool}</span>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="mb-4 text-2xl font-bold text-ink">따라 만들기 플랜</h2>
              <div className="grid gap-3">
              {(project.plan ?? []).map((day, index) => (
                <div key={day} className="flex items-start gap-3 rounded-lg border border-surface-high bg-surface p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
                  <div>
                    <div className="text-sm font-bold text-brand-primary">Day {index + 1}</div>
                    <div className="font-semibold text-ink">{day}</div>
                    <p className="mt-1 text-sm leading-6 text-muted">{index === 0 ? '기능 범위를 줄이고 데이터 구조를 먼저 정리하세요.' : index === (project.plan?.length ?? 1) - 1 ? '배포 후 README와 회고를 남기면 포트폴리오 완성도가 올라갑니다.' : '작은 단위로 구현하고 바로 화면에서 확인하세요.'}</p>
                  </div>
                </div>
              ))}
              {!project.plan?.length && (
                <div className="rounded-lg border border-surface-high bg-surface p-4 text-sm leading-6 text-muted">
                  1일차: 문제 정의와 화면 스케치, 2일차: 데이터 구조 설계, 3-5일차: 핵심 기능 구현, 6일차: UI 정리, 7일차: 배포와 README 작성 순서로 진행하세요.
                </div>
              )}
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
