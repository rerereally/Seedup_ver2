import { dossierKeyFor, hasSharedDossier, legacyDossierTitle, saveDossier, updateSavedPrd } from '@/lib/db/dossiers';
import { prdPolicy, prdRun } from '@/lib/db/server';
import { toLang, translator } from '@/lib/i18n';
import { getOpportunities, leadOpportunity } from '@/lib/opportunities/data';
import { inputFromBody } from '@/lib/opportunities/idea';
import { DEFAULT_PAID_PRD_MODEL, pickPrdModel } from '@/lib/opportunities/models';
import { normalizeDifferentiation, normalizeTechnicalDesign } from '@/lib/opportunities/prd-design';
import { findDifferentiationOverlap, withDifferentiationQuestion } from '@/lib/opportunities/prd-differentiation';
import { pushbackText } from '@/lib/opportunities/pushback';
import { generateScreens, MAX_PRD_RESEARCH_SOURCES, prdResearchSecret, readPrdResearch, researchPrd, reviseSpec, signPrdResearch } from '@/lib/opportunities/prd';
import { answerPrdGaps, normalizeFinding, normalizeModules, prdGaps } from '@/lib/opportunities/prd-modules';
import { isCutOffEvidenceQuote } from '@/lib/opportunities/quote-completeness';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { normalizeRivals, normalizeSlots, renderSpecMarkdown, withEvidenceStrength, withPrdReadiness } from '@/lib/opportunities/spec';
import type { Priority, Spec, SpecFeature, SpecInput, SpecRequirement, SpecScreen } from '@/lib/opportunities/spec';
import { publicEvidence } from '@/lib/opportunities/types';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { resolveProjectKey } from '@/lib/db/supervisor-projects';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const DAILY_REVISE_LIMIT = 20;

const clip = (value: unknown, limit: number) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const list = (value: unknown, limit: number) => (Array.isArray(value) ? value : []).slice(0, limit);
const ids = (value: unknown) => list(value, 12).filter((item): item is string => typeof item === 'string' && /^[RHFS]-\d{2}$/.test(item));

/** The client sends its current spec back; only its shape is trusted, never its evidence. */
function readSpec(value: unknown, input: SpecInput, draft: boolean, baseEvidenceCount: number): Spec | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const requirement = (row: unknown, hypothesis = false): SpecRequirement => {
    const record = (row ?? {}) as Record<string, unknown>;
    const evidence = hypothesis ? [] : list(record.evidence, 12).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= baseEvidenceCount);
    const priority = typeof record.priority === 'string' && /^P[012]$/.test(record.priority) ? (record.priority as Priority) : undefined;
    const acceptance = list(record.acceptance, 4).map((item) => clip(item, 240)).filter(Boolean);
    const check = clip(record.check, 300);
    const followup = hypothesis ? normalizeFinding(record.followup, input.evidence) : undefined;
    return { id: clip(record.id, 8), title: clip(record.title, 120), detail: clip(record.detail, 600), evidence, ...(priority ? { priority } : {}), ...(hypothesis && record.foundation === true ? { foundation: true } : {}), ...(acceptance.length ? { acceptance } : {}), ...(check ? { check } : {}), ...(followup ? { followup } : {}) };
  };
  const features: SpecFeature[] = list(raw.features, 10).map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return { id: clip(record.id, 8), title: clip(record.title, 120), detail: clip(record.detail, 600), requirementIds: ids(record.requirementIds), slots: normalizeSlots(record.slots, input.evidence) };
  });
  const screens: SpecScreen[] = list(raw.screens, 8).map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return { id: clip(record.id, 8), name: clip(record.name, 80), does: clip(record.does, 240), featureIds: ids(record.featureIds) };
  });
  const strings = (key: string, limit: number) => list(raw[key], limit).map((item) => clip(item, 200)).filter(Boolean);
  const differentiation = normalizeDifferentiation(raw.differentiation, baseEvidenceCount, input.competitorNotes);
  const modules = normalizeModules(raw.modules, input.evidence);
  const featureIds = ids(features.map((row) => row.id)).filter((id) => id.startsWith('F-'));
  const technicalDesign = normalizeTechnicalDesign(raw.technicalDesign, new Map(featureIds.map((id) => [id, id])));
  const lang = toLang(typeof raw.lang === 'string' ? raw.lang : null);
  const reviewNotes = [...new Set([...list(raw.reviewNotes, 8).map((item) => clip(item, 650)).filter(Boolean), ...(input.pushback?.map((issue) => pushbackText(issue, lang)) ?? [])])];
  return {
    summary: clip(raw.summary, 400),
    targetUsers: strings('targetUsers', 4),
    requirements: list(raw.requirements, 12).map((row) => requirement(row)).filter((row) => row.title),
    hypotheses: list(raw.hypotheses, 20).map((row) => requirement(row, true)).filter((row) => row.title),
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
    ...(Array.isArray(raw.openQuestions) ? { openQuestions: list(raw.openQuestions, 8).map((item) => clip(item, 760)).filter(Boolean) } : {}),
    ...(raw.beginner === true ? { beginner: true } : {}),
    ...(raw.origin === 'idea' ? { origin: 'idea' as const } : {}),
    lang,
    // Only rivals the server itself found for these quotes; a name the client adds is dropped, like evidence numbers.
    ...(Array.isArray(raw.rivals) ? { rivals: normalizeRivals(raw.rivals, input.competitors) } : {}),
    ...(differentiation ? { differentiation } : {}),
    ...(technicalDesign ? { technicalDesign } : {}),
    ...(modules ? { modules } : {}),
    ...(reviewNotes.length ? { reviewNotes } : {}),
    ...(Array.isArray(raw.existing) ? { existing: list(raw.existing, 12).map((row) => ({ name: clip((row as Record<string, unknown>)?.name, 80), does: clip((row as Record<string, unknown>)?.does, 240) })).filter((row) => row.name) } : {}),
  };
}

