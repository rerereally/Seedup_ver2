import type { SupabaseClient } from '@supabase/supabase-js';

type RunStatus = 'success' | 'partial' | 'failed';

export async function recordIngestRun(
  supabase: SupabaseClient,
  input: {
    source: string;
    status: RunStatus;
    inserted?: number;
    skipped?: number;
    errors?: number;
    durationMs: number;
    detail?: unknown;
  },
) {
  const { error } = await supabase.from('ingest_runs').insert({
    source: input.source,
    status: input.status,
    inserted_count: input.inserted ?? 0,
    skipped_count: input.skipped ?? 0,
    error_count: input.errors ?? 0,
    duration_ms: input.durationMs,
    detail: input.detail ?? {},
  });

  if (error) {
    console.error('Ingest run log failed', input.source, error);
  }
}

export function getRunStatus(errors: number, inserted = 0, skipped = 0): RunStatus {
  if (errors > 0 && inserted === 0) return 'failed';
  if (inserted === 0 && skipped > 0) return 'partial';
  if (errors > 0) return 'partial';
  return 'success';
}
