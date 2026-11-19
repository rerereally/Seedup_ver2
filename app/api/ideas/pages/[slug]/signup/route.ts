import { normalizeEmail } from '@/lib/idea-pages';
import { joinWaitlist } from '@/lib/db/idea-pages';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SIGNUPS_PER_MINUTE = 6;

/** A visitor joins one idea's waitlist. The address goes only to the page owner. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (await rateLimited(`waitlist:${clientOf(request)}`, SIGNUPS_PER_MINUTE)) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const { slug } = await params;
  if (!/^[a-z0-9]{10}$/.test(slug)) return NextResponse.json({ error: '페이지를 찾지 못했습니다.' }, { status: 404 });
  const body = await request.json().catch(() => null);
  // A hidden field people never fill: bots that fill every field are dropped without telling them.
  if (body?.website) return NextResponse.json({ ok: true });
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 });
  if (body?.consent !== true) return NextResponse.json({ error: '안내에 동의해 주세요.' }, { status: 400 });
  const joined = await joinWaitlist(slug, email);
  if (joined === 'unavailable') return NextResponse.json({ error: '지금은 받을 수 없습니다.' }, { status: 503 });
  if (joined === 'missing') return NextResponse.json({ error: '페이지를 찾지 못했습니다.' }, { status: 404 });
  if (joined === 'full') return NextResponse.json({ error: '신청이 마감되었습니다.' }, { status: 429 });
  if (joined === 'error') return NextResponse.json({ error: '신청하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
