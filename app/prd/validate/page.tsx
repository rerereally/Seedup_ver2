import type { Metadata } from 'next';
import Header from '@/components/Header';
import IdeaCheckWorkspace from '@/components/IdeaCheckWorkspace';
import { prdPolicy } from '@/lib/db/server';
import { prdModels } from '@/lib/opportunities/models';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: '아이디어 검증' };

/** Idea validation, opened from the /prd box with "아이디어 검증" picked. A saved check opens with ?evaluation=id. */
export default async function ValidatePage({ searchParams }: { searchParams: Promise<{ idea?: string; evaluation?: string }> }) {
  const [{ idea, evaluation }, supabase] = await Promise.all([searchParams, createClient()]);
  const user = supabase ? await getCurrentUser() : null;
  const evaluationId = evaluation && /^[\w-]{1,64}$/.test(evaluation) ? evaluation : null;
  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <IdeaCheckWorkspace initialIdea={(idea ?? '').trim().slice(0, 300)} evaluationId={evaluationId} signedIn={Boolean(user)} models={user ? prdModels(await prdPolicy()) : []} />
      </main>
    </>
  );
}
