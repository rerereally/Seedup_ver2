import { redirect } from 'next/navigation';

/** Repo analysis moved into the /prd work screens; old links land on the start box with it picked. */
export default async function SeedsPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const { user } = await searchParams;
  redirect(user ? `/prd/repo?user=${encodeURIComponent(user)}` : '/prd?mode=repo');
}
