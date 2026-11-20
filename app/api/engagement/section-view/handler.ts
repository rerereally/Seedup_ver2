import { sectionOf, type Section } from '@/lib/sections';
import { clientOf, rateLimited } from '@/lib/throttle';

type Dependencies = {
  getUserId: () => Promise<string | null>;
  record: (section: Section, userId: string | null) => Promise<void>;
};

export async function handleSectionView(request: Request, { getUserId, record }: Dependencies) {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return new Response(null, { status: 415 });
  }
  const body = await request.json().catch(() => null);
  const section = typeof body?.pathname === 'string' && body.pathname.length <= 2048 ? sectionOf(body.pathname) : null;
  if (!section || 'user_id' in body || 'userId' in body || 'signed_in' in body) {
    return new Response(null, { status: 400 });
  }
  if (await rateLimited(`section-view:${clientOf(request)}`, 60)) {
    return new Response(null, { status: 429 });
  }

  try {
    await record(section, await getUserId());
  } catch {
    console.error('section view not recorded');
  }
  return new Response(null, { status: 204 });
}
