import type { Metadata } from 'next';
import ScrapButton from '@/components/ScrapButton';
import ArticleAssistant from '@/components/ArticleAssistant';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MarkdownContent from '@/components/MarkdownContent';
import RelatedPapersToggle from '@/components/RelatedPapersToggle';
import ShareButton from '@/components/ShareButton';
import { getExistingScrap, getNewsItem, getRelatedPapersForNews } from '@/lib/data';
import ViewTracker from '@/components/ViewTracker';
import { ArrowRight, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '아티클 상세',
};

const NEWSLETTER_SECTION_LABELS: Record<string, string> = {
  daily_briefing: '핵심 뉴스',
  ai_product_radar: 'AI 제품',
  github_project_pick: 'GitHub Pick',
  build_idea: 'Build Idea',
  career_tip: 'Career Tip',
  deep_dive: 'Deep Dive',
  paper_to_project: '논문→프로젝트',
};

function getExternalUrl(value?: string | null) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, existingScrap, relatedPapers] = await Promise.all([
    getNewsItem(id),
    getExistingScrap('news', id),
    getRelatedPapersForNews(id),
  ]);

  if (!item) notFound();
  if (!item.content?.trim()) notFound();
  const publishedAt = item.published_at ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(item.published_at)) : null;
  const projectPrompt = item.project_idea ?? `${item.title}를 바탕으로 만들 수 있는 프로젝트를 평가해줘.`;
  const categoryQuery = item.category ? `/news?category=${encodeURIComponent(item.category)}` : '/news';
  const newsletterLabel = item.newsletter_section ? NEWSLETTER_SECTION_LABELS[item.newsletter_section] ?? item.newsletter_section : null;
  const summary = item.short_summary ?? item.summary;
  const externalUrl = getExternalUrl(item.original_url ?? item.source_url);
  const recommendationReasons = item.recommendation_reasons?.length
    ? item.recommendation_reasons
    : item.personalization_hooks?.length
      ? item.personalization_hooks
      : item.project_convertible
        ? ['프로젝트나 포트폴리오로 확장할 수 있습니다.']
        : [];
  const legacyReadingPoints = [
    recommendationReasons[0] ? `추천 이유: ${recommendationReasons[0]}` : null,
    item.why_it_matters,
    item.project_idea ? `프로젝트 연결: ${item.project_idea}` : null,
    item.learning_topics?.length ? `학습 주제: ${item.learning_topics.slice(0, 4).join(', ')}` : null,
    item.related_skills?.length ? `관련 기술: ${item.related_skills.slice(0, 4).join(', ')}` : null,
  ].filter(Boolean);
  const readingPoints = item.source === 'Seedup' && item.key_points?.length ? item.key_points : legacyReadingPoints;
  const evidenceLabel = item.article_evidence?.confidence === 'high' ? '근거 충분' : item.article_evidence?.confidence === 'medium' ? '근거 보통' : '근거 제한적';

  const scopeGroups: Array<[string, string[] | null | undefined]> = [
    ['한계와 주의점', item.technical_limitations],
    ['현실적인 MVP 범위', item.mvp_scope],
    ['이번에는 빼는 것', item.excluded_scope],
    ['끝나는 기준', item.measurable_acceptance_criteria],
  ];
  const tags = [...new Set([...(item.skill_tags ?? []), ...(item.topic_tags ?? []), ...(item.intent_tags ?? [])])].slice(0, 6);
  const meta = [item.category ?? '글', newsletterLabel, item.source ?? 'Seedup', publishedAt, item.difficulty].filter(Boolean);
  const nextActions = [
    { label: item.project_idea ? '이 아이디어 평가하기' : '아이디어로 바꿔 평가하기', href: `/ideas?idea=${encodeURIComponent(projectPrompt)}` },
    { label: '관련 기회 살펴보기', href: '/opportunities' },
    { label: item.category ? `${item.category} 글 더 읽기` : '글 더 읽기', href: categoryQuery },
  ];

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <Link href="/news" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><span aria-hidden="true">←</span> 글 목록</Link>
        <div className="mt-4 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0">
            <p className="text-sm text-muted"><span className="font-bold text-ink">{meta[0]}</span>{meta.slice(1).map((part) => ` · ${part}`).join('')}</p>
            <h1 className="page-intro-title mt-3 md:text-[44px] md:leading-[1.14]">{item.title}</h1>
            {summary && <p className="mt-4 max-w-[38em] text-lg leading-8 text-muted">{summary}</p>}
            {tags.length > 0 && <div className="mt-5 flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}</div>}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {externalUrl && (
                <Link href={externalUrl} target="_blank" rel="noreferrer" className="btn">
                  원문 보기
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </Link>
              )}
              <ScrapButton itemType="news" itemId={item.id} title={item.title} description={item.summary ?? item.beginner_summary} tag={item.category ?? 'news'} initialSaved={Boolean(existingScrap)} className="btn-quiet" />
              <ShareButton title={item.title} url={externalUrl} />
            </div>

            {!!readingPoints.length && (
              <section className="mt-10">
                <h2 className="label">읽을 때 볼 것</h2>
                <ol className="mt-1 divide-y divide-outline-soft">
                  {readingPoints.map((point, index) => (
                    <li key={String(point)} className="flex gap-4 py-3 text-[15px] leading-7 text-ink">
                      <span className="num w-4 shrink-0 text-muted">{index + 1}</span>
                      <p>{point}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {item.image_url && (
              <div className="relative mt-8 h-56 overflow-hidden rounded-[20px] border border-outline-soft">
                <Image src={item.image_url} alt="" fill sizes="820px" className="object-cover" />
              </div>
            )}

            <div className="mt-8">
              {item.content ? (
                <MarkdownContent content={item.content} />
              ) : (
                <p className="empty-state">이 글은 아직 한국어 본문이 만들어지지 않았습니다. 위 요약과 원문을 먼저 봐 주세요.</p>
              )}
            </div>

            {item.source === 'Seedup' && (item.article_evidence || scopeGroups.some(([, values]) => values?.length) || item.article_claims?.length) && (
              <section className="mt-10">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-xl font-extrabold tracking-tight text-ink">근거와 범위</h2>
                  {item.article_evidence && <p className="text-[13px] text-muted">{evidenceLabel} · 출처 <span className="num text-ink">{item.article_evidence.source_count ?? 0}</span>개</p>}
                </div>
                <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
                  {scopeGroups.map(([title, values]) => values?.length ? (
                    <div key={title}>
                      <h3 className="label">{title}</h3>
                      <ul className="mt-1 divide-y divide-outline-soft">{values.slice(0, 3).map((value, index) => <li key={`${title}-${index}`} className="py-2.5 text-sm leading-6 text-ink">{value}</li>)}</ul>
                    </div>
                  ) : null)}
                </div>
                {!!item.article_claims?.length && (
                  <div className="mt-6">
                    <h3 className="label">이 글의 주장은 어디서 왔나</h3>
                    <ul className="mt-1 divide-y divide-outline-soft">
                      {item.article_claims.slice(0, 3).map((claim, index) => (
                        <li key={`claim-${index}`} className="flex gap-3 py-2.5 text-sm leading-6">
                          <span className="w-20 shrink-0 text-muted">{claim.evidence_type === 'source' ? '수집한 근거' : claim.evidence_type === 'inference' ? '해석·제안' : '일반 해설'}</span>
                          <span className="text-ink">{claim.claim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <section className="mt-10">
              <h2 className="label">다음에 할 수 있는 것</h2>
              <ul className="mt-1 divide-y divide-outline-soft border-b border-outline-soft">
                {nextActions.map((action) => (
                  <li key={action.label}>
                    <Link href={action.href} className="group flex items-center justify-between gap-3 py-3.5 text-[15px] font-bold text-ink">
                      <span className="group-hover:underline group-hover:underline-offset-4">{action.label}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-6">
              <ViewTracker itemType="news" itemId={item.id} />
              <ContentEngagement itemType="news" itemId={item.id} returnTo={`/news/${item.id}`} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} />
            </div>
          </article>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <ArticleAssistant title={item.title} summary={item.beginner_summary ?? item.summary} content={item.content} />
            <RelatedPapersToggle links={relatedPapers} />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
