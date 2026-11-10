import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import ContentEngagement from '@/components/ContentEngagement';
import ViewTracker from '@/components/ViewTracker';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ShareButton from '@/components/ShareButton';
import { getExistingScrap, getGitHubTrend } from '@/lib/data';
import { cleanProjectTitle } from '@/lib/utils';
import { ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '오픈소스 상세',
};

export default async function GitHubTrendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [repo, existingScrap] = await Promise.all([
    getGitHubTrend(id),
    getExistingScrap('github', id),
  ]);

  if (!repo) notFound();
  const projectTitle = repo.project_idea ? cleanProjectTitle(repo.project_idea) : null;
  const [owner, name] = repo.repo_full_name.includes('/') ? repo.repo_full_name.split('/') : ['', repo.repo_full_name];
  const count = (value: number | null | undefined) => Number(value ?? 0).toLocaleString('en-US');
  const stats: Array<[string, string]> = [
    ['별', count(repo.stars)],
    ['포크', count(repo.forks)],
    ['언어', repo.language ?? '–'],
    ['관련도 점수', repo.relevance_score != null ? String(repo.relevance_score) : '–'],
  ];

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <Link href="/github-trends" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><span aria-hidden="true">←</span> 오픈소스 목록</Link>
        <div className="mt-4 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0">
            <p className="text-sm text-muted">{['오픈소스', repo.language].filter(Boolean).join(' · ')}</p>
            <h1 className="page-intro-title mt-3 break-words md:text-[48px] md:leading-[1.1]">{owner && <span className="font-normal text-muted">{owner}/</span>}{name}</h1>
            {repo.description && <p className="mt-4 max-w-[38em] text-lg leading-8 text-muted">{repo.description}</p>}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link href={repo.repo_url} target="_blank" rel="noreferrer" className="btn">
                GitHub에서 보기
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </Link>
              <ScrapButton itemType="github" itemId={repo.id} title={repo.repo_full_name} description={repo.beginner_summary ?? repo.description} tag={repo.language ?? 'github'} initialSaved={Boolean(existingScrap)} className="btn-quiet" />
              <ShareButton title={repo.repo_full_name} url={repo.repo_url} />
            </div>

            <dl className="card mt-8 grid grid-cols-2 overflow-hidden sm:grid-cols-4">
              {stats.map(([label, value], index) => (
                <div key={label} className={`border-outline-soft px-5 py-4 ${index % 2 ? 'border-l' : ''} ${index > 1 ? 'border-t sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}>
                  <dt className="label">{label}</dt>
                  <dd className={`mt-1 truncate text-[26px] font-semibold leading-tight text-ink ${index === 2 ? '' : 'num'}`}>{value}</dd>
                </div>
              ))}
            </dl>

            {repo.beginner_summary && (
              <section className="mt-10">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">처음 보는 사람을 위한 설명</h2>
                <p className="mt-3 max-w-[40em] text-[17px] leading-8 text-ink">{repo.beginner_summary}</p>
              </section>
            )}
            {repo.ai_review && (
              <section className="mt-10">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">왜 볼 만한가</h2>
                <p className="mt-3 max-w-[40em] text-[17px] leading-8 text-ink">{repo.ai_review}</p>
                <p className="mt-2 text-[13px] text-muted">AI가 저장소 설명을 읽고 쓴 글입니다.</p>
              </section>
            )}

            <div className="mt-10 border-t border-outline-soft pt-4">
              <ViewTracker itemType="github" itemId={repo.id} />
              <ContentEngagement itemType="github" itemId={repo.id} returnTo={`/github-trends/${repo.id}`} views={repo.view_count} likes={repo.like_count} dislikes={repo.dislike_count} />
            </div>
          </article>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            {projectTitle && (
              <section className="card p-5 md:p-6">
                <h2 className="label">따라 만들어 볼 것</h2>
                <p className="mt-2 text-[15px] leading-7 text-ink">{projectTitle}</p>
                <Link href={`/ideas?idea=${encodeURIComponent(projectTitle)}`} className="btn mt-5 w-full">
                  이 아이디어 평가하기
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </section>
            )}
            <Link href="/opportunities" className="card group flex items-center justify-between gap-3 p-5 transition-colors hover:border-outline-strong">
              <span>
                <span className="block text-[15px] font-bold text-ink">무엇을 만들지 아직 못 정했다면</span>
                <span className="mt-0.5 block text-[13px] text-muted">개발자들이 실제로 남긴 불만부터 보세요.</span>
              </span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink" />
            </Link>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
