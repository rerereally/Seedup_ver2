import { saveScrap } from '@/app/actions/scraps';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getExistingScrap, getProjectIdea } from '@/lib/data';
import { ArrowLeft, Bookmark, Calendar, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, existingScrap] = await Promise.all([
    getProjectIdea(id),
    getExistingScrap('project', id),
  ]);

  if (!project) notFound();

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
            <div className="mt-8 grid gap-3">
              {(project.plan ?? []).map((day, index) => (
                <div key={day} className="flex items-start gap-3 rounded-lg border border-surface-high bg-surface p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
                  <div>
                    <div className="text-sm font-bold text-brand-primary">Day {index + 1}</div>
                    <div className="font-semibold text-ink">{day}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
