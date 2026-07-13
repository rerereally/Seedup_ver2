import { saveScrap } from '@/app/actions/scraps';
import ArticleAssistant from '@/components/ArticleAssistant';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MarkdownContent from '@/components/MarkdownContent';
import RelatedPapersToggle from '@/components/RelatedPapersToggle';
import ShareButton from '@/components/ShareButton';
import { getExistingScrap, getNewsItem, getRelatedPapersForNews } from '@/lib/data';
import ViewTracker from '@/components/ViewTracker';
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, Lightbulb } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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
  const readingPoints = [
    recommendationReasons[0] ? `추천 이유: ${recommendationReasons[0]}` : null,
    item.why_it_matters,
    item.project_idea ? `프로젝트 연결: ${item.project_idea}` : null,
    item.learning_topics?.length ? `학습 주제: ${item.learning_topics.slice(0, 4).join(', ')}` : null,
    item.related_skills?.length ? `관련 기술: ${item.related_skills.slice(0, 4).join(', ')}` : null,
  ].filter(Boolean);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <Link href="/news" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            아티클 목록으로
          </Link>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="border border-outline-soft bg-white p-5 md:p-7">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                  <span className="border border-outline-soft bg-surface px-2 py-1 text-ink">{item.category ?? 'ARTICLE'}</span>
                  {newsletterLabel && <span className="border border-outline-soft bg-ink px-2 py-1 text-white">{newsletterLabel}</span>}
                  {Number(item.newsletter_priority ?? 0) >= 40 && <span>우선순위 {Math.round(Number(item.newsletter_priority))}</span>}
                  <span>{item.source ?? 'Seedup'}</span>
                  {publishedAt && <span>{publishedAt}</span>}
                  {item.difficulty && <span>{item.difficulty}</span>}
                </div>
                <h1 className="max-w-4xl text-3xl font-black leading-tight text-ink md:text-5xl">{item.title}</h1>
                {summary && <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">{summary}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  {[...(item.skill_tags ?? []), ...(item.topic_tags ?? []), ...(item.intent_tags ?? [])].slice(0, 6).map((tag) => (
                    <span key={tag} className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="mt-4 border border-outline-soft bg-white">
                <div className="flex flex-wrap gap-2 border-b border-outline-soft p-3">
                  <form action={saveScrap}>
                    <input type="hidden" name="item_type" value="news" />
                    <input type="hidden" name="item_id" value={item.id} />
                    <input type="hidden" name="title" value={item.title} />
                    <input type="hidden" name="description" value={item.summary ?? item.beginner_summary ?? ''} />
                    <input type="hidden" name="tag" value={item.category ?? 'news'} />
                    <input type="hidden" name="return_to" value={`/news/${item.id}`} />
                    <button type="submit" className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink" aria-label={`${item.title} ${existingScrap ? '저장 해제' : '저장하기'}`}>
                      <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-ink text-ink' : ''}`} />
                      {existingScrap ? '저장 해제' : '저장'}
                    </button>
                  </form>
                  {externalUrl && (
                    <Link href={externalUrl} target="_blank" className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink">
                      <ExternalLink className="h-4 w-4" />
                      원문
                    </Link>
                  )}
                  <ShareButton title={item.title} url={externalUrl} />
                </div>
                <div className="p-3">
                  <ViewTracker itemType="news" itemId={item.id} />
                  <ContentEngagement itemType="news" itemId={item.id} returnTo={`/news/${item.id}`} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} />
                </div>
              </div>

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

              {item.image_url && (
                <div className="relative my-5 h-56 overflow-hidden border border-outline-soft bg-ink text-white">
                  <Image src={item.image_url} alt={item.title} fill sizes="980px" className="object-cover" />
                </div>
              )}

              {item.content ? (
                <MarkdownContent content={item.content} />
              ) : (
                <section className="mt-5 border border-outline-soft bg-white p-5 md:p-6">
                  <div className="mb-3 text-sm font-black uppercase text-ink">Preprocessed Briefing</div>
                  <p className="text-sm leading-7 text-muted">
                    이 항목은 RSS 수집 후 뉴스레터 추천용 메타데이터로 전처리된 상태입니다. 긴 Deep Dive 글이나 Build Idea 글은 관리자 콘솔의 통합 글 생성 단계에서 별도로 생성됩니다.
                  </p>
                  {summary && <p className="mt-4 border border-outline-soft bg-surface p-4 text-sm leading-7 text-ink">{summary}</p>}
                </section>
              )}

              <section className="mt-5 border border-outline-soft bg-white p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-ink">
                  <Lightbulb className="h-4 w-4" />
                  Next Actions
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: item.project_idea ? '이 아이디어 평가하기' : '프로젝트 아이디어 만들기', href: `/ideas?idea=${encodeURIComponent(projectPrompt)}` },
                    { label: item.related_skills?.[0] ? `${item.related_skills[0]} 프로젝트 보기` : '관련 프로젝트 보기', href: '/projects' },
                    { label: item.category ? `${item.category} 더 읽기` : '아티클 더 보기', href: categoryQuery },
                  ].map((action) => (
                    <Link key={action.label} href={action.href} className="flex items-center justify-between gap-3 border border-outline-soft bg-surface p-3 text-sm font-bold text-ink hover:border-ink">
                      {action.label}
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <aside className="w-full lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
              <ArticleAssistant title={item.title} summary={item.beginner_summary ?? item.summary} content={item.content} />
              <RelatedPapersToggle links={relatedPapers} />
            </aside>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
