import { deleteScrap } from '@/app/actions/scraps';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getContentHref } from '@/lib/content-targets';
import { getScrap } from '@/lib/data';
import { ArrowLeft, ArrowRight, Bookmark, Lightbulb, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const TYPE_LABELS: Record<string, string> = {
  news: '아티클',
  paper: '논문',
  project: '프로젝트',
  ai_product: 'AI 제품',
  github: '오픈소스',
  idea: '아이디어',
  trend: '트렌드',
};

export default async function ScrapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getScrap(id);

  if (!item) notFound();
  const contentHref = getContentHref(item.item_type, item.item_id);
  const savedAt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(item.created_at));
  const ideaPrompt = `${item.title}를 바탕으로 만들 수 있는 프로젝트 아이디어를 평가해줘.`;

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-10">
          <Link href="/scrap" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            내 보관함으로
          </Link>

          <section className="border border-outline-soft bg-white p-5 md:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              <span className="inline-flex items-center gap-1 border border-outline-soft bg-surface px-2 py-1 text-ink">
                <Bookmark className="h-3.5 w-3.5 fill-ink" />
                SAVED_ITEM
              </span>
              <span>{TYPE_LABELS[item.item_type] ?? item.item_type}</span>
              {item.tag && <span>{item.tag}</span>}
            </div>

            <h1 className="text-3xl font-black leading-tight text-ink md:text-5xl">{item.title}</h1>
            {item.description && <p className="mt-5 text-base leading-8 text-muted">{item.description}</p>}
          </section>

          <section className="mt-4 border border-outline-soft bg-white p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-outline-soft bg-surface p-4">
                <p className="text-xs font-bold uppercase text-muted">저장일</p>
                <p className="mt-2 text-sm font-bold leading-6 text-ink">{savedAt}</p>
              </div>
              <div className="border border-outline-soft bg-surface p-4">
                <p className="text-xs font-bold uppercase text-muted">다음 행동</p>
                <p className="mt-2 text-sm font-bold leading-6 text-ink">원 콘텐츠를 열거나 프로젝트 후보로 이어보세요.</p>
              </div>
            </div>
          </section>

          <section className="mt-4 border border-outline-soft bg-white p-5">
            <div className="mb-4 text-sm font-black uppercase text-ink">Actions</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link href={contentHref} className="flex items-center justify-between gap-3 bg-ink p-3 text-sm font-bold text-white">
                원 콘텐츠로 이동
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`/ideas?idea=${encodeURIComponent(ideaPrompt)}`} className="flex items-center justify-between gap-3 border border-outline-soft bg-surface p-3 text-sm font-bold text-ink hover:border-ink">
                아이디어 평가
                <Lightbulb className="h-4 w-4" />
              </Link>
              <form action={deleteScrap}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="flex w-full items-center justify-between gap-3 border border-outline-soft bg-white p-3 text-sm font-bold text-muted hover:border-ink hover:text-ink">
                  보관함에서 제거
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
