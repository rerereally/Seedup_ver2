import { createHmac } from 'node:crypto';
import { consumeAnonUsage, releaseAnonUsage } from '@/lib/db/found-evidence';
import { searchIdeaEvidence } from '@/lib/opportunities/idea-evidence';
import { signEvidence } from '@/lib/opportunities/live-evidence';
import { createClient } from '@/lib/supabase/server';
import { clientOf, rateLimited } from '@/lib/throttle';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 90;

const DAILY_SEARCH_LIMIT = 20;
const ANON_DAILY_LIMIT = 4; // an automatic search and its retry use two
const FEATURE = 'evidence_search';

/** A signed-out visitor's key for the daily limit: a salted hash of their address, so the address is never stored. */
function visitorKey(request: Request) {
  const salt = process.env.LIVE_EVIDENCE_SECRET?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  const address = clientOf(request);
  return salt && address !== 'unknown' ? createHmac('sha256', salt).update(`visitor:${address}`).digest('hex').slice(0, 32) : '';
}

/**
 * Finds developer and everyday-site quotes for an idea the stored quotes do not cover. Signed-out visitors get a few a
 * day so they see evidence before signing in; the quotes come back signed, so they still count after sign-in.
 * `avoid` holds the phrases an earlier search for the same idea tried, so a second search uses other words.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const signedIn = Boolean(supabase && data.user);

  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  const avoid = (Array.isArray(body?.avoid) ? body.avoid : []).filter((row: unknown): row is string => typeof row === 'string').map((row: string) => row.slice(0, 80)).slice(0, 6);
  if (!signEvidence({ id: 'lv_check', platform: 'web', quote: '', quoteKo: '', url: '', score: 0, postedAt: null })) {
    return NextResponse.json({ error: '서버 설정이 끝나지 않아 지금은 찾을 수 없습니다.' }, { status: 503 });
  }

  const visitor = signedIn ? '' : visitorKey(request);
  if (!signedIn) {
    if (!visitor || await rateLimited(`evidence:${visitor}`, 6)) return NextResponse.json({ error: '잠시 뒤 다시 시도해 주세요.' }, { status: 429 });
    const allowed = await consumeAnonUsage(visitor, FEATURE, ANON_DAILY_LIMIT);
    if (allowed === null) return NextResponse.json({ error: '로그인 후 웹에서 원문을 찾을 수 있습니다.', login: true }, { status: 401 });
    if (!allowed) {
      return NextResponse.json({ error: `로그인 없이는 웹 원문 찾기를 하루 ${ANON_DAILY_LIMIT}번까지 쓸 수 있습니다. 로그인하면 더 찾을 수 있습니다.`, login: true }, { status: 429 });
    }
  } else if (!(await consumeDailyUsage(supabase!, FEATURE, DAILY_SEARCH_LIMIT))) {
    return NextResponse.json({ error: `웹 원문 찾기는 하루 ${DAILY_SEARCH_LIMIT}번까지 쓸 수 있습니다.` }, { status: 429 });
  }
  const refund = () => (signedIn ? releaseDailyUsage(supabase!, FEATURE) : releaseAnonUsage(visitor, FEATURE));

  const result = await searchIdeaEvidence(idea, { avoid, deadline: Date.now() + 80_000 }).catch(() => null);
  if (!result) {
    await refund();
    return NextResponse.json({ error: '찾는 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.' }, { status: 502 });
  }
  return NextResponse.json({ phrases: result.phrases, reused: result.reused, quotes: result.quotes.flatMap((row) => signEvidence(row) ?? []) });
}
