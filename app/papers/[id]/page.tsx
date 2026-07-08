import { saveScrap } from '@/app/actions/scraps';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MarkdownContent from '@/components/MarkdownContent';
import ShareButton from '@/components/ShareButton';
import { incrementContentView } from '@/lib/engagement';
import { getExistingScrap, getResearchPaper } from '@/lib/data';
import { ArrowLeft, ArrowRight, Bookmark, Code2, ExternalLink, FlaskConical, Lightbulb } from 'lucide-react';
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
  const publishedAt = formatDate(paper.published_at ?? paper.created_at);
  const paperMarkdown = buildPaperMarkdown(paper);
  const buildPrompt = paper.implementation_idea ?? paper.service_idea ?? `${paper.title} 논문을 바탕으로 만들 수 있는 프로젝트를 평가해줘.`;
  const readingPoints = [
    paper.why_it_matters,
    paper.has_code ? '코드가 공개되어 구현 흐름을 직접 확인할 수 있습니다.' : null,
    paper.implementation_idea ? `구현 아이디어: ${paper.implementation_idea}` : null,
    paper.service_idea ? `서비스 아이디어: ${paper.service_idea}` : null,
  ].filter(Boolean);
  const scoreCards = [
    ['관련도', paper.relevance_score ?? '-'],
    ['빌드', paper.buildability_score ?? '-'],
    ['초보자', paper.beginner_score ?? '-'],
    ['비즈니스', paper.business_score ?? '-'],
  ];

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <Link href="/news?tab=paper" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            논문 아티클 목록으로
          </Link>

          <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="border border-outline-soft bg-white p-5 md:p-7">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                  <span className="border border-outline-soft bg-surface px-2 py-1 text-ink">{paper.review_type ?? 'PAPER'}</span>
                  {paper.has_code && <span className="border border-outline-soft bg-surface px-2 py-1 text-ink">CODE</span>}
                  {paper.difficulty && <span>{paper.difficulty}</span>}
                  {publishedAt && <span>{publishedAt}</span>}
                </div>
                <h1 className="text-3xl font-black leading-tight text-ink md:text-5xl">{paper.title}</h1>
                {paper.beginner_summary && <p className="mt-4 text-lg leading-8 text-muted">{paper.beginner_summary}</p>}
              </div>

              <div className="mt-4 border border-outline-soft bg-white">
                <div className="flex flex-wrap gap-2 border-b border-outline-soft p-3">
                  <form action={saveScrap}>
                    <input type="hidden" name="item_type" value="paper" />
                    <input type="hidden" name="item_id" value={paper.id} />
                    <input type="hidden" name="title" value={paper.title} />
                    <input type="hidden" name="description" value={paper.beginner_summary ?? paper.expert_summary ?? ''} />
                    <input type="hidden" name="tag" value={paper.review_type ?? 'paper'} />
                    <input type="hidden" name="return_to" value={`/papers/${paper.id}`} />
                    <button type="submit" className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink" aria-label={`${paper.title} ${existingScrap ? '저장 해제' : '저장하기'}`}>
                      <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-ink text-ink' : ''}`} />
                      {existingScrap ? '저장 해제' : '저장'}
                    </button>
                  </form>
                  {paper.paper_url && (
                    <Link href={paper.paper_url} target="_blank" className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink">
                      <ExternalLink className="h-4 w-4" />
                      원문
                    </Link>
                  )}
                  {paper.code_url && (
                    <Link href={paper.code_url} target="_blank" className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink">
                      <Code2 className="h-4 w-4" />
                      코드
                    </Link>
                  )}
                  <ShareButton title={paper.title} url={paper.paper_url} />
                </div>
                <div className="p-3">
                  <ContentEngagement itemType="paper" itemId={paper.id} returnTo={`/papers/${paper.id}`} views={Number(paper.view_count ?? 0) + 1} likes={paper.like_count} dislikes={paper.dislike_count} />
                </div>
              </div>

              <section className="mt-5 border border-outline-soft bg-white p-5">
                <div className="mb-4 text-sm font-black uppercase text-ink">Paper Signals</div>
                <div className="grid gap-3 sm:grid-cols-4">
                  {scoreCards.map(([label, value]) => (
                    <div key={label} className="border border-outline-soft bg-surface p-3">
                      <p className="text-xs font-bold uppercase text-muted">{label}</p>
                      <p className="mt-2 text-2xl font-black text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {!!readingPoints.length && (
                <section className="mt-5 border border-outline-soft bg-white p-5">
                  <div className="mb-4 text-sm font-black uppercase text-ink">Reading Points</div>
                  <div className="grid gap-3">
                    {readingPoints.map((point, index) => (
                      <div key={String(point)} className="flex gap-3 border border-outline-soft bg-surface p-3 text-sm font-semibold leading-7 text-muted">
                        <span className="font-black text-ink">#{index + 1}</span>
                        <p>{point}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {paperMarkdown && <div className="mt-5"><MarkdownContent content={paperMarkdown} /></div>}

              {!!paper.key_points?.length && (
                <section className="mt-5 border border-outline-soft bg-white p-5 md:p-6">
                  <h2 className="mb-4 text-sm font-black uppercase text-ink">Key Points</h2>
                  <div className="grid gap-3">
                    {paper.key_points.map((point, index) => (
                      <div key={point} className="flex gap-3 border border-outline-soft bg-surface p-3 text-sm font-semibold leading-7 text-muted">
                        <span className="font-black text-ink">#{index + 1}</span>
                        <p>{point}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-5 border border-outline-soft bg-white p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-ink">
                  <Lightbulb className="h-4 w-4" />
                  Next Actions
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: paper.implementation_idea ? '구현 아이디어 평가' : '프로젝트로 바꾸기', href: `/ideas?idea=${encodeURIComponent(buildPrompt)}` },
                    { label: paper.code_url ? '코드 저장소 열기' : '관련 프로젝트 보기', href: paper.code_url ?? '/projects', external: Boolean(paper.code_url) },
                    { label: '논문 목록으로', href: '/news?tab=paper' },
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
              <div className="border border-outline-soft bg-white p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-ink">
                  <FlaskConical className="h-5 w-5" />
                  PAPER_INFO.TS
                </div>
                <dl className="text-sm">
                  {[
                    ['추천 독자', paper.target_reader ?? 'AI/개발 트렌드를 공부하는 개발자'],
                    ['난이도', paper.difficulty ?? '-'],
                    ['출처', paper.source ?? 'Research'],
                    ['발행', publishedAt || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-t border-outline-soft py-3">
                      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
                      <dd className="max-w-xs text-right font-semibold leading-6 text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>

                {!!paper.related_skills?.length && (
                  <div className="mt-4 border-t border-outline-soft pt-4">
                    <h3 className="mb-3 text-xs font-black uppercase text-ink">연관 기술</h3>
                    <div className="flex flex-wrap gap-2">
                      {paper.related_skills.map((skill) => (
                        <span key={skill} className="border border-outline-soft bg-surface px-2.5 py-1 text-xs font-bold text-muted">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(paper.implementation_idea || paper.service_idea) && (
                <section className="mt-5 border border-outline-soft bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-ink">
                    <Lightbulb className="h-5 w-5" />
                    Build Direction
                  </div>
                  <p className="text-sm leading-7 text-muted">{paper.implementation_idea ?? paper.service_idea}</p>
                </section>
              )}
            </aside>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
