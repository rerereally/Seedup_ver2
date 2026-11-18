import { derivedToken, hashToken } from '@/lib/mcp/auth';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const service = createAdminClient();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!service || !key) return NextResponse.json({ error: '서버 설정이 없습니다.' }, { status: 503 });
  const body = await request.json().catch(() => null);

  if (!body?.rotate) {
    const { data: current } = await service.from('mcp_tokens').select('token_hash,created_at').eq('user_id', user.id).maybeSingle();
    const again = current ? derivedToken(user.id, new Date(current.created_at).getTime(), key) : null;
    // A token from before derivation (random) cannot be shown again; it falls through and is replaced.
    if (again && hashToken(again) === current?.token_hash) return NextResponse.json({ token: again, reused: true });
  }

  const issuedAt = new Date();
  const token = derivedToken(user.id, issuedAt.getTime(), key);
  const { error } = await service.from('mcp_tokens').upsert({ user_id: user.id, token_hash: hashToken(token), created_at: issuedAt.toISOString(), last_used_at: null });
  if (error) {
    console.error('MCP token issue failed', error.message);
    return NextResponse.json({ error: '토큰을 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ token, reused: false });
}

export async function DELETE() {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const service = createAdminClient();
  if (!service) return NextResponse.json({ error: '서버 설정이 없습니다.' }, { status: 503 });
  await service.from('mcp_tokens').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
