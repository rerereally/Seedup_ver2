import { deleteScrap } from '@/app/actions/scraps';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getScrap } from '@/lib/data';
import { getContentHref } from '@/lib/content-targets';
import { ArrowLeft, ArrowRight, Bookmark, Trash2 } from 'lucide-react';
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

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-[860px] px-4 py-12 md:px-10 md:py-16">
          <Link href="/scrap" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            내 보관함으로
          </Link>

          <section className="rounded-xl border border-outline-soft bg-white p-6 shadow-sm md:p-8">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                <Bookmark className="h-3.5 w-3.5 fill-brand-primary" />
                저장한 콘텐츠
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">{TYPE_LABELS[item.item_type] ?? item.item_type}</span>
              {item.tag && <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">{item.tag}</span>}
            </div>

            <h1 className="text-3xl font-bold leading-tight text-ink md:text-4xl">{item.title}</h1>
            {item.description && <p className="mt-5 text-base leading-8 text-muted">{item.description}</p>}

            <dl className="mt-8 grid gap-3 rounded-lg border border-outline-soft bg-surface-lowest p-4 text-sm md:grid-cols-2">
              <div>
                <dt className="font-bold text-ink">저장일</dt>
                <dd className="mt-1 text-muted">{savedAt}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">다음 행동</dt>
                <dd className="mt-1 text-muted">원 콘텐츠를 열어 읽거나 프로젝트 후보로 이어보세요.</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col gap-3 border-t border-outline-soft pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Link href={contentHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                원 콘텐츠로 이동
                <ArrowRight className="h-4 w-4" />
              </Link>
              <form action={deleteScrap}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-outline-soft bg-white px-5 text-sm font-semibold text-muted transition-colors hover:border-red-200 hover:text-red-600 sm:w-auto">
                  <Trash2 className="h-4 w-4" />
                  보관함에서 제거
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
