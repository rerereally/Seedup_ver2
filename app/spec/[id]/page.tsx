import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Logo from '@/components/Logo';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SpecActions from './SpecActions';

export const metadata: Metadata = {
  title: '공유된 PRD',
  robots: { index: false, follow: false },
};

/** A PRD its owner chose to share. Read with the service role, and only when the owner turned sharing on. */
async function getSharedSpec(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const service = createAdminClient();
  if (!service) return null;
  const { data } = await service
    .from('evidence_dossiers')
    .select('title,prd_markdown,evidence_ids,opportunity_slug,updated_at')
    .eq('id', id)
    .eq('shared', true)
    .maybeSingle();
  return data?.prd_markdown ? data : null;
}

export default async function SharedSpecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spec = await getSharedSpec(id);
  if (!spec) notFound();
  const quotes = Array.isArray(spec.evidence_ids) ? spec.evidence_ids.length : 0;

  return (
    <>
      {/* A visitor from a shared link gets a slim bar, not the app menu: one way in, to make their own. */}
      <header className="sticky top-0 z-50 border-b border-outline-soft bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-4 px-5 sm:px-6 md:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[19px] font-bold tracking-tight text-ink"><Logo />Seedup</Link>
          <span className="hidden text-sm text-muted sm:inline">공유된 PRD, 로그인 없이 보는 중</span>
          <Link href="/opportunities" className="btn ml-auto bg-ink">내 PRD 만들기</Link>
        </div>
      </header>
      <main id="main-content" className="page-shell grow">
        <nav className="text-sm text-muted" aria-label="위치">
          <Link href="/opportunities" className="hover:text-ink">기회</Link>
          {spec.opportunity_slug && <> <span aria-hidden="true">›</span> <Link href={`/opportunities/${spec.opportunity_slug}`} className="hover:text-ink">이 PRD의 기회</Link></>}
        </nav>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-outline-soft pb-6">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[clamp(26px,3vw,34px)] font-bold leading-tight tracking-tight">{spec.title} PRD</h1>
            <p className="text-sm text-muted"><span className="font-medium text-seed">개발자 원문 {quotes}건</span>, {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(spec.updated_at))}</p>
          </div>
          <SpecActions markdown={spec.prd_markdown} />
        </div>

        <div className="mt-8 page-split">
          {/* Plain text on purpose: the markdown is user-saved content, so it is never rendered as HTML. */}
          <pre className="min-w-0 whitespace-pre-wrap break-words font-sans text-[15px] leading-8 text-ink">{spec.prd_markdown}</pre>
          <aside className="page-side">
            <h2 className="text-[15px] font-semibold">이 PRD의 근거</h2>
            <p className="mt-2 text-sm leading-7 text-tertiary">개발자 원문 {quotes}건을 원문과 글자 단위로 대조해 만들었습니다. 모든 요구사항은 근거 원문 번호(E-n)로 이어지고, 원문이 없는 줄은 가설로 표시했습니다.</p>
            {spec.opportunity_slug && <Link href={`/opportunities/${spec.opportunity_slug}`} className="link-seed mt-3">이 기회의 원문 보기</Link>}
          </aside>
        </div>
        <p className="mt-12 text-[13px] text-muted">Seedup으로 만들었습니다, <Link href="/opportunities" className="text-seed underline-offset-4 hover:underline">다른 기회 살펴보기</Link></p>
      </main>
      <Footer />
    </>
  );
}
