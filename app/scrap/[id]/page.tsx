import { deleteScrap } from '@/app/actions/scraps';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getScrap } from '@/lib/data';
import { ArrowLeft, Bookmark, Lightbulb, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ScrapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getScrap(id);

  if (!item) notFound();

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-[900px] px-4 py-12 md:px-10 md:py-16">
          <Link href="/scrap" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            스크랩북으로
          </Link>
          <section className="rounded-xl border border-outline-soft bg-white p-6 md:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
              <Bookmark className="h-4 w-4 fill-brand-primary" />
              Saved Item
            </div>
            <h1 className="text-3xl font-bold leading-tight text-ink">{item.title}</h1>
            {item.description && <p className="mt-4 leading-7 text-muted">{item.description}</p>}
            {item.tag && (
              <div className="mt-8 rounded-lg border border-outline-soft bg-surface p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-tertiary">
                  <Lightbulb className="h-4 w-4" />
                  연결 태그
                </div>
                <p className="text-sm leading-6 text-muted">{item.tag}</p>
              </div>
            )}
            <form action={deleteScrap} className="mt-8 border-t border-outline-soft pt-6">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
                스크랩 삭제
              </button>
            </form>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
