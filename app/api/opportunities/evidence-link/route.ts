import { quotesFromLink, safeSourceUrl, signEvidence } from '@/lib/opportunities/live-evidence';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DAILY_LINK_LIMIT = 30;

const MESSAGES = {
  bad_url: 'http(s)로 시작하는 공개 글 주소를 넣어 주세요.',
  unreadable: '그 글을 읽지 못했습니다. 로그인이 필요한 글이거나 주소가 틀렸을 수 있습니다.',
  not_found: '그 글에서 원문과 글자 단위로 맞는 문장을 찾지 못했습니다. 문장을 그대로 복사해 넣어 보세요.',
} as const;

/** Adds quotes from a link the person found, after checking each one against the post itself. Signed in only. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 원문을 추가할 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url.slice(0, 500) : '';
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  const quote = typeof body?.quote === 'string' ? body.quote.slice(0, 400) : '';
  if (!safeSourceUrl(url)) return NextResponse.json({ error: MESSAGES.bad_url }, { status: 400 });
  if (!signEvidence({ id: 'lv_check', platform: 'web', quote: '', quoteKo: '', url: '', score: 0, postedAt: null })) {
    return NextResponse.json({ error: '서버 설정이 끝나지 않아 지금은 추가할 수 없습니다.' }, { status: 503 });
  }
  if (!(await consumeDailyUsage(supabase, 'evidence_link', DAILY_LINK_LIMIT))) {
    return NextResponse.json({ error: `링크로 원문 추가는 하루 ${DAILY_LINK_LIMIT}번까지입니다.` }, { status: 429 });
  }

  const result = await quotesFromLink(url, idea || '개발자가 겪는 문제', quote).catch(() => null);
  if (!result || result.status !== 'ok') {
    await releaseDailyUsage(supabase, 'evidence_link');
    return NextResponse.json({ error: result ? MESSAGES[result.status as keyof typeof MESSAGES] : '확인하는 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.' }, { status: result?.status === 'bad_url' ? 400 : 422 });
  }
  return NextResponse.json({ quotes: result.quotes.flatMap((row) => signEvidence(row) ?? []) });
}
