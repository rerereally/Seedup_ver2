import { findLiveEvidence, signEvidence } from '@/lib/opportunities/live-evidence';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 90;

const DAILY_SEARCH_LIMIT = 20;

/** Finds developer quotes on the web for an idea the stored quotes do not cover. Signed in only: it spends model calls. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) return NextResponse.json({ error: '로그인 후 웹에서 원문을 찾을 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  if (!signEvidence({ id: 'lv_check', platform: 'web', quote: '', quoteKo: '', url: '', score: 0, postedAt: null })) {
    return NextResponse.json({ error: '서버 설정이 끝나지 않아 지금은 찾을 수 없습니다.' }, { status: 503 });
  }
  if (!(await consumeDailyUsage(supabase, 'evidence_search', DAILY_SEARCH_LIMIT))) {
    return NextResponse.json({ error: `웹 원문 찾기는 하루 ${DAILY_SEARCH_LIMIT}번까지 쓸 수 있습니다.` }, { status: 429 });
  }

  const result = await findLiveEvidence(idea).catch(() => null);
  if (!result) {
    await releaseDailyUsage(supabase, 'evidence_search');
    return NextResponse.json({ error: '찾는 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.' }, { status: 502 });
  }
  return NextResponse.json({ phrases: result.phrases, quotes: result.quotes.flatMap((row) => signEvidence(row) ?? []) });
}
