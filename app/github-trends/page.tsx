import { saveScrap } from '@/app/actions/scraps';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getGitHubTrends } from '@/lib/data';
import { Bookmark, ExternalLink, GitFork, Github, Star } from 'lucide-react';
import Link from 'next/link';

export default async function GitHubTrendsPage() {
  const repos = await getGitHubTrends();

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-10 md:py-16">
          <section className="mb-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
              <Github className="h-4 w-4" />
              GitHub Trends
            </div>
            <h1 className="text-4xl font-bold text-ink">최근 주목받는 개발 프로젝트</h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted">GitHub REST API로 수집한 인기 저장소를 초보자 관점에서 리뷰합니다.</p>
          </section>

          {!repos.length ? (
            <EmptyState title="아직 수집된 GitHub 트렌드가 없습니다" description="/api/ingest/github를 실행하면 인기 저장소 리뷰가 이곳에 표시됩니다." />
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {repos.map((repo) => (
                <article key={repo.id} className="rounded-xl border border-outline-soft bg-white p-5 transition-all hover:border-brand-primary hover:shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-ink">{repo.repo_full_name}</h2>
                      {repo.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{repo.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <form action={saveScrap}>
                        <input type="hidden" name="item_type" value="github" />
                        <input type="hidden" name="item_id" value={repo.id} />
                        <input type="hidden" name="title" value={repo.repo_full_name} />
                        <input type="hidden" name="description" value={repo.beginner_summary ?? repo.description ?? ''} />
                        <input type="hidden" name="tag" value={repo.language ?? 'github'} />
                        <input type="hidden" name="return_to" value="/github-trends" />
                        <button type="submit" className="rounded-full border border-outline-soft p-2 text-muted hover:border-brand-primary hover:text-brand-primary" aria-label={`${repo.repo_full_name} 스크랩`}>
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </form>
                      <Link href={repo.repo_url} target="_blank" className="rounded-full border border-outline-soft p-2 text-muted hover:border-brand-primary hover:text-brand-primary" aria-label={`${repo.repo_full_name} 원문 보기`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-3 text-sm text-muted">
                    <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-brand-primary" />{repo.stars ?? 0}</span>
                    <span className="inline-flex items-center gap-1"><GitFork className="h-4 w-4" />{repo.forks ?? 0}</span>
                    {repo.language && <span>{repo.language}</span>}
                  </div>
                  {repo.beginner_summary && <p className="rounded-lg border border-outline-soft bg-surface p-4 text-sm leading-7 text-muted">{repo.beginner_summary}</p>}
                  {repo.project_idea && (
                    <div className="mt-4 rounded-lg bg-tertiary/10 p-4 text-sm font-semibold text-tertiary">
                      프로젝트 아이디어: {repo.project_idea}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
