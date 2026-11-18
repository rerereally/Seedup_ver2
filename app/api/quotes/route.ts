import { createHash } from 'node:crypto';
import { consumeUsageFor, userForToken } from '@/lib/mcp/auth';
import { quotesFromLink, safeSourceUrl, signEvidence } from '@/lib/opportunities/live-evidence';
import { normalizeForMatch } from '@/lib/opportunities/rules';
import type { Platform } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DAILY_SAVE_LIMIT = 60;
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
  const service = createAdminClient();
  if (!service) return NextResponse.json({ error: 'server not configured' }, { status: 503, headers: CORS });
  const userId = await userForToken(service, request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: '토큰이 없거나 맞지 않습니다. Seedup 프로필의 에이전트 연결에서 토큰을 확인하세요.' }, { status: 401, headers: CORS });

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url.slice(0, 500) : '';
  const quote = typeof body?.quote === 'string' ? body.quote.replace(/\s+/g, ' ').trim().slice(0, 400) : '';
  if (!safeSourceUrl(url)) return NextResponse.json({ error: '이 주소는 담을 수 없습니다.' }, { status: 400, headers: CORS });
  if (normalizeForMatch(quote).length < 15) return NextResponse.json({ error: '문장을 조금 더 길게 골라 주세요.' }, { status: 400, headers: CORS });
  if (!(await consumeUsageFor(service, userId, 'quote_save', DAILY_SAVE_LIMIT))) return NextResponse.json({ error: `하루 ${DAILY_SAVE_LIMIT}개까지 담을 수 있습니다.` }, { status: 429, headers: CORS });

  const result = await quotesFromLink(url, '', quote).catch(() => null);
  if (!result || result.status !== 'ok') {
    const reason = result?.status === 'bad_url' ? '이 주소는 담을 수 없습니다.' : result?.status === 'unreadable' ? '이 글을 서버에서 읽지 못했습니다(로그인이 필요한 글일 수 있음).' : '고른 문장을 글에서 글자 그대로 찾지 못했습니다.';
    return NextResponse.json({ error: reason }, { status: 422, headers: CORS });
  }
  const row = result.quotes[0];
  const { error } = await service.from('saved_quotes').upsert({ user_id: userId, url: row.url, quote: row.quote, platform: row.platform, page_title: typeof body?.title === 'string' ? body.title.slice(0, 200) : null }, { onConflict: 'user_id,url,quote', ignoreDuplicates: true });
  if (error) {
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
  const { data } = await supabase.from('saved_quotes').select('url,quote,platform,created_at').order('created_at', { ascending: false }).limit(50);
  const quotes = (data ?? []).flatMap((row) => {
    // Same id as a quote found by link or web search, so the same sentence is never kept twice.
    const id = `lv_${createHash('sha256').update(`${row.url}\n${row.quote}`).digest('hex').slice(0, 16)}`;
    return signEvidence({ id, platform: row.platform as Platform, quote: row.quote, quoteKo: '', url: row.url, score: 0, postedAt: null }) ?? [];
  });
  return NextResponse.json({ quotes });
}
