// The locked goal of one project (docs/supervisor-plan.md 3-1). GET returns the current ProjectGoal, PUT locks a
// new version. Signed in only; a key the user may not use answers 404 like a missing one.
import { readGoalInput, userProjectGoals } from '@/lib/db/project-goals';
import { getCurrentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Context = { params: Promise<{ key: string }> };

const unavailable = () => Response.json({ error: '지금은 목표를 불러올 수 없습니다.' }, { status: 503 });

async function open(context: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const raw = (await context.params).key;
  let key = raw;
  try { key = decodeURIComponent(raw); } catch { /* a stray % stays as is and fails the key check */ }
  const project = await userProjectGoals(user.id, key);
  if (project === 'unavailable') return unavailable();
  return project ?? Response.json({ error: '프로젝트를 찾지 못했습니다.' }, { status: 404 });
}

export async function GET(_request: Request, context: Context) {
  const project = await open(context);
  if (project instanceof Response) return project;
  try {
    const goal = await project.current();
    return goal ? Response.json(goal) : Response.json({ error: '아직 잠긴 목표가 없습니다.' }, { status: 404 });
  } catch (error) {
    console.error('Project goal read failed', (error as { message?: string }).message);
    return unavailable();
  }
}

export async function PUT(request: Request, context: Context) {
  const project = await open(context);
  if (project instanceof Response) return project;
  const input = readGoalInput(await request.json().catch(() => null));
  if ('error' in input) return Response.json({ error: input.error }, { status: 400 });
  try {
    const goal = await project.lock(input.goal);
    if (goal === 'reason-required') {
      return Response.json({ error: '목표를 바꾸려면 바꾸는 이유가 필요합니다.', code: 'change_reason_required' }, { status: 400 });
    }
    if (goal === 'invalid-feature-ids') {
      return Response.json({ error: '최신 PRD를 저장한 뒤 연결할 기능을 다시 확인해 주세요.' }, { status: 400 });
    }
    return Response.json(goal);
  } catch (error) {
    console.error('Project goal lock failed', (error as { message?: string }).message);
    return Response.json({ error: '목표를 잠그지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
  }
}
