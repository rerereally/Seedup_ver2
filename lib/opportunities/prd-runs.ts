import { randomUUID } from 'node:crypto';
import { writePrdRun } from '@/lib/db/agent-usage';
import { priceFor } from '../pricing';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelUsage } from '../llm';
import { estimateCost } from './models';

export { recentPrdRuns } from '@/lib/db/agent-usage';

export type PrdRunKind = 'prd' | 'revise' | 'slots' | 'report';

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
    async finish(ok: boolean, title: string, writerModel?: string, projectKey?: string | null) {
      if (!service) return;
      const promptTokens = calls.reduce((sum, call) => sum + call.promptTokens, 0);
      const completionTokens = calls.reduce((sum, call) => sum + call.completionTokens, 0);
      const cost = calls.reduce((sum, call) => sum + estimateCost(call.model, call.promptTokens, call.completionTokens), 0);
      // Full PRD runs can name the writer even when a different model answered an auxiliary call later.
      const answered = writerModel ?? calls.at(-1)?.model ?? chosen;
      const runKey = randomUUID();
      const { error, hasRunKey } = await writePrdRun(service, {
        run_key: runKey,
        project_key: projectKey ?? null,
        cost_complete: calls.every((call) => priceFor(call.model) !== null || !(call.promptTokens || call.completionTokens)),
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
      }).catch((error: unknown) => ({ error: { message: String(error) }, hasRunKey: false }));
      if (error) {
        console.error('prd run not logged:', error.message);
        return;
      }
      return hasRunKey ? runKey : undefined;
    },
  };
}

export type PrdRunRow = { created_at: string; email: string | null; kind: PrdRunKind; model: string; requested_model: string; title: string; ok: boolean; prompt_tokens: number; completion_tokens: number; cost_usd: number; duration_ms: number };
