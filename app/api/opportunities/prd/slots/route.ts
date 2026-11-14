import { specInputFor } from '@/lib/opportunities/context';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { generateSlots } from '@/lib/opportunities/prd';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DAILY_SLOT_LIMIT = 40;
const MAX_EVIDENCE = 12;
const MAX_REQUIREMENTS = 6;

const clip = (value: unknown, limit: number) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');

/** Fills the six development readiness slots for one feature of a PRD the user already generated. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const evidenceIds: string[] = Array.isArray(body?.evidenceIds) ? body.evidenceIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, MAX_EVIDENCE) : [];
  const feature = { title: clip(body?.feature?.title, 120), detail: clip(body?.feature?.detail, 400) };
  const requirements = (Array.isArray(body?.requirements) ? body.requirements : []).slice(0, MAX_REQUIREMENTS)
    .map((row: { title?: unknown; detail?: unknown }) => ({ title: clip(row?.title, 120), detail: clip(row?.detail, 400) }))
    .filter((row: { title: string }) => row.title);
  if (!feature.title) return NextResponse.json({ error: '기능 정보가 없습니다.' }, { status: 400 });

  // Quotes come from the server's own data, never from the request body.
  const { opportunities } = await getOpportunities();
  const input = specInputFor(opportunities, findEvidence(opportunities, evidenceIds), clip(body?.title, 120));
  if (!input) return NextResponse.json({ error: '담은 근거를 찾지 못했습니다.' }, { status: 422 });

  if (!(await consumeDailyUsage(supabase, 'prd_slots', DAILY_SLOT_LIMIT))) {
    return NextResponse.json({ error: `개발 준비 슬롯은 하루 ${DAILY_SLOT_LIMIT}번까지 채울 수 있습니다.` }, { status: 429 });
  }
  const slots = await generateSlots(input, feature, requirements).catch((error) => {
    console.error('Readiness slots failed', error);
    return null;
  });
  if (!slots) {
    await releaseDailyUsage(supabase, 'prd_slots');
    return NextResponse.json({ error: '슬롯을 채우지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, slots });
}
