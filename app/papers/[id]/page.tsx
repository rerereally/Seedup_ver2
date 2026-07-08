import { saveScrap } from '@/app/actions/scraps';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MarkdownContent from '@/components/MarkdownContent';
import { incrementContentView } from '@/lib/engagement';
import { getExistingScrap, getResearchPaper } from '@/lib/data';
import { ArrowLeft, Bookmark, CheckCircle2, Code2, ExternalLink, FlaskConical, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function buildPaperMarkdown(paper: NonNullable<Awaited<ReturnType<typeof getResearchPaper>>>) {
  const parts = [
    paper.beginner_summary ? `## 초보자용 해설\n\n${paper.beginner_summary}` : '',
    paper.expert_summary ? `## 실무자 관점 요약\n\n${paper.expert_summary}` : '',
    paper.why_it_matters ? `## 왜 지금 봐야 하나요?\n\n${paper.why_it_matters}` : '',
    paper.implementation_idea ? `## 직접 구현해볼 아이디어\n\n${paper.implementation_idea}` : '',
    paper.service_idea ? `## 서비스 아이디어로 바꾸면\n\n${paper.service_idea}` : '',
  ];

  return parts.filter(Boolean).join('\n\n');
}

export default async function PaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [paper, existingScrap] = await Promise.all([
    getResearchPaper(id),
    getExistingScrap('paper', id),
  ]);

  if (!paper) notFound();
  await incrementContentView('paper', paper.id);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-[1180px] px-4 py-12 md:px-10 md:py-16">
          <Link href="/news?tab=paper" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            논문 아티클 목록으로
          </Link>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-bold text-brand-primary">
                <span className="rounded-full bg-brand-primary px-3 py-1 text-white">{paper.review_type ?? '논문 리뷰'}</span>
                {paper.has_code && <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">코드 공개</span>}
                <span className="text-muted">{formatDate(paper.published_at ?? paper.created_at)}</span>
              </div>
              <h1 className="text-4xl font-bold leading-tight text-ink md:text-5xl">{paper.title}</h1>
              {paper.beginner_summary && <p className="mt-6 text-xl leading-9 text-muted">{paper.beginner_summary}</p>}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <form action={saveScrap}>
                  <input type="hidden" name="item_type" value="paper" />
                  <input type="hidden" name="item_id" value={paper.id} />
                  <input type="hidden" name="title" value={paper.title} />
                  <input type="hidden" name="description" value={paper.beginner_summary ?? paper.expert_summary ?? ''} />
                  <input type="hidden" name="tag" value={paper.review_type ?? 'paper'} />
                  <input type="hidden" name="return_to" value={`/papers/${paper.id}`} />
                  <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-soft bg-white px-4 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                    <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-brand-primary text-brand-primary' : ''}`} />
                    {existingScrap ? '스크랩 해제' : '스크랩'}
                  </button>
                </form>
                <ContentEngagement itemType="paper" itemId={paper.id} returnTo={`/papers/${paper.id}`} views={Number(paper.view_count ?? 0) + 1} likes={paper.like_count} dislikes={paper.dislike_count} />
              </div>

              <section className="mt-10 rounded-xl border border-outline-soft bg-white p-6">
                <MarkdownContent content={buildPaperMarkdown(paper)} />
              </section>

              {!!paper.key_points?.length && (
                <section className="mt-8 rounded-xl border border-outline-soft bg-white p-6">
                  <h2 className="mb-4 text-2xl font-bold text-ink">핵심 포인트</h2>
                  <ul className="space-y-3">
                    {paper.key_points.map((point) => (
                      <li key={point} className="flex gap-3 text-base leading-7 text-muted">
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-brand-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-outline-soft bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-brand-primary">
                  <FlaskConical className="h-5 w-5" />
                  논문 읽기 정보
                </div>
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="font-bold text-ink">추천 독자</dt>
                    <dd className="mt-1 leading-6 text-muted">{paper.target_reader ?? 'AI/개발 트렌드를 공부하는 개발자'}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-ink">난이도</dt>
                    <dd className="mt-1 text-muted">{paper.difficulty ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-ink">점수</dt>
                    <dd className="mt-1 text-muted">관련도 {paper.relevance_score ?? '-'} · 빌드 {paper.buildability_score ?? '-'}</dd>
                  </div>
                </dl>

                {!!paper.related_skills?.length && (
                  <div className="mt-5 border-t border-outline-soft pt-5">
                    <h3 className="mb-3 text-sm font-bold text-ink">연관 기술</h3>
                    <div className="flex flex-wrap gap-2">
                      {paper.related_skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-outline-soft bg-surface px-3 py-1 text-xs font-semibold text-muted">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-2 border-t border-outline-soft pt-5">
                  {paper.paper_url && (
                    <Link href={paper.paper_url} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-3 text-sm font-bold text-white">
                      원문 보기
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  )}
                  {paper.code_url && (
                    <Link href={paper.code_url} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-soft bg-surface px-4 py-3 text-sm font-bold text-ink hover:border-brand-primary hover:text-brand-primary">
                      코드 보기
                      <Code2 className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>

              {(paper.implementation_idea || paper.service_idea) && (
                <div className="mt-5 rounded-xl border border-outline-soft bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-tertiary">
                    <Lightbulb className="h-5 w-5" />
                    만들어볼 방향
                  </div>
                  <p className="text-sm leading-7 text-muted">{paper.implementation_idea ?? paper.service_idea}</p>
                </div>
              )}
            </aside>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
