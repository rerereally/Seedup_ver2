import { addWatch, listWatches, removeWatch } from '@/lib/db/watches';
import { MAX_WATCHES_PER_USER } from '@/lib/opportunities/watch';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** The ideas this person watches. */
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const { data, error } = await listWatches(supabase, user.id);
  if (error) return NextResponse.json({ error: '지켜보는 아이디어를 읽지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ watches: data ?? [] });
}

/** Starts watching one idea. The weekly check mails new quotes and new rival tools from the second check on. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 지켜볼 수 있습니다.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  const added = await addWatch(supabase, user.id, idea);
  if (added === 'limit') return NextResponse.json({ error: `아이디어는 ${MAX_WATCHES_PER_USER}개까지 지켜볼 수 있습니다.` }, { status: 429 });
  if (added === 'error') return NextResponse.json({ error: '지켜보기를 시작하지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ ok: true, id: added.id });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '대상을 찾지 못했습니다.' }, { status: 400 });
  const { error } = await removeWatch(supabase, user.id, id);
  if (error) return NextResponse.json({ error: '지우지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
