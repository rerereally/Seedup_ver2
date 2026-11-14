import { toLang } from '@/lib/i18n';
import { specInputFor } from '@/lib/opportunities/context';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { reviseSpec } from '@/lib/opportunities/prd';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { normalizeSlots } from '@/lib/opportunities/spec';
import type { Spec, SpecFeature, SpecRequirement, SpecScreen } from '@/lib/opportunities/spec';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const DAILY_REVISE_LIMIT = 20;
const MAX_EVIDENCE = 12;

const clip = (value: unknown, limit: number) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const list = (value: unknown, limit: number) => (Array.isArray(value) ? value : []).slice(0, limit);
const ids = (value: unknown) => list(value, 12).filter((item): item is string => typeof item === 'string' && /^[RHFS]-\d{2}$/.test(item));

/** The client sends its current spec back; only its shape is trusted, never its evidence. */
function readSpec(value: unknown, evidenceCount: number, draft: boolean): Spec | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const requirement = (row: unknown): SpecRequirement => {
    const record = (row ?? {}) as Record<string, unknown>;
    const evidence = list(record.evidence, 12).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= evidenceCount);
    return { id: clip(record.id, 8), title: clip(record.title, 120), detail: clip(record.detail, 400), evidence };
  };
  const features: SpecFeature[] = list(raw.features, 10).map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return { id: clip(record.id, 8), title: clip(record.title, 120), detail: clip(record.detail, 400), requirementIds: ids(record.requirementIds), slots: normalizeSlots(record.slots) };
  });
  const screens: SpecScreen[] = list(raw.screens, 8).map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return { id: clip(record.id, 8), name: clip(record.name, 80), does: clip(record.does, 240), featureIds: ids(record.featureIds) };
  });
  const strings = (key: string, limit: number) => list(raw[key], limit).map((item) => clip(item, 200)).filter(Boolean);
  return {
    summary: clip(raw.summary, 400),
    targetUsers: strings('targetUsers', 4),
    requirements: list(raw.requirements, 12).map(requirement).filter((row) => row.title),
    hypotheses: list(raw.hypotheses, 12).map(requirement).filter((row) => row.title),
    features,
    screens,
    nonGoals: strings('nonGoals', 6),
    risks: strings('risks', 6),
    metrics: strings('metrics', 5),
    draft,
    lang: toLang(typeof raw.lang === 'string' ? raw.lang : null),
    ...(Array.isArray(raw.existing) ? { existing: list(raw.existing, 12).map((row) => ({ name: clip((row as Record<string, unknown>)?.name, 80), does: clip((row as Record<string, unknown>)?.does, 240) })).filter((row) => row.name) } : {}),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const instruction = clip(body?.instruction, 300);
  if (instruction.length < 2) return NextResponse.json({ error: '어떻게 고칠지 적어 주세요.' }, { status: 400 });
  const evidenceIds: string[] = list(body?.evidenceIds, MAX_EVIDENCE).filter((id): id is string => typeof id === 'string');

  const { opportunities } = await getOpportunities();
  const picked = findEvidence(opportunities, evidenceIds);
  const input = specInputFor(opportunities, picked, clip(body?.title, 120), toLang(typeof body?.spec?.lang === 'string' ? body.spec.lang : null));
  if (!input) return NextResponse.json({ error: '담은 근거를 찾지 못했습니다.' }, { status: 422 });
  const draft = !meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
  const current = readSpec(body?.spec, input.evidence.length, draft);
  if (!current?.requirements.length) return NextResponse.json({ error: '고칠 PRD가 없습니다.' }, { status: 400 });

  if (!(await consumeDailyUsage(supabase, 'prd_revise', DAILY_REVISE_LIMIT))) {
    return NextResponse.json({ error: `대화형 수정은 하루 ${DAILY_REVISE_LIMIT}번까지 할 수 있습니다.` }, { status: 429 });
  }
  const spec = await reviseSpec(input, current, instruction).catch((error) => {
    console.error('PRD revise failed', error);
    return null;
  });
  if (!spec) {
    await releaseDailyUsage(supabase, 'prd_revise');
    return NextResponse.json({ error: '수정하지 못했습니다. 요청을 조금 바꿔 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, spec });
}
