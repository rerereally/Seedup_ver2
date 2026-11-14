import { createHash } from 'node:crypto';
import { findEvidence, getOpportunities, leadOpportunity } from '@/lib/opportunities/data';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_EVIDENCE = 24;
const MAX_TITLE_LENGTH = 120;
const MAX_PRD_LENGTH = 40_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) {
    return NextResponse.json({ error: '로그인 후 저장할 수 있습니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.evidenceIds) ? body.evidenceIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, MAX_EVIDENCE) : [];
  const { opportunities } = await getOpportunities();
  const picked = findEvidence(opportunities, ids);
  if (!picked.length) return NextResponse.json({ error: '저장할 근거가 없습니다.' }, { status: 422 });

  const lead = leadOpportunity(opportunities, picked);
  const title = (typeof body?.title === 'string' ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : '') || lead?.name || '담은 근거';
  const evidenceIds = picked.map((item) => item.evidence.id);
  const dossierKey = createHash('sha256').update([...evidenceIds].sort().join(',')).digest('hex').slice(0, 32);
  const prd = typeof body?.prdMarkdown === 'string' ? body.prdMarkdown.slice(0, MAX_PRD_LENGTH) : null;

  const { data: saved, error } = await supabase
    .from('evidence_dossiers')
    .upsert({
      user_id: data.user.id,
      dossier_key: dossierKey,
      title,
      opportunity_slug: lead?.slug ?? null,
      evidence_ids: evidenceIds,
      evidence: picked.map((item) => item.evidence),
      ...(prd ? { prd_markdown: prd } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,dossier_key' })
    .select('id')
    .single();

  if (error) {
    console.error('Dossier save failed', error.message);
    return NextResponse.json({ error: '저장하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, id: saved.id });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) {
    return NextResponse.json({ error: '로그인 후 지울 수 있습니다.' }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '지울 근거를 찾지 못했습니다.' }, { status: 400 });

  // RLS already limits this to the user's own rows; the user_id filter keeps it safe if that policy ever changes.
  const { error } = await supabase.from('evidence_dossiers').delete().eq('id', id).eq('user_id', data.user.id);
  if (error) {
    console.error('Dossier delete failed', error.message);
    return NextResponse.json({ error: '지우지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

/** Turns the public read-only link of one saved PRD on or off. Only the owner can, and only for a PRD that exists. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '대상을 찾지 못했습니다.' }, { status: 400 });
  const shared = body?.shared === true;

  const { data: row, error } = await supabase
    .from('evidence_dossiers')
    .update({ shared })
    .eq('id', id)
    .eq('user_id', data.user.id)
    .not('prd_markdown', 'is', null)
    .select('id')
    .maybeSingle();
  if (error || !row) {
    if (error) console.error('Dossier share toggle failed', error.message);
    return NextResponse.json({ error: '공유 설정을 바꾸지 못했습니다. PRD가 저장된 항목만 공유할 수 있습니다.' }, { status: error ? 503 : 404 });
  }
  return NextResponse.json({ ok: true, shared, path: `/spec/${row.id}` });
}
