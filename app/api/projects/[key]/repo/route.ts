// Links an analyzed GitHub repository (`owner/repo`) to one of the signed-in user's own supervisor projects.
import { parseGitHubRepo, userProjectRepo } from '@/lib/db/supervisor-projects';
import { getCurrentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Context = { params: Promise<{ key: string }> };

export async function PUT(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { repo?: unknown } | null;
  const repo = parseGitHubRepo(body?.repo);
  if (!repo) return Response.json({ error: '저장소는 owner/repo 형식이어야 합니다.' }, { status: 400 });

  const raw = (await context.params).key;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* malformed percent stays as is and fails key lookup */ }

  try {
    const project = await userProjectRepo(user.id, decoded, repo);
    if (project === 'unavailable') return Response.json({ error: '지금은 저장소를 연결할 수 없습니다.' }, { status: 503 });
    if (!project) return Response.json({ error: '프로젝트를 찾지 못했습니다.' }, { status: 404 });
    return Response.json({ ok: true, projectKey: project.projectKey, repo: project.repo });
  } catch (error) {
    console.error('Project repo link failed', (error as { message?: string }).message);
    return Response.json({ error: '저장소를 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
  }
}
