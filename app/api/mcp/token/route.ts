import { issueMcpToken, revokeMcpToken } from '@/lib/db/mcp-tokens';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function signedInUser() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return data.user;
}

/**
 * Gives the user their MCP token. By default the current token comes back again, so connecting Cursor and then
 * Claude Code leaves both working; `{ "rotate": true }` issues a new one and cuts off every tool using the old one.
 * The plain token is never stored: it is derived from the server secret and the issue time.
 */
export async function POST(request: Request) {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const result = await issueMcpToken(user.id, Boolean(body?.rotate));
  if (!result) return NextResponse.json({ error: '서버 설정이 없습니다.' }, { status: 503 });
  if ('error' in result) {
    console.error('MCP token issue failed', result.error);
    return NextResponse.json({ error: '토큰을 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json(result);
}

export async function DELETE() {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  if (!(await revokeMcpToken(user.id))) return NextResponse.json({ error: '서버 설정이 없습니다.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
