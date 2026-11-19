import { prdPolicy } from '@/lib/db/server';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import IdeaWorkspace from '@/components/IdeaWorkspace';
import type { PoolItem } from '@/components/IdeaWorkspace';
import { getLang } from '@/lib/i18n-server';
import { getOpportunities } from '@/lib/opportunities/data';
import { prdModels } from '@/lib/opportunities/models';
import { localizedOpportunity } from '@/lib/opportunities/types';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: '아이디어로 PRD 만들기' };

const QUOTES_PER_PROBLEM = 4;

/** The idea workspace: a short planning chat on the left, the PRD filling in on the right. */
export default async function NewPrdPage({ searchParams }: { searchParams: Promise<{ idea?: string }> }) {
  const [{ idea }, lang, { opportunities }, supabase] = await Promise.all([searchParams, getLang(), getOpportunities(), createClient()]);
  const user = supabase ? await getCurrentUser() : null;

  // Only what the chat needs to match quotes in the browser: names, keywords and a few quotes per problem.
  const pool: PoolItem[] = opportunities.map((item) => {
    const text = localizedOpportunity(item, lang);
    return {
      slug: item.slug,
      name: text.name,
      problem: text.problem,
      keywords: item.keywords,
      qualified: item.qualified,
      quotes: item.evidence.slice(0, QUOTES_PER_PROBLEM).map((row) => ({ id: row.id, platform: row.platform, quote: row.quote, quoteKo: row.quoteKo, url: row.url })),
    };
  });

  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <IdeaWorkspace pool={pool} signedIn={Boolean(user)} initialIdea={(idea ?? '').trim().slice(0, 300)} models={prdModels(await prdPolicy())} />
      </main>
    </>
  );
}
