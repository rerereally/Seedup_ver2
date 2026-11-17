import { redirect } from 'next/navigation';

/** The list of problems now sits under the weekly issue. Old links and saved searches land on the same list there. */
export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; all?: string }> }) {
  const { stage, q, all } = await searchParams;
  const params = new URLSearchParams();
  if (stage) params.set('stage', stage);
  if (q) params.set('q', q);
  if (all) params.set('all', all);
  const search = params.toString();
  redirect(`/newsletter-preview${search ? `?${search}` : ''}#problems`);
}
