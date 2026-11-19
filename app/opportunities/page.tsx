import { redirect } from 'next/navigation';
import { firstQueryValue } from '@/lib/opportunities/fit';

/** The list of problems now sits under the weekly issue. Old links and saved searches land on the same list there. */
export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const key of ['stage', 'size', 'q', 'all', 'fit', 'stack', 'time']) {
    const value = firstQueryValue(query[key]);
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  redirect(`/newsletter-preview${search ? `?${search}` : ''}#problems`);
}
