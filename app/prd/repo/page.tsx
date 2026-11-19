import type { Metadata } from 'next';
import Header from '@/components/Header';
import RepoWorkspace from '@/components/RepoWorkspace';
import { getLang } from '@/lib/i18n-server';
import { getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: '레포 분석' };

/** Repo analysis, opened from the /prd box with "레포 분석" picked: ?user=<GitHub login>. */
export default async function RepoPage({ searchParams }: { searchParams: Promise<{ user?: string | string[]; repo?: string | string[] }> }) {
  const [{ user: login, repo }, user, lang] = await Promise.all([searchParams, getCurrentUser(), getLang()]);
  const initialLogin = typeof login === 'string' ? login.trim().slice(0, 80) : '';
  const initialRepo = typeof repo === 'string' ? repo.slice(0, 100) : null;
  return (
    <>
      <Header />
      <main id="main-content" className="grow">
        <RepoWorkspace key={user?.id} initialLogin={initialLogin} initialRepo={initialRepo} userId={user?.id} lang={lang} />
      </main>
    </>
  );
}
