import { prdPolicy, prdRun } from '@/lib/db/server';
import { toLang } from '@/lib/i18n';
import { getOpportunities } from '@/lib/opportunities/data';
import { inputFromBody } from '@/lib/opportunities/idea';
import { pickPrdModel } from '@/lib/opportunities/models';
import { generateScreens, reviseSpec } from '@/lib/opportunities/prd';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { normalizeRivals, normalizeSlots } from '@/lib/opportunities/spec';
import type { Priority, Spec, SpecFeature, SpecRequirement, SpecScreen } from '@/lib/opportunities/spec';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const DAILY_REVISE_LIMIT = 20;

const clip = (value: unknown, limit: number) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const list = (value: unknown, limit: number) => (Array.isArray(value) ? value : []).slice(0, limit);
const ids = (value: unknown) => list(value, 12).filter((item): item is string => typeof item === 'string' && /^[RHFS]-\d{2}$/.test(item));

/** The client sends its current spec back; only its shape is trusted, never its evidence. */
function readSpec(value: unknown, evidenceCount: number, draft: boolean, competitors: string[]): Spec | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const requirement = (row: unknown): SpecRequirement => {
    const record = (row ?? {}) as Record<string, unknown>;
    const evidence = list(record.evidence, 12).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= evidenceCount);
    const priority = typeof record.priority === 'string' && /^P[012]$/.test(record.priority) ? (record.priority as Priority) : undefined;
    const acceptance = list(record.acceptance, 4).map((item) => clip(item, 240)).filter(Boolean);
    const check = clip(record.check, 300);
    return { id: clip(record.id, 8), title: clip(record.title, 120), detail: clip(record.detail, 600), evidence, ...(priority ? { priority } : {}), ...(acceptance.length ? { acceptance } : {}), ...(check ? { check } : {}) };
  };
  const features: SpecFeature[] = list(raw.features, 10).map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return { id: clip(record.id, 8), title: clip(record.title, 120), detail: clip(record.detail, 600), requirementIds: ids(record.requirementIds), slots: normalizeSlots(record.slots) };
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
    metrics: strings('metrics', 6),
    draft,
    // The narrative parts of a Markdown-written PRD; without them a revision would quietly drop them.
    ...(clip(raw.background, 1500) ? { background: clip(raw.background, 1500) } : {}),
    ...(clip(raw.scenario, 1000) ? { scenario: clip(raw.scenario, 1000) } : {}),
    ...(strings('goals', 5).length ? { goals: strings('goals', 5) } : {}),
    ...(strings('assumptions', 6).length ? { assumptions: strings('assumptions', 6) } : {}),
    ...(strings('openQuestions', 6).length ? { openQuestions: strings('openQuestions', 6) } : {}),
    ...(raw.beginner === true ? { beginner: true } : {}),
    ...(raw.origin === 'idea' ? { origin: 'idea' as const } : {}),
    lang: toLang(typeof raw.lang === 'string' ? raw.lang : null),
    // Only rivals the server itself found for these quotes; a name the client adds is dropped, like evidence numbers.
    ...(Array.isArray(raw.rivals) ? { rivals: normalizeRivals(raw.rivals, competitors) } : {}),
    ...(Array.isArray(raw.existing) ? { existing: list(raw.existing, 12).map((row) => ({ name: clip((row as Record<string, unknown>)?.name, 80), does: clip((row as Record<string, unknown>)?.does, 240) })).filter((row) => row.name) } : {}),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  // mode "screens" designs the screens of a document-first PRD; everything else in the spec stays as it is.
  const screensOnly = body?.mode === 'screens';
  const instruction = clip(body?.instruction, 300);
  if (!screensOnly && instruction.length < 2) return NextResponse.json({ error: '어떻게 고칠지 적어 주세요.' }, { status: 400 });
  const { opportunities } = await getOpportunities();
  const resolved = inputFromBody(opportunities, body, toLang(typeof body?.spec?.lang === 'string' ? body.spec.lang : null));
  if (!resolved) return NextResponse.json({ error: '담은 근거를 찾지 못했습니다.' }, { status: 422 });
  const { input, picked } = resolved;
  const draft = !meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
  const current = readSpec(body?.spec, input.evidence.length, draft, input.competitors);
  if (!current || !(current.requirements.length + (current.origin === 'idea' ? current.hypotheses.length : 0))) return NextResponse.json({ error: '고칠 PRD가 없습니다.' }, { status: 400 });

  if (!(await consumeDailyUsage(supabase, 'prd_revise', DAILY_REVISE_LIMIT))) {
    return NextResponse.json({ error: `대화형 수정은 하루 ${DAILY_REVISE_LIMIT}번까지 할 수 있습니다.` }, { status: 429 });
  }
  const model = pickPrdModel(body?.model, await prdPolicy());
  const run = prdRun(data.user, 'revise', model ?? 'default');
  const work = screensOnly
    ? generateScreens(input, current, model, run.onUsage).then((screens) => (screens ? { ...current, screens } : null))
    : reviseSpec(input, current, instruction, model, undefined, run.onUsage);
  const spec = await work.catch((error) => {
    console.error('PRD revise failed', error);
    return null;
  });
  await run.finish(Boolean(spec), input.title);
  if (!spec) {
    await releaseDailyUsage(supabase, 'prd_revise');
    return NextResponse.json({ error: screensOnly ? '화면을 설계하지 못했습니다. 잠시 후 다시 시도해주세요.' : '수정하지 못했습니다. 요청을 조금 바꿔 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, spec });
}
