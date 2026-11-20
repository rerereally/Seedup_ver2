import type { Metadata } from 'next';
import Header from '@/components/Header';
import IdeaCheckWorkspace from '@/components/IdeaCheckWorkspace';
import { evaluationById, recentEvaluations } from '@/lib/db/evaluations';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: '아이디어 검증' };

/** Idea validation, opened from the /prd box with "아이디어 검증" picked. A saved check opens with ?evaluation=id. */
export default async function ValidatePage({ searchParams }: { searchParams: Promise<{ idea?: string | string[]; evaluation?: string | string[] }> }) {
  const [{ idea, evaluation }, supabase] = await Promise.all([searchParams, createClient()]);
  const user = supabase ? await getCurrentUser() : null;
  const evaluationId = typeof evaluation === 'string' && /^[\w-]{1,64}$/.test(evaluation) ? evaluation : null;
  const [previous, recent] = supabase && user ? await Promise.all([
    evaluationId ? evaluationById(supabase, evaluationId).then(({ data }) => data) : null,
    recentEvaluations(supabase, user.id, 4).then(({ data }) => (data ?? []).map(({ id, idea_text, score }) => ({ id, idea_text, score }))),
  ]) : [null, []];
  const initialIdea = (previous?.idea_text ?? (typeof idea === 'string' ? idea : '')).trim().slice(0, 300);
  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <IdeaCheckWorkspace key={previous?.id ?? initialIdea} initialIdea={initialIdea} previous={previous} recent={recent} signedIn={Boolean(user)} />
      </main>
    </>
  );
}
