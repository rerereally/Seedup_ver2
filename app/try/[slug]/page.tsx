import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import { publicPage } from '@/lib/db/idea-pages';
import WaitlistForm from './WaitlistForm';

async function getPage(slug: string) {
  if (!/^[a-z0-9]{10}$/.test(slug)) return null;
  return publicPage(slug);
}

// Pages are written by people, so search engines are asked not to index them; the builder shares the link.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPage((await params).slug);
  return { title: page?.headline ?? '아이디어', robots: { index: false, follow: false } };
}

/** One idea's public page with a waitlist, made with Seedup's validation kit. */
export default async function IdeaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 py-16 sm:px-6">
      <div className="grow">
        <h1 className="text-[clamp(30px,5vw,44px)] font-bold leading-tight tracking-[-0.03em] text-ink">{page.headline}</h1>
        {page.pitch && <p className="mt-5 whitespace-pre-line text-[17px] leading-8 text-tertiary">{page.pitch}</p>}
        <div className="mt-10"><WaitlistForm slug={slug} /></div>
      </div>
      <p className="mt-16 flex items-center gap-2 text-[13px] text-muted">
        <Link href="/" className="inline-flex items-center gap-1.5 font-semibold text-ink"><Logo />Seedup</Link>
        <span>으로 만든 아이디어 소개 페이지입니다.</span>
      </p>
    </main>
  );
}
