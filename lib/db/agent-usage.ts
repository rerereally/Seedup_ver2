import type { SupabaseClient } from '@supabase/supabase-js';
import { saveDossier } from '@/lib/db/dossiers';
import { userForToken } from '@/lib/mcp/auth';
import type { PrdRunRow } from '@/lib/opportunities/prd-runs';
import type { BuildProgress, BuildProgressHistory } from '@/lib/opportunities/build-progress';
import { LOWER_TIERS, priceFor, tokenCost, TOP_MODEL, type TokenCounts } from '@/lib/pricing';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SuccessCriterion } from '@/lib/supervisor/types';

const PROJECT = /^(?:prd:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[a-z0-9][a-z0-9-]{0,119})$/;
const RUN_KEY = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SESSION = /^[a-zA-Z0-9_-]{1,128}$/;
const MODEL = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,123}(?:\[1m\])?$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const UPLOADS_PER_DAY = 500;
const MAX_ROWS = 500;
const MAX_BYTES = 256 * 1024;

export type UsageRow = TokenCounts & { ts: string; model: string };
type Upload = { project: string; source: 'claude_code' | 'codex'; session_id: string; rows: UsageRow[] };

function objectWithKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key)));
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}

function parseUpload(body: unknown): Upload | null {
  if (!objectWithKeys(body, ['project', 'source', 'session_id', 'rows'])) return null;
  const { project, source, session_id, rows } = body;
  if (typeof project !== 'string' || !PROJECT.test(project) || (source !== 'claude_code' && source !== 'codex')
    || typeof session_id !== 'string' || !SESSION.test(session_id) || !Array.isArray(rows) || !rows.length || rows.length > MAX_ROWS) return null;
  const checked = new Map<string, UsageRow>();
  for (const row of rows) {
    if (!objectWithKeys(row, ['ts', 'model', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens'])) return null;
    const { ts, model, input_tokens, output_tokens, cache_read_tokens = 0, cache_write_tokens = 0 } = row;
    if (typeof ts !== 'string' || !INSTANT.test(ts) || !Number.isFinite(Date.parse(ts))
      || new Date(ts.slice(0, 10)).toISOString().slice(0, 10) !== ts.slice(0, 10)
      || typeof model !== 'string' || !MODEL.test(model) || !isCount(input_tokens) || !isCount(output_tokens)
      || !isCount(cache_read_tokens) || !isCount(cache_write_tokens)) return null;
    // Keep microseconds from the source, but canonicalize offsets and fractional padding for duplicate rows in a batch.
    const micros = (ts.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0');
    const instant = new Date(ts).toISOString().replace(/\.\d{3}Z$/, `.${micros}Z`);
    const key = `${instant}/${model}`;
    if (!checked.has(key)) checked.set(key, { ts: instant, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens });
  }
  return { project, source, session_id, rows: [...checked.values()] };
}

async function readUpload(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '';
    let bytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return parseUpload(JSON.parse(text + decoder.decode()));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function uploadAgentUsage(request: Request, service = createAdminClient()) {
  const fail = (status: number, error: string) => ({ status, body: { error } });
  if (!service) return fail(503, 'usage_unavailable');
  const userId = await userForToken(service, request.headers.get('authorization'));
  if (!userId) return fail(401, 'invalid_token');
  const upload = await readUpload(request);
  if (!upload) return fail(400, 'invalid_usage');
  const { project, source, session_id, rows } = upload;
  const owned = await service.from('supervisor_projects').select('project_key').eq('user_id', userId).eq('project_key', project).maybeSingle();
  if (owned.error) return fail(503, 'usage_unavailable');
  if (!owned.data) return fail(404, 'project_not_found');
  const limit = await service.rpc('consume_ai_usage_for', { p_user: userId, p_feature: 'agent_usage', p_daily_limit: UPLOADS_PER_DAY });
  if (limit.error) return fail(503, 'usage_unavailable');
  if (limit.data !== true) return fail(429, 'usage_limit');
  const { error } = await service.from('agent_usage').upsert(
    rows.map((row) => ({ ...row, user_id: userId, project_key: project, source, session_id })),
    { onConflict: 'user_id,source,session_id,ts,model', ignoreDuplicates: true },
  );
  return error ? fail(503, 'usage_unavailable') : { status: 200, body: { ok: true } };
}

export async function writePrdRun(service: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await service.from('prd_runs').insert(row);
  if (!error || !['PGRST204', '42703'].includes(error.code) || !/\b(run_key|project_key|cost_complete)\b/.test(error.message)) {
    return { error, hasRunKey: !error };
  }
  // The app and migration can be deployed separately. Keep the existing run log in the old schema.
  const legacy = { ...row };
  delete legacy.run_key;
  delete legacy.project_key;
  delete legacy.cost_complete;
  const fallback = await service.from('prd_runs').insert(legacy);
  return { error: fallback.error, hasRunKey: false };
}

/** With run keys, save and attribution succeed or fail together. Plain dossier saves retain their existing path. */
export async function saveDossierUsage(
  client: SupabaseClient, userId: string, row: Record<string, unknown>, value: unknown,
  projectSlug: string | null, draftId: string | null = null, service = createAdminClient(),
) {
  const keys = Array.isArray(value) ? [...new Set(value.slice(0, 1000).filter((key): key is string => typeof key === 'string' && RUN_KEY.test(key)))] : [];
  if (!keys.length && !draftId) return saveDossier(client, { ...row, user_id: userId });
  if (!service) return { data: null, error: { message: 'PRD usage store unavailable' } };
  const { data, error } = await service.rpc('save_dossier_with_usage', {
    p_user_id: userId, p_dossier: row, p_run_keys: keys, p_project_slug: projectSlug, p_draft_id: draftId,
  });
  return { data: data ? { id: String(data) } : null, error };
}

type PrdUsage = { prompt_tokens: number; completion_tokens: number; cost_usd: number; cost_complete: boolean | null };
type VerificationUsage = { input_tokens: number; output_tokens: number; cost_usd: number; model: string | null };
type UsageTotals = { tokens: number; cost: number; savings: number; unpriced: number };

// Postgres and Codex emit sub-millisecond timestamps; preserve their ordering at feature boundaries.
function preciseTime(ts: string) {
  const micros = (ts.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0');
  return Date.parse(ts) * 1000 + Number(micros.slice(3, 6));
}

const emptyTotals = (): UsageTotals => ({ tokens: 0, cost: 0, savings: 0, unpriced: 0 });

function addTotals(total: UsageTotals, row: UsageTotals) {
  total.tokens += row.tokens;
  total.cost += row.cost;
  total.savings += row.savings;
  total.unpriced += row.unpriced;
}

export function summarizeProjectUsage(
  rows: UsageRow[], history: BuildProgressHistory, progress: BuildProgress, criteria: SuccessCriterion[],
  runs: PrdUsage[], verifications: VerificationUsage[], now = Date.now(),
) {
  const features = new Map<string, { total: UsageTotals; tiers: Set<string | undefined> }>();
  const intervals: { id: string; start: number; end: number }[] = [];
  for (const [id, events] of Object.entries(history)) {
    let start: number | undefined;
    for (const event of [...events].sort((a, b) => preciseTime(a.createdAt) - preciseTime(b.createdAt))) {
      const at = preciseTime(event.createdAt);
      if (event.status === 'in_progress') start ??= at;
      if (event.status === 'done' || event.status === 'todo') {
        if (start !== undefined) intervals.push({ id, start, end: at });
        start = undefined;
      }
    }
    if (start !== undefined) intervals.push({ id, start, end: now * 1000 });
  }
  const agent = emptyTotals();
  const unmapped = emptyTotals();
  const overlapping = new Set<string>();
  for (const row of rows) {
    const cost = tokenCost(row.model, row);
    const baseline = tokenCost(TOP_MODEL, row)!;
    const total = {
      tokens: row.input_tokens + row.output_tokens + (row.cache_read_tokens ?? 0) + (row.cache_write_tokens ?? 0),
      cost: cost ?? 0, savings: cost === null ? 0 : baseline - cost, unpriced: cost === null ? 1 : 0,
    };
    addTotals(agent, total);
    const at = preciseTime(row.ts);
    const active = intervals.filter((interval) => at >= interval.start && at < interval.end);
    if (active.length !== 1) {
      if (total.tokens) for (const { id } of active) overlapping.add(id);
      addTotals(unmapped, total);
      continue;
    }
    const { id } = active[0];
    const feature = features.get(id) ?? { total: emptyTotals(), tiers: new Set<string | undefined>() };
    addTotals(feature.total, total);
    if (total.tokens) feature.tiers.add(priceFor(row.model)?.tier);
    features.set(id, feature);
  }
  const seedup = emptyTotals();
  for (const run of runs) {
    seedup.tokens += run.prompt_tokens + run.completion_tokens;
    seedup.cost += Number(run.cost_usd);
    if (!run.cost_complete && run.prompt_tokens + run.completion_tokens > 0) seedup.unpriced++;
  }
  for (const row of verifications) {
    const tokens = row.input_tokens + row.output_tokens;
    seedup.tokens += tokens;
    seedup.cost += Number(row.cost_usd);
    // The verifier can try more than one model and stores only its last model. A legacy zero with measured usage has no recorded price.
    if (tokens && Number(row.cost_usd) === 0 && tokenCost(row.model ?? '', row) !== 0) seedup.unpriced++;
  }
  const total = { ...agent };
  addTotals(total, seedup);
  const criterionTotals = criteria.map(({ id, text, featureIds }) => {
    const total = emptyTotals();
    for (const id of new Set(featureIds)) {
      const feature = features.get(id);
      if (feature) addTotals(total, feature.total);
    }
    return { id, title: text, total };
  });
  return {
    total, seedup, unmapped, criteria: criterionTotals,
    features: [...features].map(([id, { total }]) => ({
      id, total,
      tier: LOWER_TIERS.find((tier) => [...features].filter(([other, sample]) =>
        other !== id && !overlapping.has(other) && progress[other]?.status === 'done' && progress[other]?.verificationLevel === 'supervisor_verified'
        && sample.total.tokens >= total.tokens && sample.tiers.size === 1 && sample.tiers.has(tier),
      ).length >= 3 && total.tokens > 0),
    })),
  };
}

async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query(offset, offset + pageSize - 1);
    if (error || !data) throw new Error('Project usage unavailable');
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export async function projectUsage(
  client: SupabaseClient, userId: string, key: string, progress: BuildProgress, criteria: SuccessCriterion[],
  service = createAdminClient(),
) {
  if (!service) return null;
  const [agent, runs, checks, events] = await Promise.all([
    allRows<UsageRow>((from, to) => client.from('agent_usage').select('ts,model,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens')
      .eq('user_id', userId).eq('project_key', key).order('ts').order('source').order('session_id').order('model').range(from, to)),
    allRows<PrdUsage>((from, to) => service.from('prd_runs').select('prompt_tokens,completion_tokens,cost_usd,cost_complete')
      .eq('user_id', userId).eq('project_key', key).order('id').range(from, to)),
    allRows<VerificationUsage>((from, to) => client.from('verifications').select('input_tokens,output_tokens,cost_usd,model')
      .eq('user_id', userId).eq('project_key', key).order('created_at').order('id').range(from, to)),
    allRows<{ id: string; feature_id: string; status: BuildProgressHistory[string][number]['status']; created_at: string }>((from, to) =>
      client.from('build_progress_events').select('id,feature_id,status,created_at')
        .eq('user_id', userId).eq('slug', key).order('created_at').order('id').range(from, to)),
  ]);
  const history: BuildProgressHistory = Object.create(null);
  for (const row of events) {
    (history[row.feature_id] ??= []).push({ id: row.id, status: row.status, note: '', createdAt: row.created_at });
  }
  return summarizeProjectUsage(agent, history, progress, criteria, runs, checks);
}

export async function recentPrdRuns(service: SupabaseClient | null, limit = 60): Promise<PrdRunRow[]> {
  if (!service) return [];
  const { data, error } = await service.from('prd_runs').select('created_at,email,kind,model,requested_model,title,ok,prompt_tokens,completion_tokens,cost_usd,duration_ms').order('created_at', { ascending: false }).limit(limit);
  return error ? [] : (data ?? []) as PrdRunRow[];
}
