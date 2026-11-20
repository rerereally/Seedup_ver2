import type { SupabaseClient } from '@supabase/supabase-js';
import { cached, forget } from '../cache';
import { priceFor } from '../pricing';
import { isFreeOpenRouterModel, prdFreeModels } from '../llm';

export const DEFAULT_PAID_PRD_MODEL = 'openai/gpt-6.2-sol';
export const HAIKU_MODEL = 'anthropic/claude-haiku-5.5';
export const PAID_PRD_MODELS = [DEFAULT_PAID_PRD_MODEL, HAIKU_MODEL] as const;
export const PRD_REASONING_LEVELS = ['low', 'medium', 'high'] as const;
export const DEFAULT_PRD_REASONING = 'high';

type PaidPrdModel = (typeof PAID_PRD_MODELS)[number];
type PrdReasoning = (typeof PRD_REASONING_LEVELS)[number];
export type PaidPrdOptions = { model: PaidPrdModel; reasoning: PrdReasoning };

export function pickPaidPrdModel(value: unknown): PaidPrdModel {
  return value === HAIKU_MODEL ? HAIKU_MODEL : DEFAULT_PAID_PRD_MODEL;
}

export function pickReasoning(value: unknown): PrdReasoning {
  return value === 'low' || value === 'medium' || value === 'high' ? value : DEFAULT_PRD_REASONING;
}

export function otherFamilyModel(model: PaidPrdModel): PaidPrdModel {
  return model === HAIKU_MODEL ? DEFAULT_PAID_PRD_MODEL : HAIKU_MODEL;
}

export function paidPrdModelChain(model: PaidPrdModel) {
  return [model, otherFamilyModel(model)];
}

/** Menu id for LG K-EXAONE 2.5, called on LG's own API with its own key instead of through OpenRouter. */
export const EXAONE_ID = 'exaone';

/** A model the PRD screens may offer. Only ids on this server-side list are ever called. */
export type PrdModel = { id: string; label: string; note: string; free: boolean; available: boolean; reason?: string; base?: true };

type Choice = { id: string; label: string; note: string };

