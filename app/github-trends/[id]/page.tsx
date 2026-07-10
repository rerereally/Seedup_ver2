import { saveScrap } from '@/app/actions/scraps';
import ContentEngagement from '@/components/ContentEngagement';
import ViewTracker from '@/components/ViewTracker';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ShareButton from '@/components/ShareButton';
import { getExistingScrap, getGitHubTrend } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Bookmark, Code2, ExternalLink, GitFork, Github, Lightbulb, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function GitHubTrendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [repo, existingScrap] = await Promise.all([
    getGitHubTrend(id),
    getExistingScrap('github', id),
  ]);

  if (!repo) notFound();
  const projectTitle = repo.project_idea ? cleanProjectTitle(repo.project_idea) : '이 저장소의 핵심 기능을 작은 데모로 구현해보기';

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <Link href="/github-trends" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            오픈소스 목록으로
          </Link>

          <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <section className="border border-outline-soft bg-white p-5 md:p-7">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                  <span className="border border-outline-soft bg-surface px-2 py-1 text-ink">OPEN_SOURCE</span>
                  {repo.language && <span>{repo.language}</span>}
                </div>
                <h1 className="break-words text-3xl font-black leading-tight text-ink md:text-5xl">{repo.repo_full_name}</h1>
                {repo.description && <p className="mt-4 text-lg leading-8 text-muted">{repo.description}</p>}
              </section>

              <div className="mt-4 border border-outline-soft bg-white">
                <div className="flex flex-wrap gap-2 border-b border-outline-soft p-3">
                  <form action={saveScrap}>
                    <input type="hidden" name="item_type" value="github" />
                    <input type="hidden" name="item_id" value={repo.id} />
                    <input type="hidden" name="title" value={repo.repo_full_name} />
                    <input type="hidden" name="description" value={repo.beginner_summary ?? repo.description ?? ''} />
                    <input type="hidden" name="tag" value={repo.language ?? 'github'} />
                    <input type="hidden" name="return_to" value={`/github-trends/${repo.id}`} />
                    <button type="submit" className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink" aria-label={`${repo.repo_full_name} ${existingScrap ? '저장 해제' : '저장하기'}`}>
                      <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-ink text-ink' : ''}`} />
                      {existingScrap ? '저장 해제' : '저장'}
                    </button>
                  </form>
                  <Link href={repo.repo_url} target="_blank" className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink">
                    <ExternalLink className="h-4 w-4" />
                    저장소
                  </Link>
                  <ShareButton title={repo.repo_full_name} url={repo.repo_url} />
                </div>
                <div className="p-3">
                <ViewTracker itemType="github" itemId={repo.id} />
                <ContentEngagement itemType="github" itemId={repo.id} returnTo={`/github-trends/${repo.id}`} views={repo.view_count} likes={repo.like_count} dislikes={repo.dislike_count} />
                </div>
              </div>

              <section className="mt-5 border border-outline-soft bg-white p-5">
                <div className="mb-4 text-sm font-black uppercase text-ink">Repository Signals</div>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    [<Star key="star" className="h-4 w-4" />, repo.stars ?? 0, 'stars'],
                    [<GitFork key="fork" className="h-4 w-4" />, repo.forks ?? 0, 'forks'],
                    [<Code2 key="code" className="h-4 w-4" />, repo.relevance_score ?? '-', 'score'],
                    [<Github key="github" className="h-4 w-4" />, repo.language ?? '-', 'language'],
                  ].map(([icon, value, label]) => (
                    <div key={String(label)} className="border border-outline-soft bg-surface p-3">
                      <div className="flex items-center gap-1 text-ink">{icon}<span className="text-xl font-black">{value}</span></div>
                      <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-5 grid gap-5">
                {repo.beginner_summary && (
                  <section className="border border-outline-soft bg-white p-5">
                    <h2 className="text-sm font-black uppercase text-ink">Beginner Brief</h2>
                    <p className="mt-3 leading-8 text-muted">{repo.beginner_summary}</p>
                  </section>
                )}
                {repo.ai_review && (
                  <section className="border border-outline-soft bg-white p-5">
                    <h2 className="text-sm font-black uppercase text-ink">Seedup Review</h2>
                    <p className="mt-3 leading-8 text-muted">{repo.ai_review}</p>
                  </section>
                )}
              </div>

              <section className="mt-5 border border-outline-soft bg-white p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-ink">
                  <Lightbulb className="h-4 w-4" />
                  Next Actions
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: '프로젝트로 평가', href: `/ideas?idea=${encodeURIComponent(projectTitle)}` },
                    { label: '관련 프로젝트 보기', href: '/projects' },
                    { label: '저장소 열기', href: repo.repo_url, external: true },
                  ].map((action) => (
                    <Link key={action.label} href={action.href} target={action.external ? '_blank' : undefined} className="flex items-center justify-between gap-3 border border-outline-soft bg-surface p-3 text-sm font-bold text-ink hover:border-ink">
                      {action.label}
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <aside className="w-full lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
              <section className="border border-outline-soft bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-ink">
                  <Github className="h-5 w-5" />
                  REPO_INFO.TS
                </div>
                <dl className="text-sm">
                  {[
                    ['language', repo.language ?? '-'],
                    ['stars', repo.stars ?? 0],
                    ['forks', repo.forks ?? 0],
                    ['score', repo.relevance_score ?? '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-t border-outline-soft py-3">
                      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
                      <dd className="max-w-xs text-right font-semibold leading-6 text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="mt-5 border border-outline-soft bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-ink">
                  <Lightbulb className="h-5 w-5" />
                  Build Direction
                </div>
                <p className="text-sm font-bold leading-7 text-ink">{projectTitle}</p>
              </section>
            </aside>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
