import { saveScrap } from '@/app/actions/scraps';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getExistingScrap, getGitHubTrend } from '@/lib/data';
import { incrementContentView } from '@/lib/engagement';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowLeft, Bookmark, ExternalLink, GitFork, Github, Lightbulb, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function GitHubTrendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [repo, existingScrap] = await Promise.all([
    getGitHubTrend(id),
    getExistingScrap('github', id),
  ]);

  if (!repo) notFound();
  await incrementContentView('github', repo.id);
  const projectTitle = repo.project_idea ? cleanProjectTitle(repo.project_idea) : null;

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-[980px] px-4 py-12 md:px-10 md:py-16">
          <Link href="/github-trends" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            오픈소스 목록으로
          </Link>

          <section className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
              <Github className="h-4 w-4" />
              Open Source Review
            </div>
            <h1 className="text-4xl font-bold leading-tight text-ink">{repo.repo_full_name}</h1>
            {repo.description && <p className="mt-4 text-lg leading-8 text-muted">{repo.description}</p>}

            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-muted">
              <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-brand-primary" />{repo.stars ?? 0}</span>
              <span className="inline-flex items-center gap-1"><GitFork className="h-4 w-4" />{repo.forks ?? 0}</span>
              {repo.language && <span>{repo.language}</span>}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <form action={saveScrap}>
                <input type="hidden" name="item_type" value="github" />
                <input type="hidden" name="item_id" value={repo.id} />
                <input type="hidden" name="title" value={repo.repo_full_name} />
                <input type="hidden" name="description" value={repo.beginner_summary ?? repo.description ?? ''} />
                <input type="hidden" name="tag" value={repo.language ?? 'github'} />
                <input type="hidden" name="return_to" value={`/github-trends/${repo.id}`} />
                <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-soft bg-white px-4 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary" aria-label={`${repo.repo_full_name} ${existingScrap ? '저장 해제' : '저장하기'}`}>
                  <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-brand-primary text-brand-primary' : ''}`} />
                  {existingScrap ? '저장 해제' : '저장'}
                </button>
              </form>
              <ContentEngagement itemType="github" itemId={repo.id} returnTo={`/github-trends/${repo.id}`} views={Number(repo.view_count ?? 0) + 1} likes={repo.like_count} dislikes={repo.dislike_count} />
              <Link href={repo.repo_url} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                원본 저장소 보기
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-5">
              {repo.beginner_summary && (
                <section className="rounded-xl border border-outline-soft bg-surface p-5">
                  <h2 className="text-xl font-bold text-ink">초보자용 설명</h2>
                  <p className="mt-3 leading-8 text-muted">{repo.beginner_summary}</p>
                </section>
              )}
              {repo.ai_review && (
                <section className="rounded-xl border border-outline-soft bg-surface p-5">
                  <h2 className="text-xl font-bold text-ink">어떤 오픈소스인가요?</h2>
                  <p className="mt-3 leading-8 text-muted">{repo.ai_review}</p>
                </section>
              )}
              {projectTitle && (
                <section className="rounded-xl border border-tertiary/20 bg-tertiary/10 p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-tertiary">
                    <Lightbulb className="h-5 w-5" />
                    따라 만들어볼 프로젝트
                  </div>
                  <p className="text-lg font-bold leading-8 text-ink">{projectTitle}</p>
                </section>
              )}
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
