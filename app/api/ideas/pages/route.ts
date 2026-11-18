import { MAX_PAGES_PER_USER, newPageSlug, pageCopy } from '@/lib/idea-pages';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** The owner's idea pages with how many people joined each waitlist. */
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const { data, error } = await supabase.from('idea_pages').select('id,slug,idea,headline,created_at,waitlist_signups(count)').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: '페이지를 읽지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ pages: (data ?? []).map(({ waitlist_signups: signups, ...row }) => ({ ...row, signups: Number((signups as Array<{ count: number }> | null)?.[0]?.count ?? 0) })) });
}

/** Makes a public page for one idea with a waitlist. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 만들 수 있습니다.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const copy = pageCopy(typeof body?.idea === 'string' ? body.idea : '', body?.headline, body?.pitch);
  if (copy.idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  const { count } = await supabase.from('idea_pages').select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= MAX_PAGES_PER_USER) return NextResponse.json({ error: `소개 페이지는 ${MAX_PAGES_PER_USER}개까지 만들 수 있습니다.` }, { status: 429 });
  const { data, error } = await supabase.from('idea_pages').insert({ user_id: user.id, slug: newPageSlug(), ...copy }).select('id,slug').single();
  if (error) {
    console.error('idea page insert failed', error.message);
    return NextResponse.json({ error: '페이지를 만들지 못했습니다.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...data, path: `/try/${data.slug}` });
}

/** Deletes a page and, with it, every address on its waitlist. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '대상을 찾지 못했습니다.' }, { status: 400 });
  const { error } = await supabase.from('idea_pages').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: '지우지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
