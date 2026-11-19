import type { Metadata } from 'next';
import Header from '@/components/Header';
import RepoWorkspace from '@/components/RepoWorkspace';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: '레포 분석' };

/** Repo analysis, opened from the /prd box with "레포 분석" picked: ?user=<GitHub login>. */
export default async function RepoPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const [{ user: login }, supabase] = await Promise.all([searchParams, createClient()]);
  const user = supabase ? await getCurrentUser() : null;
  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <RepoWorkspace initialLogin={(login ?? '').trim().slice(0, 80)} signedIn={Boolean(user)} />
      </main>
    </>
  );
}
