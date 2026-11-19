import Link from 'next/link';
import ArticleImage from '@/components/ArticleImage';
import ContentEngagement from '@/components/ContentEngagement';
import ScrapButton from '@/components/ScrapButton';
import type { ArticleFeedItem } from '@/lib/data';

// The article feed's lead and cards, shared by /news and the home banner.

const CATEGORY_LABELS: Record<string, string> = {
  'AI Agent': 'AI 에이전트',
  Frontend: '프론트엔드',
  Backend: '백엔드',
  DevTools: '개발 도구',
  Product: '제품',
  Trend: '트렌드',
  Other: '기타',
};

const NEWSLETTER_SECTION_LABELS: Record<string, string> = {
  daily_briefing: '핵심 뉴스',
  ai_product_radar: 'AI 제품',
  github_project_pick: 'GitHub 추천',
  build_idea: '만들어 볼 것',
  career_tip: '커리어',
  deep_dive: '깊이 읽기',
  paper_to_project: '논문→프로젝트',
};

// Cut in code rather than with line-clamp: clamped lines stay in the layout and sit under the row below.
export const clipText = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function categoryLabel(value: string | null) {
  if (!value) return '글';
  return CATEGORY_LABELS[value] ?? value;
}

export function itemHref(item: ArticleFeedItem) {
  return item.type === 'paper' ? `/papers/${item.id}` : `/news/${item.id}`;
}

function articleMeta(item: ArticleFeedItem) {
  const section = item.newsletter_section ? NEWSLETTER_SECTION_LABELS[item.newsletter_section] ?? item.newsletter_section : null;
  return { kind: item.type === 'paper' ? '논문 리뷰' : categoryLabel(item.category), section, source: item.source ?? 'Seedup', date: formatDate(item.published_at) };
}

/** The first article on a page: its picture beside it when the source has one, and the save and ask actions. */
export function ArticleLead({ item, isScrapped, returnTo, reason }: { item: ArticleFeedItem; isScrapped: boolean; returnTo: string; reason?: string }) {
  const itemType = item.type === 'paper' ? 'paper' : 'news';
  const summary = item.short_summary ?? item.summary ?? item.beginner_summary;
  const meta = articleMeta(item);

  return (
    // Two columns only while the picture is there, so a refused picture leaves a full-width text lead.
    <article className="group grid gap-6 border-b border-outline-soft pb-10 lg:items-center lg:has-[img]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {item.image_url && <ArticleImage src={item.image_url} href={itemHref(item)} className="aspect-[16/10]" />}
      <div className="min-w-0">
        <p className="flex flex-wrap gap-x-3 text-[13px] text-muted">{reason && <span className="font-semibold text-seed">{reason}</span>}<span className="font-semibold text-ink">{meta.kind}</span>{meta.section && <span>{meta.section}</span>}<span>{meta.source}</span><span>{meta.date}</span></p>
        <Link href={itemHref(item)} className="mt-2 block underline-offset-4 hover:underline">
          <h2 className="text-[clamp(22px,2.2vw,28px)] font-bold leading-snug tracking-[-0.025em] text-ink [text-wrap:balance]">{item.title}</h2>
        </Link>
        {summary && <p className="mt-3 text-[16px] leading-7 text-tertiary">{clipText(summary, 150)}</p>}
        {item.why_it_matters && <p className="mt-4 border-l-2 border-outline-strong pl-3 text-[15px] leading-7 text-tertiary"><span className="mr-2 font-semibold text-ink">왜 중요한가</span>{clipText(item.why_it_matters, 110)}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <ScrapButton itemType={itemType} itemId={item.id} title={item.title} description={item.summary ?? item.beginner_summary} tag={item.category ?? 'article'} initialSaved={isScrapped} className="btn-quiet" />
          <Link href={itemHref(item)} className="text-sm text-tertiary underline-offset-4 hover:text-ink hover:underline">이 글에 질문하기</Link>
          <Link href="/opportunities" className="link-seed">관련 기회 보기</Link>
          <span className="ml-auto"><ContentEngagement itemType={itemType} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} /></span>
        </div>
      </div>
    </article>
  );
}

/** Every other article: picture on top when there is one, then what it is, the title and two lines. */
export function ArticleCard({ item, returnTo, reason }: { item: ArticleFeedItem; returnTo: string; reason?: string }) {
  const itemType = item.type === 'paper' ? 'paper' : 'news';
  const summary = item.short_summary ?? item.summary ?? item.beginner_summary;
  const meta = articleMeta(item);

  return (
    <article className="group flex min-w-0 flex-col">
      {item.image_url && <ArticleImage src={item.image_url} href={itemHref(item)} className="mb-4 aspect-[16/9]" />}
      <p className="flex flex-wrap gap-x-3 text-[13px] text-muted">{reason && <span className="font-semibold text-seed">{reason}</span>}<span className="font-semibold text-ink">{meta.kind}</span><span>{meta.source}</span></p>
      <Link href={itemHref(item)} className="mt-1.5 block underline-offset-4 hover:underline">
        <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-ink [text-wrap:balance]">{clipText(item.title, 90)}</h2>
      </Link>
      {summary && <p className="mt-2 text-[14px] leading-6 text-muted">{clipText(summary, item.image_url ? 80 : 150)}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-3 text-[13px] text-muted">
        <time dateTime={item.published_at ?? undefined}>{meta.date}</time>
        <ContentEngagement itemType={itemType} itemId={item.id} returnTo={returnTo} views={item.view_count} likes={item.like_count} dislikes={item.dislike_count} />
      </div>
    </article>
  );
}
