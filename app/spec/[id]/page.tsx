import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <header>
          <p className="label">Seedup 근거 추적 PRD</p>
          <h1 className="page-intro-title mt-2">{spec.title}</h1>
          <p className="page-intro-description">
            개발자 증언 {Array.isArray(spec.evidence_ids) ? spec.evidence_ids.length : 0}건을 원문과 대조해 만든 PRD입니다. 모든 요구사항은 아래 근거 원문 번호(E-n)로 이어집니다.
          </p>
        </header>
        {/* Plain text on purpose: the markdown is user-saved content, so it is never rendered as HTML. */}
        <pre className="card overflow-x-auto whitespace-pre-wrap break-words p-5 font-sans text-[15px] leading-7 text-ink md:p-7">{spec.prd_markdown}</pre>
        <div className="flex flex-wrap gap-2">
          {spec.opportunity_slug && <Link href={`/opportunities/${spec.opportunity_slug}`} className="btn">이 기회의 증언 보기</Link>}
          <Link href="/opportunities" className="btn-quiet">다른 기회 살펴보기</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
