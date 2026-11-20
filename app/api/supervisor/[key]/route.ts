import { supervisorDetail } from '@/components/supervisor/data';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const [client, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!client || !user) return Response.json({ error: '로그인이 필요합니다. / Sign in required.' }, { status: 401, headers });
  try {
    const project = await supervisorDetail(client, user.id, (await context.params).key);
    return project ? Response.json(project, { headers })
      : Response.json({ error: '프로젝트를 찾지 못했습니다. / Project not found.' }, { status: 404, headers });
  } catch {
    return Response.json({ error: '프로젝트를 불러오지 못했습니다. / Project unavailable.' }, { status: 503, headers });
  }
}
