import { signupsCsv } from '@/lib/idea-pages';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** The waitlist of one of the owner's pages as CSV. Row-level security limits it to the owner. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const { data: page } = await supabase.from('idea_pages').select('id').eq('slug', slug).eq('user_id', user.id).maybeSingle();
  if (!page) return NextResponse.json({ error: '페이지를 찾지 못했습니다.' }, { status: 404 });
  const { data } = await supabase.from('waitlist_signups').select('email,created_at').eq('page_id', page.id).order('created_at', { ascending: true });
  return new NextResponse(signupsCsv((data ?? []) as Array<{ email: string; created_at: string }>), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="waitlist-${slug}.csv"`, 'cache-control': 'no-store' },
  });
}
