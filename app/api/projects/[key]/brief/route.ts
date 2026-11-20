// Saves what the web planning chat learned into the project's memory, the way validate_idea does for MCP.
import { saveProjectBrief } from '@/lib/db/project-brief';
import { getCurrentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Context = { params: Promise<{ key: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const raw = (await context.params).key;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* malformed percent stays as is and fails key lookup */ }

  try {
    const saved = await saveProjectBrief(user.id, decoded, await request.json().catch(() => null));
    if (saved === 'unavailable') return Response.json({ error: '지금은 저장할 수 없습니다.' }, { status: 503 });
    if (!saved) return Response.json({ error: '프로젝트를 찾지 못했습니다.' }, { status: 404 });
    return Response.json({ ok: true, added: saved.added });
  } catch (error) {
    console.error('Project brief save failed', (error as { message?: string }).message);
    return Response.json({ error: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
  }
}
