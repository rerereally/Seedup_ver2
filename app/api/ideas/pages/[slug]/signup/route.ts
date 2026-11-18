import { normalizeEmail } from '@/lib/idea-pages';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_SIGNUPS_PER_PAGE = 2000;

/** A visitor joins one idea's waitlist. The address goes only to the page owner. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]{10}$/.test(slug)) return NextResponse.json({ error: '페이지를 찾지 못했습니다.' }, { status: 404 });
  const body = await request.json().catch(() => null);
  // A hidden field people never fill: bots that fill every field are dropped without telling them.
  if (body?.website) return NextResponse.json({ ok: true });
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 });
  if (body?.consent !== true) return NextResponse.json({ error: '안내에 동의해 주세요.' }, { status: 400 });
  const service = createAdminClient();
  if (!service) return NextResponse.json({ error: '지금은 받을 수 없습니다.' }, { status: 503 });
  const { data: page } = await service.from('idea_pages').select('id').eq('slug', slug).maybeSingle();
  if (!page) return NextResponse.json({ error: '페이지를 찾지 못했습니다.' }, { status: 404 });
  const { count } = await service.from('waitlist_signups').select('id', { count: 'exact', head: true }).eq('page_id', page.id);
  if ((count ?? 0) >= MAX_SIGNUPS_PER_PAGE) return NextResponse.json({ error: '신청이 마감되었습니다.' }, { status: 429 });
  const { error } = await service.from('waitlist_signups').upsert({ page_id: page.id, email }, { onConflict: 'page_id,email', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: '신청하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
