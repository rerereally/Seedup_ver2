import { redirect } from 'next/navigation';

/** Idea validation moved into the /prd work screens; old links and bookmarks land there with what they carried. */
export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ idea?: string }> }) {
  const { idea } = await searchParams;
  const query = new URLSearchParams();
  if (idea) query.set('idea', idea);
  redirect(query.size ? `/prd/validate?${query}` : '/prd?mode=validate');
}
