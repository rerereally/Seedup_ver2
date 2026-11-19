import { createHash } from 'node:crypto';
import { findEvidence, getOpportunities, leadOpportunity } from '@/lib/opportunities/data';
import { readLiveEvidence, safeSourceUrl } from '@/lib/opportunities/live-evidence';
import { deleteDossier, saveDossier, updateSavedPrd } from '@/lib/db/dossiers';
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
  const live = readLiveEvidence(body?.liveEvidence, MAX_EVIDENCE);
  const seen = new Set<string>();
  const combinedEvidence = [...picked.map((item) => item.evidence), ...live].filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, MAX_EVIDENCE);

  const prd = typeof body?.prdMarkdown === 'string' ? body.prdMarkdown.trim().slice(0, MAX_PRD_LENGTH) : null;
  if (!combinedEvidence.length && (!prd || prd.length < 40)) {
    return NextResponse.json({ error: '저장할 근거나 PRD가 없습니다.' }, { status: 422 });
  }

  const lead = picked.length ? leadOpportunity(opportunities, picked) : null;
  const rawSlug = typeof body?.opportunitySlug === 'string' ? body.opportunitySlug.trim().slice(0, 120) : '';
  const matchedSlug = rawSlug && opportunities.some((item) => item.slug === rawSlug) ? rawSlug : null;
  const title = (typeof body?.title === 'string' ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : '') || lead?.name || '담은 근거';
  const evidenceIds = combinedEvidence.map((item) => item.id);
  const dossierKey = evidenceIds.length
    ? createHash('sha256').update([...evidenceIds].sort().join(',')).digest('hex').slice(0, 32)
    : createHash('sha256').update(`idea:${title.toLowerCase()}`).digest('hex').slice(0, 32);

  const { data: saved, error } = await saveDossier(supabase, {
    user_id: data.user.id,
    dossier_key: dossierKey,
    title,
    opportunity_slug: lead?.slug ?? matchedSlug ?? null,
    evidence_ids: evidenceIds,
    evidence: combinedEvidence,
    ...(prd ? { prd_markdown: prd } : {}),
  });

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
  const { error } = await deleteDossier(supabase, data.user.id, id);
  if (error) {
    console.error('Dossier delete failed', error.message);
    return NextResponse.json({ error: '지우지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

/** Turns the public read-only link, the public list entry, or "I built this" of one saved PRD on or off. Only the owner can. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '대상을 찾지 못했습니다.' }, { status: 400 });

  // "I built this" makes the PRD public with the link, so it can appear under its problem; clearing it keeps sharing as is.
  if (body && 'built' in body) {
    const built = body.built as { url?: unknown; note?: unknown } | null;
    const url = built ? safeSourceUrl(built.url) : null;
    if (built && !url) return NextResponse.json({ error: 'http(s)로 시작하는 공개 주소를 넣어 주세요.' }, { status: 400 });
    const patch = built && url
      ? { built_url: url.toString(), built_note: String(built.note ?? '').trim().slice(0, 200) || null, built_at: new Date().toISOString(), shared: true }
      : { built_url: null, built_note: null, built_at: null };
    const { data: row, error } = await updateSavedPrd(supabase, data.user.id, id, patch);
    if (error || !row) {
      if (error) console.error('Dossier built update failed', error.message);
      return NextResponse.json({ error: 'PRD가 저장된 항목에만 만든 것을 붙일 수 있습니다.' }, { status: error ? 503 : 404 });
    }
    return NextResponse.json({ ok: true, built: Boolean(built), shared: Boolean(built) || undefined, path: `/spec/${row.id}` });
  }

  // Listing puts the PRD on the public /spec list, which needs the link to be on; unlisting leaves the link as is.
  if (body && 'listed' in body) {
    const listed = body.listed === true;
    const { data: row, error } = await updateSavedPrd(supabase, data.user.id, id, listed ? { listed, shared: true } : { listed });
    if (error || !row) {
      if (error) console.error('Dossier list toggle failed', error.message);
      return NextResponse.json({ error: '공개 목록 설정을 바꾸지 못했습니다. PRD가 저장된 항목만 올릴 수 있습니다.' }, { status: error ? 503 : 404 });
    }
    return NextResponse.json({ ok: true, listed, shared: listed || undefined, path: `/spec/${row.id}` });
  }

  const shared = body?.shared === true;

  // Turning the link off also takes the PRD off the public list, so sharing it again later never lists it unasked.
  let { data: row, error } = await updateSavedPrd(supabase, data.user.id, id, shared ? { shared } : { shared, listed: false });
  // Before public_prds.sql runs there is no listed column; turning sharing off must still work.
  if (!shared && error?.message.includes('listed')) ({ data: row, error } = await updateSavedPrd(supabase, data.user.id, id, { shared }));
  if (error || !row) {
    if (error) console.error('Dossier share toggle failed', error.message);
    return NextResponse.json({ error: '공유 설정을 바꾸지 못했습니다. PRD가 저장된 항목만 공유할 수 있습니다.' }, { status: error ? 503 : 404 });
  }
  return NextResponse.json({ ok: true, shared, path: `/spec/${row.id}` });
}
