import { dismissUnlinkedCommit } from '@/lib/opportunities/feature-commits';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return Response.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { data, error } = await dismissUnlinkedCommit(supabase, user.id, id);
  if (error) {
    console.error('Commit dismissal failed', error.message);
    return Response.json({ ok: false }, { status: 503 });
  }
  if (!data) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true });
}