// OpenRouter ids and prices checked on 2026-11-17 (US$ per million tokens). The notes give the cost of one PRD
// (about 5k tokens in, 3k out), up to twice that when the quality check asks for one repair.
const PAID: Choice[] = [
  { id: DEFAULT_PAID_PRD_MODEL, label: 'GPT 6.2 Sol', note: '꼼꼼함 · 1건 약 60~110원' },
  { id: HAIKU_MODEL, label: 'Claude Haiku 5.5', note: '저렴하고 빠름 · 1건 약 3~6원' },
  { id: 'deepseek/deepseek-v4.1-flash-1017', label: 'DeepSeek V4.1 Flash', note: '가장 저렴 · 1건 약 2~5원' },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', note: '꼼꼼함 · 1건 약 60~110원' },
  { id: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5', note: '가장 비쌈 · 1건 약 110~220원' },
];

const baseModel = () => process.env.OPENROUTER_MODEL?.trim() ?? '';
export const exaoneConfigured = () => Boolean(process.env.EXAONE_API_KEY?.trim());

/** Which models the admin allows for PRDs. Stored in app_settings so it changes without a redeploy. */
export type PrdPolicy = { enabled: string[] };
const POLICY_KEY = 'prd_models';

/** By default GPT 6.2 Sol (primary), Claude Haiku 5.5, the free fallback and EXAONE (when keyed) are enabled. */
export const defaultPolicy = (): PrdPolicy => ({ enabled: [DEFAULT_PAID_PRD_MODEL, HAIKU_MODEL, baseModel(), EXAONE_ID].filter(Boolean) });

export function loadPrdPolicy(service: SupabaseClient | null): Promise<PrdPolicy> {
  if (!service) return Promise.resolve(defaultPolicy());
  return cached('prd-policy', async () => {
    const { data, error } = await service.from('app_settings').select('value').eq('key', POLICY_KEY).maybeSingle();
    const enabled = (data?.value as PrdPolicy | null)?.enabled;
    return !error && Array.isArray(enabled) ? { enabled: enabled.filter((id) => typeof id === 'string') } : defaultPolicy();
  }, 30_000);
}

export async function savePrdPolicy(service: SupabaseClient, enabled: string[], by: string) {
  const known = new Set(allModelIds());
  // GPT 6.2 Sol stays enabled as the fixed web default; the free model remains available as a last-resort option.
  const value: PrdPolicy = { enabled: [...new Set([DEFAULT_PAID_PRD_MODEL, baseModel(), ...enabled])].filter((id) => id && known.has(id)) };
  const { error } = await service.from('app_settings').upsert({ key: POLICY_KEY, value, updated_at: new Date().toISOString(), updated_by: by });
  if (error) throw new Error(error.message);
  // Other server instances keep their copy for up to 30 seconds.
  forget('prd-policy');
}

export const allModelIds = () => [DEFAULT_PAID_PRD_MODEL, baseModel(), EXAONE_ID, ...PAID.map((row) => row.id)].filter((id, index, all) => Boolean(id) && all.indexOf(id) === index);

/** The menu for everyone, GPT 6.2 Sol first as the fixed web default. Models the admin turned off stay listed but cannot be picked. */
export function prdModels(policy: PrdPolicy): PrdModel[] {
  const on = new Set(policy.enabled);
  const base = baseModel();
  const rows: PrdModel[] = [];
  for (const row of PAID) {
    if (row.id === base) continue;
    const available = row.id === DEFAULT_PAID_PRD_MODEL || on.has(row.id);
    rows.push({ id: row.id, label: row.label, note: row.note, free: false, available, reason: available ? undefined : '관리자가 막아 둠' });
  }
  rows.push({
    id: EXAONE_ID,
    label: 'K-EXAONE 2.5',
    note: 'LG AI연구원 · 무료',
    free: true,
    available: exaoneConfigured() && on.has(EXAONE_ID),
    reason: !exaoneConfigured() ? 'EXAONE 키가 아직 없음' : on.has(EXAONE_ID) ? undefined : '관리자가 막아 둠',
  });
  if (base) {
    const freeAvailable = on.has(base);
    rows.push({ id: base, label: '무료 모델', note: '최후 폴백용', free: isFreeOpenRouterModel(base), available: freeAvailable, base: true, reason: freeAvailable ? undefined : '관리자가 막아 둠' });
  }
  return rows;
}

/** The model a request asked for, if the admin allows it right now; otherwise undefined (callers default to GPT 6.2 Sol). */
export function pickPrdModel(requested: unknown, policy: PrdPolicy): string | undefined {
  if (typeof requested !== 'string') return undefined;
  return prdModels(policy).find((row) => row.id === requested && row.available)?.id;
}

const dedupeModels = (models: Array<string | undefined>) => [...new Set(models.map((model) => model?.trim()).filter((model): model is string => Boolean(model)))];

/** Careful web tasks (PRD writing, revision, reverse spec): chosen paid model (default GPT 6.2 Sol), paid fallback, then free last resort. */
export function carefulWebModels(chosen?: string, freeFallback: readonly string[] = prdFreeModels()) {
  const primary = chosen?.trim() || DEFAULT_PAID_PRD_MODEL;
  const secondary = primary === HAIKU_MODEL ? DEFAULT_PAID_PRD_MODEL : HAIKU_MODEL;
  return dedupeModels([primary, DEFAULT_PAID_PRD_MODEL, secondary, ...freeFallback]);
}

/** Lightweight web tasks (questions, clarity, screens, slots, evidence, build estimate): Claude Haiku 5.5 first, GPT 6.2 Sol fallback, then free last resort. */
export function lightWebModels(freeFallback: readonly string[] = prdFreeModels()) {
  return dedupeModels([HAIKU_MODEL, DEFAULT_PAID_PRD_MODEL, ...freeFallback]);
}

/** Cross-family paid critic for web P0 audits: opposite family of the writer first, Claude Haiku 5.5 / GPT 6.2 Sol fallback, then free last resort. */
export function criticWebModels(writerModel?: string, freeFallback: readonly string[] = prdFreeModels()) {
  const anthropicWriter = Boolean(writerModel?.toLowerCase().startsWith('anthropic/'));
  const primary = anthropicWriter ? DEFAULT_PAID_PRD_MODEL : HAIKU_MODEL;
  const secondary = primary === HAIKU_MODEL ? DEFAULT_PAID_PRD_MODEL : HAIKU_MODEL;
  return dedupeModels([primary, secondary, ...freeFallback]);
}

/** Estimated US$ for one call, from the token counts the provider reported. Free models cost nothing. */
export function estimateCost(model: string, promptTokens: number, completionTokens: number) {
  const price = priceFor(model);
  return price ? (promptTokens * price.input + completionTokens * price.output) / 1_000_000 : 0;
}

export const modelLabel = (id: string) => (id === EXAONE_ID ? 'K-EXAONE 2.5' : id === baseModel() ? '기본 무료 모델' : PAID.find((row) => row.id === id)?.label ?? id);
