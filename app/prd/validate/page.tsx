import type { Metadata } from 'next';
import Header from '@/components/Header';
import IdeaCheckWorkspace from '@/components/IdeaCheckWorkspace';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: '아이디어 검증' };

/** Idea validation, opened from the /prd box with "아이디어 검증" picked. */
export default async function ValidatePage({ searchParams }: { searchParams: Promise<{ idea?: string | string[] }> }) {
  const [{ idea }, supabase] = await Promise.all([searchParams, createClient()]);
  const user = supabase ? await getCurrentUser() : null;
  const initialIdea = (typeof idea === 'string' ? idea : '').trim().slice(0, 300);
  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <IdeaCheckWorkspace key={initialIdea} initialIdea={initialIdea} signedIn={Boolean(user)} />
      </main>
    </>
  );
}
