import { saveScrap } from '@/app/actions/scraps';
import ArticleAssistant from '@/components/ArticleAssistant';
import ContentEngagement from '@/components/ContentEngagement';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MarkdownContent from '@/components/MarkdownContent';
import RelatedPapersToggle from '@/components/RelatedPapersToggle';
import ShareButton from '@/components/ShareButton';
import { getExistingScrap, getNewsItem, getRelatedPapersForNews } from '@/lib/data';
import { incrementContentView } from '@/lib/engagement';
import { ArrowLeft, Bookmark, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, existingScrap, relatedPapers] = await Promise.all([
    getNewsItem(id),
    getExistingScrap('news', id),
    getRelatedPapersForNews(id),
  ]);

  if (!item) notFound();
  await incrementContentView('news', item.id);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-[1180px] px-4 py-7 md:px-8 md:py-9">
          <Link href="/news" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            아티클 목록으로
          </Link>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-primary">
                {item.category}
                <span className="text-muted">•</span>
                <span className="text-muted">{item.source}</span>
              </div>
              <h1 className="max-w-4xl text-3xl font-black leading-tight text-ink md:text-[42px]">{item.title}</h1>
              {item.summary && <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">{item.summary}</p>}

              <div className="mt-6 flex flex-wrap gap-2">
                <form action={saveScrap}>
                  <input type="hidden" name="item_type" value="news" />
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="title" value={item.title} />
                  <input type="hidden" name="description" value={item.summary ?? item.beginner_summary ?? ''} />
                  <input type="hidden" name="tag" value={item.category ?? 'news'} />
                  <input type="hidden" name="return_to" value={`/news/${item.id}`} />
                  <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-soft bg-white px-3 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary" aria-label={`${item.title} ${existingScrap ? '저장 해제' : '저장하기'}`}>
                    <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-brand-primary text-brand-primary' : ''}`} />
                    {existingScrap ? '저장 해제' : '저장'}
                  </button>
                </form>
                {item.original_url && (
                  <Link href={item.original_url} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-soft bg-white px-3 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                    <ExternalLink className="h-4 w-4" />
                    원문
                  </Link>
                )}
                <ShareButton title={item.title} url={item.original_url} />
                <ContentEngagement itemType="news" itemId={item.id} returnTo={`/news/${item.id}`} views={Number(item.view_count ?? 0) + 1} likes={item.like_count} dislikes={item.dislike_count} />
              </div>

              {item.image_url && (
                <div className="relative my-7 h-64 overflow-hidden rounded-lg border border-outline-soft bg-[#191c1d] text-white">
                  <Image src={item.image_url} alt={item.title} fill sizes="980px" className="object-cover" />
                </div>
              )}

              {item.content && <MarkdownContent content={item.content} />}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <ArticleAssistant title={item.title} summary={item.beginner_summary ?? item.summary} content={item.content} projectIdea={item.project_idea} />
              <RelatedPapersToggle links={relatedPapers} />
            </aside>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
