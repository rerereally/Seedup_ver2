import type { Metadata } from 'next';
import { deleteScrap } from '@/app/actions/scraps';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import WorkShell from '@/components/WorkShell';
import { getContentHref } from '@/lib/content-targets';
import { getScrap } from '@/lib/data';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '북마크 상세',
};

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
      <WorkShell>
        <article className="max-w-[760px]">
          <Link href="/scrap" className="inline-flex min-h-9 items-center text-sm text-muted hover:text-ink">‹ 북마크</Link>
          <p className="mt-4 text-sm text-muted">{[TYPE_LABELS[item.item_type] ?? item.item_type, item.tag, `${savedAt} 저장`].filter(Boolean).join(', ')}</p>
          <h1 className="page-intro-title mt-2">{item.title}</h1>
          {item.description && <p className="mt-5 text-[17px] leading-8 text-tertiary">{item.description}</p>}

          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-outline-soft pt-6">
            <Link href={contentHref} className="btn">원본 열기</Link>
            <Link href={`/ideas?idea=${encodeURIComponent(ideaPrompt)}`} className="btn-quiet">아이디어 검증</Link>
            <form action={deleteScrap} className="ml-auto">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="inline-flex h-10 items-center px-2 text-sm text-muted hover:text-red-700">북마크에서 제거</button>
            </form>
          </div>
        </article>
      </WorkShell>
      <Footer />
    </>
  );
}