export async function POST(request: Request) {
  const deadline = Date.now() + 105_000;
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  const lang = toLang(body?.spec?.lang ?? body?.lang);
  const t = translator(lang);
  // mode "screens" designs the screens of a document-first PRD; everything else in the spec stays as it is.
  const screensOnly = mode === 'screens';
  const instruction = clip(body?.instruction, 300);
  if (!screensOnly && mode !== 'research' && mode !== 'answers' && mode !== 'save-research' && instruction.length < 2) return NextResponse.json({ error: '어떻게 고칠지 적어 주세요.' }, { status: 400 });
  const { opportunities } = await getOpportunities();
  const resolved = inputFromBody(opportunities, body, lang);
  if (!resolved) return NextResponse.json({ error: t('담은 근거를 찾지 못했습니다.', 'Could not find the selected evidence.') }, { status: 422 });
  const { input: base, picked } = resolved;
  const secret = prdResearchSecret();
  const research = readPrdResearch(body?.researchEvidence, data.user.id, base, secret);
  if (!research) return NextResponse.json({ error: t('조사 원문을 확인할 수 없습니다. PRD를 다시 열어 주세요.', 'Could not verify the research quotes. Reopen the PRD.') }, { status: 409 });
  const input = research.length ? { ...base, evidence: [...base.evidence, ...research] } : base;
  const checked = publicEvidence(base.evidence).filter(({ quote }) => !isCutOffEvidenceQuote(quote));
  const draft = !meetsEvidenceBar(checked.length, new Set(checked.map(({ platform }) => platform)).size);
  const current = readSpec(body?.spec && { ...body.spec, lang }, input, draft, base.evidence.length);
  if (!current || !(current.requirements.length + (current.origin === 'idea' ? current.hypotheses.length : 0))) return NextResponse.json({ error: t('고칠 PRD가 없습니다.', 'There is no PRD to revise.') }, { status: 400 });

  if (mode === 'save-research') {
    const userId = data.user.id;
    const id = typeof body?.dossierId === 'string' ? body.dossierId : '';
    if ((id && !/^[0-9a-f-]{36}$/i.test(id)) || !research.length) return NextResponse.json({ error: t('저장할 PRD를 찾지 못했습니다.', 'Could not find the PRD to save.') }, { status: 400 });
    const contents = {
      prd_markdown: renderSpecMarkdown(input, withPrdReadiness(current)),
      evidence: input.evidence,
      evidence_ids: publicEvidence(input.evidence).map(({ id }) => id),
      updated_at: new Date().toISOString(),
    };
    const saveFirst = async () => {
      const title = clip(body?.title, 120) || base.title;
      const ids = publicEvidence(base.evidence).map(({ id }) => id);
      const dossierKey = dossierKeyFor(ids, title, await legacyDossierTitle(supabase, userId, ids));
      const lead = picked.length ? leadOpportunity(opportunities, picked) : null;
      return saveDossier(supabase, { ...contents, user_id: userId, dossier_key: dossierKey, title, opportunity_slug: lead?.slug ?? null });
    };
    // The base quotes identify the existing bookmark and project. Research extends its source list in place.
    const { data: saved, error } = id ? await updateSavedPrd(supabase, userId, id, contents) : await saveFirst();
    if (error || !saved) return NextResponse.json({ error: t('조사 결과를 저장하지 못했습니다.', 'Could not save the research.') }, { status: error ? 503 : 404 });
    return NextResponse.json({ ok: true, id: saved.id, sharePath: await hasSharedDossier(supabase, userId, saved.id) ? `/spec/${saved.id}` : null });
  }

  if (mode === 'answers') {
    const result = answerPrdGaps(current, body?.answers);
    if (!result) return NextResponse.json({ error: t('반영할 답변이 없습니다. 질문을 다시 확인해 주세요.', 'There are no answers to apply. Check the questions again.') }, { status: 400 });
    const spec = withEvidenceStrength(result.spec, input.evidence);
    return NextResponse.json({ ok: true, spec, filled: result.filled, remaining: prdGaps(spec).length });
  }

  const needsModel = mode !== 'research' || prdGaps(withPrdReadiness(current)).length > 0;
  if (needsModel && !(await consumeDailyUsage(supabase, 'prd_revise', DAILY_REVISE_LIMIT))) {
    return NextResponse.json({ error: t(`PRD 보강과 수정은 하루 ${DAILY_REVISE_LIMIT}번까지 할 수 있습니다.`, `You can research or revise a PRD up to ${DAILY_REVISE_LIMIT} times per day.`) }, { status: 429 });
  }
  if (mode === 'research') {
    const result = await researchPrd(input, current, secret ? MAX_PRD_RESEARCH_SOURCES - research.length : 0, deadline);
    const rows = [...research, ...result.added];
    const evidence = [...base.evidence, ...rows];
    return NextResponse.json({
      ok: true, spec: withEvidenceStrength(result.spec, evidence), evidence,
      questions: result.questions, remaining: result.remaining, filled: result.filled,
      researchEvidence: rows.length ? signPrdResearch(data.user.id, base, rows, secret) : null,
    });
  }
  const model = pickPrdModel(body?.model, await prdPolicy()) ?? DEFAULT_PAID_PRD_MODEL;
  const run = prdRun(data.user, 'revise', model);
  const work = screensOnly
    ? generateScreens(input, current, model, run.onUsage).then((screens) => (screens ? { ...current, screens } : null))
    : reviseSpec(base, current, instruction, model, undefined, run.onUsage, deadline).then(async (revised) => {
      if (!revised?.differentiation || revised.differentiation.claim === current.differentiation?.claim) return revised;
      const overlap = await findDifferentiationOverlap(input, revised, { model, onUsage: run.onUsage, deadline });
      return withDifferentiationQuestion(revised, overlap);
    });
  const spec = await work.catch((error) => {
    console.error('PRD revise failed', error);
    return null;
  });
  const usageProject = typeof body?.usageProject === 'string' ? await resolveProjectKey(supabase, data.user.id, body.usageProject).catch(() => null) : null;
  const runKey = await run.finish(Boolean(spec), input.title, undefined, usageProject);
  if (!spec) {
    await releaseDailyUsage(supabase, 'prd_revise');
    return NextResponse.json({ error: screensOnly ? '화면을 설계하지 못했습니다. 잠시 후 다시 시도해주세요.' : '수정하지 못했습니다. 요청을 조금 바꿔 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, runKey, spec: withEvidenceStrength(withPrdReadiness(spec), input.evidence) });
}
