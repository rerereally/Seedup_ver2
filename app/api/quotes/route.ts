import { createHash } from 'node:crypto';
import { consumeForTokenUser, releaseForTokenUser, saveQuoteFor, savedQuotes, tokenUser } from '@/lib/db/saved-quotes';
import { quotesFromLink, safeSourceUrl, signEvidence } from '@/lib/opportunities/live-evidence';
import { normalizeForMatch } from '@/lib/opportunities/rules';
import type { Platform } from '@/lib/opportunities/types';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DAILY_SAVE_LIMIT = 60;
const IP_REQUESTS_PER_MINUTE = 30;
const USER_REQUESTS_PER_MINUTE = 12;
// The extension calls from its own origin; only this route answers it, and only with a valid personal token.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type' };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Saves one sentence from a post, sent by the browser extension with the person's MCP token. The sentence is kept
 * only when it appears in the post word for word, the same check every quote on Seedup goes through.
 */
export async function POST(request: Request) {
  if (await rateLimited(`quotes:ip:${clientOf(request)}`, IP_REQUESTS_PER_MINUTE)) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { ...CORS, 'Retry-After': '60' } });
  }
  const userId = await tokenUser(request.headers.get('authorization'));
  if (userId === undefined) return NextResponse.json({ error: 'server not configured' }, { status: 503, headers: CORS });
  if (!userId) return NextResponse.json({ error: '토큰이 없거나 맞지 않습니다. Seedup MCP 연동(/agents)에서 토큰을 확인하세요.' }, { status: 401, headers: CORS });
  if (await rateLimited(`quotes:user:${userId}`, USER_REQUESTS_PER_MINUTE)) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { ...CORS, 'Retry-After': '60' } });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url.slice(0, 500) : '';
  const quote = typeof body?.quote === 'string' ? body.quote.replace(/\s+/g, ' ').trim().slice(0, 400) : '';
  if (!safeSourceUrl(url)) return NextResponse.json({ error: '이 주소는 담을 수 없습니다.' }, { status: 400, headers: CORS });
  if (normalizeForMatch(quote).length < 15) return NextResponse.json({ error: '문장을 조금 더 길게 골라 주세요.' }, { status: 400, headers: CORS });
  if (!(await consumeForTokenUser(userId, 'quote_save', DAILY_SAVE_LIMIT))) return NextResponse.json({ error: `하루 ${DAILY_SAVE_LIMIT}개까지 담을 수 있습니다.` }, { status: 429, headers: CORS });

  const result = await quotesFromLink(url, '', quote).catch(() => null);
  if (!result || result.status !== 'ok') {
    await releaseForTokenUser(userId, 'quote_save');
    const reason = result?.status === 'bad_url' ? '이 주소는 담을 수 없습니다.' : result?.status === 'unreadable' ? '이 글을 서버에서 읽지 못했습니다(로그인이 필요한 글일 수 있음).' : '고른 문장을 글에서 글자 그대로 찾지 못했습니다.';
    return NextResponse.json({ error: reason }, { status: 422, headers: CORS });
  }
  const row = result.quotes[0];
  const { error } = await saveQuoteFor(userId, { url: row.url, quote: row.quote, platform: row.platform, page_title: typeof body?.title === 'string' ? body.title.slice(0, 200) : null });
  if (error) {
    await releaseForTokenUser(userId, 'quote_save');
    console.error('saved quote insert failed', error.message);
    return NextResponse.json({ error: '저장하지 못했습니다.' }, { status: 503, headers: CORS });
  }
  return NextResponse.json({ ok: true, platform: row.platform }, { headers: CORS });
}

/** This person's saved sentences, signed so the PRD workspace can use them as evidence. Signed-in session only. */
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return NextResponse.json({ quotes: [] }, { status: 401 });
  const { data } = await savedQuotes(supabase);
  const quotes = (data ?? []).flatMap((row) => {
    // Same id as a quote found by link or web search, so the same sentence is never kept twice.
    const id = `lv_${createHash('sha256').update(`${row.url}\n${row.quote}`).digest('hex').slice(0, 16)}`;
    return signEvidence({ id, platform: row.platform as Platform, quote: row.quote, quoteKo: '', url: row.url, score: 0, postedAt: null }) ?? [];
  });
  return NextResponse.json({ quotes });
}
