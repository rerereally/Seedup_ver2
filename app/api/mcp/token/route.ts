import { hashToken, newToken } from '@/lib/mcp/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function signedInUser() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return data.user;
}

/** Issues (or replaces) the user's MCP token. The plain token is returned once and never stored. */
export async function POST() {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const service = createAdminClient();
  if (!service) return NextResponse.json({ error: '서버 설정이 없습니다.' }, { status: 503 });
  const token = newToken();
  const { error } = await service.from('mcp_tokens').upsert({ user_id: user.id, token_hash: hashToken(token), created_at: new Date().toISOString(), last_used_at: null });
  if (error) {
    console.error('MCP token issue failed', error.message);
    return NextResponse.json({ error: '토큰을 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  const service = createAdminClient();
  if (!service) return NextResponse.json({ error: '서버 설정이 없습니다.' }, { status: 503 });
  await service.from('mcp_tokens').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
