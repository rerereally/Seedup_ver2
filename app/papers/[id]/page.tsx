import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import ContentEngagement from '@/components/ContentEngagement';
import ArticleAssistant from '@/components/ArticleAssistant';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MarkdownContent from '@/components/MarkdownContent';
import ShareButton from '@/components/ShareButton';
import ViewTracker from '@/components/ViewTracker';
import { getExistingScrap, getResearchPaper } from '@/lib/data';
import { ArrowLeft, ArrowRight, Code2, ExternalLink, FlaskConical, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '논문 리뷰',
};

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function readablePaperText(value: string | null | undefined, title: string) {
  if (!value) return null;
  const cleaned = value
    .replace(/^arxiv:\S+\s*/i, '')
    .replace(/^announce\s+type:\s*\w+\s*/i, '')
    .replace(/^abstract:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (/^[A-Za-z0-9:.\-\s]+$/.test(cleaned) && cleaned.length < 120) {
    return `${title} 논문의 핵심 내용을 초보 개발자도 이해할 수 있게 정리한 리뷰입니다.`;
  }
  return cleaned;
}

function buildPaperMarkdown(paper: NonNullable<Awaited<ReturnType<typeof getResearchPaper>>>) {
  const beginnerSummary = readablePaperText(paper.beginner_summary, paper.title);
  const expertSummary = readablePaperText(paper.expert_summary, paper.title);
  const parts = [
    beginnerSummary ? `## 초보자용 해설\n\n${beginnerSummary}` : '',
    expertSummary ? `## 실무자 관점 요약\n\n${expertSummary}` : '',
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
  const publishedAt = formatDate(paper.published_at ?? paper.created_at);
  const paperMarkdown = buildPaperMarkdown(paper);
  const heroSummary = readablePaperText(paper.beginner_summary ?? paper.expert_summary ?? paper.abstract, paper.title);
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
      <main id="main-content" className="page-shell grow">
        <article className="min-w-0">
          <Link href="/news?tab=paper" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            논문 아티클 목록으로
          </Link>

          <div className="mt-4 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-muted">
                  <span className="chip">{paper.review_type ?? '논문'}</span>
                  {paper.has_code && <span className="chip">코드 공개</span>}
                  {paper.difficulty && <span>{paper.difficulty}</span>}
                  {publishedAt && <span>{publishedAt}</span>}
                </div>
                <h1 className="page-intro-title mt-4 break-words md:text-[44px] md:leading-[1.14]">{paper.title}</h1>
                {heroSummary && <p className="mt-4 max-w-[38em] text-lg leading-8 text-muted">{heroSummary}</p>}

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <ScrapButton itemType="paper" itemId={paper.id} title={paper.title} description={heroSummary} tag={paper.review_type ?? 'paper'} initialSaved={Boolean(existingScrap)} className="btn-quiet" />
                  {paper.paper_url && (
                    <Link href={paper.paper_url} target="_blank" className="btn">
                      <ExternalLink className="h-4 w-4" />
                      원문
                    </Link>
                  )}
                  {paper.code_url && (
                    <Link href={paper.code_url} target="_blank" className="btn-quiet">
                      <Code2 className="h-4 w-4" />
                      코드
                    </Link>
                  )}
                  <ShareButton title={paper.title} url={paper.paper_url} />
                </div>
                <div className="mt-6">
                  <ViewTracker itemType="paper" itemId={paper.id} />
                  <ContentEngagement itemType="paper" itemId={paper.id} returnTo={`/papers/${paper.id}`} views={paper.view_count} likes={paper.like_count} dislikes={paper.dislike_count} />
                </div>
              </div>

              <section className="card p-5 md:p-6">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">논문 정보</h2>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                  {scoreCards.map(([label, value]) => (
                    <div key={label} className="border-t border-outline-soft pt-3">
                      <p className="label">{label}</p>
                      <p className="num mt-2 text-[28px] font-semibold leading-tight text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {!!readingPoints.length && (
                <section className="card p-5 md:p-6">
                  <h2 className="text-xl font-extrabold tracking-tight text-ink">읽을 때 볼 것</h2>
                  <ol className="mt-2 divide-y divide-outline-soft">
                    {readingPoints.map((point, index) => (
                      <li key={String(point)} className="flex gap-4 py-3 text-[15px] leading-7 text-ink">
                        <span className="num w-6 shrink-0 text-muted">#{index + 1}</span>
                        <p>{point}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {paperMarkdown && <div><MarkdownContent content={paperMarkdown} /></div>}

              {!!paper.key_points?.length && (
                <section className="card p-5 md:p-6">
                  <h2 className="text-xl font-extrabold tracking-tight text-ink">핵심 내용</h2>
                  <ol className="mt-2 divide-y divide-outline-soft">
                    {paper.key_points.map((point, index) => (
                      <li key={point} className="flex gap-4 py-3 text-[15px] leading-7 text-ink">
                        <span className="num w-6 shrink-0 text-muted">#{index + 1}</span>
                        <p>{point}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="card p-5 md:p-6">
                <h2 className="mb-2 flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink">
                  <FlaskConical className="h-5 w-5" />
                  PAPER_INFO.TS
                </h2>
                <dl className="grid gap-0 text-sm md:grid-cols-2 md:gap-x-6">
                  {[
                    ['추천 독자', paper.target_reader ?? 'AI/개발 트렌드를 공부하는 개발자'],
                    ['난이도', paper.difficulty ?? '-'],
                    ['출처', paper.source ?? '연구'],
                    ['발행', publishedAt || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-t border-outline-soft py-3">
                      <dt className="text-[13px] font-medium text-muted">{label}</dt>
                      <dd className="max-w-xs text-right font-semibold leading-6 text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>

                {!!paper.related_skills?.length && (
                  <div className="mt-2 border-t border-outline-soft pt-4">
                    <h3 className="mb-3 text-[13px] font-bold text-ink">연관 기술</h3>
                    <div className="flex flex-wrap gap-2">
                      {paper.related_skills.map((skill) => (
                        <span key={skill} className="chip font-bold">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="card overflow-hidden">
                <h2 className="flex items-center gap-2 border-b border-outline-soft p-5 text-xl font-extrabold tracking-tight text-ink">
                  <Lightbulb className="h-4 w-4" />
                  Next Actions
                </h2>
                <ul className="divide-y divide-outline-soft">
                  {[
                    { label: paper.implementation_idea ? '구현 아이디어 평가' : '프로젝트로 바꾸기', href: `/ideas?idea=${encodeURIComponent(buildPrompt)}` },
                    { label: paper.code_url ? '코드 저장소 열기' : '관련 프로젝트 보기', href: paper.code_url ?? '/projects', external: Boolean(paper.code_url) },
                    { label: '논문 목록으로', href: '/news?tab=paper' },
                  ].map((action) => (
                    <li key={action.label}>
                      <Link href={action.href} target={action.external ? '_blank' : undefined} className="group flex items-center justify-between gap-3 p-4 text-sm font-bold text-ink hover:bg-surface">
                        <span className="group-hover:underline group-hover:underline-offset-4">{action.label}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <ArticleAssistant title={paper.title} summary={heroSummary} content={paperMarkdown} />

              {(paper.implementation_idea || paper.service_idea) && (
                <section className="card p-5 md:p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink">
                    <Lightbulb className="h-5 w-5" />
                    Build Direction
                  </h2>
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
