import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelUsage } from '../llm';
import { estimateCost } from './models';

export type PrdRunKind = 'prd' | 'revise' | 'slots';

/**
 * Collects the token usage of one PRD request and writes one row per request to prd_runs, so an admin can see who ran
 * which model and what it cost. Logging never blocks or fails the request itself.
 */
export function prdRunLog(service: SupabaseClient | null, user: { id: string; email?: string | null }, kind: PrdRunKind, chosen: string) {
  const startedAt = Date.now();
  const calls: ModelUsage[] = [];
  return {
    onUsage: (usage: ModelUsage) => {
      calls.push(usage);
    },
    async finish(ok: boolean, title: string) {
      if (!service) return;
      const promptTokens = calls.reduce((sum, call) => sum + call.promptTokens, 0);
      const completionTokens = calls.reduce((sum, call) => sum + call.completionTokens, 0);
      const cost = calls.reduce((sum, call) => sum + estimateCost(call.model, call.promptTokens, call.completionTokens), 0);
      // The model that actually answered last; a failed paid model falls back to the free one, and the row says so.
      const answered = calls.at(-1)?.model ?? chosen;
      const { error } = await service.from('prd_runs').insert({
        user_id: user.id,
        email: user.email ?? null,
        kind,
        model: answered,
        requested_model: chosen,
        title: title.slice(0, 160),
        ok,
        calls: calls.length,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: Number(cost.toFixed(5)),
        duration_ms: Date.now() - startedAt,
      });
      if (error) console.error('prd run not logged:', error.message);
    },
  };
}

export type PrdRunRow = { created_at: string; email: string | null; kind: PrdRunKind; model: string; requested_model: string; title: string; ok: boolean; prompt_tokens: number; completion_tokens: number; cost_usd: number; duration_ms: number };

export async function recentPrdRuns(service: SupabaseClient | null, limit = 60): Promise<PrdRunRow[]> {
  if (!service) return [];
  const { data, error } = await service.from('prd_runs').select('created_at,email,kind,model,requested_model,title,ok,prompt_tokens,completion_tokens,cost_usd,duration_ms').order('created_at', { ascending: false }).limit(limit);
  return error ? [] : (data ?? []) as PrdRunRow[];
}
