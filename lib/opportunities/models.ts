import type { SupabaseClient } from '@supabase/supabase-js';
import { cached, forget } from '../cache';
import { isFreeOpenRouterModel } from '../ingest/openrouter-models';

/** Menu id for LG K-EXAONE 2.5, called on LG's own API with its own key instead of through OpenRouter. */
export const EXAONE_ID = 'exaone';

/** A model the PRD screens may offer. Only ids on this server-side list are ever called. */
export type PrdModel = { id: string; label: string; note: string; free: boolean; available: boolean; reason?: string };

type Choice = { id: string; label: string; note: string; usdPerMillion: { input: number; output: number } };

// OpenRouter ids and prices checked on 2026-11-17 (US$ per million tokens). The notes give the cost of one PRD
// (about 5k tokens in, 3k out), up to twice that when the quality check asks for one repair.
const PAID: Choice[] = [
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', note: '저렴하고 빠름 · 1건 약 3~6원', usdPerMillion: { input: 0.1, output: 0.5 } },
  { id: 'deepseek/deepseek-v4.1-flash-1017', label: 'DeepSeek V4.1 Flash', note: '가장 저렴 · 1건 약 2~5원', usdPerMillion: { input: 0.04, output: 0.5 } },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', note: '꼼꼼함 · 1건 약 60~110원', usdPerMillion: { input: 2, output: 10 } },
  { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol', note: '꼼꼼함 · 1건 약 60~110원', usdPerMillion: { input: 2, output: 10 } },
  { id: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5', note: '가장 비쌈 · 1건 약 110~220원', usdPerMillion: { input: 4, output: 20 } },
];

const baseModel = () => process.env.OPENROUTER_MODEL?.trim() ?? '';
export const exaoneConfigured = () => Boolean(process.env.EXAONE_API_KEY?.trim());

/** Which models the admin allows for PRDs. Stored in app_settings so it changes without a redeploy. */
export type PrdPolicy = { enabled: string[] };
const POLICY_KEY = 'prd_models';

/** Until an admin opens more, only the free model and K-EXAONE (free on LG's platform for now) can be used. */
export const defaultPolicy = (): PrdPolicy => ({ enabled: [baseModel(), EXAONE_ID].filter(Boolean) });

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
  // The free model can never be switched off, so a PRD can always be made.
  const value: PrdPolicy = { enabled: [...new Set([baseModel(), ...enabled])].filter((id) => id && known.has(id)) };
  const { error } = await service.from('app_settings').upsert({ key: POLICY_KEY, value, updated_at: new Date().toISOString(), updated_by: by });
  if (error) throw new Error(error.message);
  // Other server instances keep their copy for up to 30 seconds.
  forget('prd-policy');
}

export const allModelIds = () => [baseModel(), EXAONE_ID, ...PAID.map((row) => row.id)].filter(Boolean);

/** The menu for everyone, free model first (also the default pick). Blocked or unconfigured models stay listed with the reason. */
export function prdModels(policy: PrdPolicy): PrdModel[] {
  const on = new Set(policy.enabled);
  const base = baseModel();
  const rows: PrdModel[] = [];
  if (base) rows.push({ id: base, label: '무료 모델', note: '기본 · 비용 없음, 느리고 가끔 실패', free: isFreeOpenRouterModel(base), available: true });
  rows.push({
    id: EXAONE_ID,
    label: 'K-EXAONE 2.5',
    note: 'LG AI연구원 · 현재 무료 API',
    free: true,
    available: exaoneConfigured() && on.has(EXAONE_ID),
    reason: !exaoneConfigured() ? 'EXAONE 키가 아직 없음' : on.has(EXAONE_ID) ? undefined : '관리자가 막아 둠',
  });
  for (const row of PAID) {
    if (row.id === base) continue;
    rows.push({ id: row.id, label: row.label, note: row.note, free: false, available: on.has(row.id), reason: on.has(row.id) ? undefined : '관리자가 막아 둠' });
  }
  return rows;
}

/** The model a request asked for, if the admin allows it right now; otherwise undefined, which means the free default. */
export function pickPrdModel(requested: unknown, policy: PrdPolicy): string | undefined {
  if (typeof requested !== 'string') return undefined;
  return prdModels(policy).find((row) => row.id === requested && row.available)?.id;
}

/** Estimated US$ for one call, from the token counts the provider reported. Free models cost nothing. */
export function estimateCost(model: string, promptTokens: number, completionTokens: number) {
  const price = PAID.find((row) => row.id === model)?.usdPerMillion;
  return price ? (promptTokens * price.input + completionTokens * price.output) / 1_000_000 : 0;
}

export const modelLabel = (id: string) => (id === EXAONE_ID ? 'K-EXAONE 2.5' : id === baseModel() ? '무료 모델' : PAID.find((row) => row.id === id)?.label ?? id);
