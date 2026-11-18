import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getNewsItems, handleReadError } from './data-catalog';
import type { IngestRejection, IngestRun } from './data-types';

export async function getIngestRuns(limit = 30) {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ingest_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as IngestRun[];
}

export async function getIngestRejections(limit = 40) {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ingest_rejections')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as IngestRejection[];
}

export async function getIngestQualitySummary() {
  const [runs, rejections, news] = await Promise.all([getIngestRuns(), getIngestRejections(120), getNewsItems()]);
  const recentRuns = runs.slice(0, 12);
  const totalInserted = recentRuns.reduce((sum, run) => sum + Number(run.inserted_count ?? 0), 0);
  const totalSkipped = recentRuns.reduce((sum, run) => sum + Number(run.skipped_count ?? 0), 0);
  const sourceMap = new Map<string, { fetched: number; recent: number; inserted: number; skipped: number; rejected: number; quality: number; duplicates: number }>();

  for (const run of recentRuns) {
    const detailResults = Array.isArray(run.detail?.results) ? run.detail.results : [];
    for (const item of detailResults) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { source?: string; fetched?: number; recent?: number; inserted?: number; skipped?: number };
      if (!row.source) continue;
      const current = sourceMap.get(row.source) ?? { fetched: 0, recent: 0, inserted: 0, skipped: 0, rejected: 0, quality: 0, duplicates: 0 };
      current.fetched += Number(row.fetched ?? 0);
      current.recent += Number(row.recent ?? 0);
      current.inserted += Number(row.inserted ?? 0);
      current.skipped += Number(row.skipped ?? 0);
      sourceMap.set(row.source, current);
    }
  }

  for (const rejection of rejections) {
    const current = sourceMap.get(rejection.source) ?? { fetched: 0, recent: 0, inserted: 0, skipped: 0, rejected: 0, quality: 0, duplicates: 0 };
    current.rejected += 1;
    sourceMap.set(rejection.source, current);
  }

  for (const item of news) {
    const source = item.source ?? 'Unknown';
    const current = sourceMap.get(source) ?? { fetched: 0, recent: 0, inserted: 0, skipped: 0, rejected: 0, quality: 0, duplicates: 0 };
    current.quality = Math.max(current.quality, Number(item.source_quality_score ?? 0));
    current.duplicates += Math.max(0, Number(item.duplicate_count ?? 1) - 1);
    sourceMap.set(source, current);
  }

  return {
    totalInserted,
    totalSkipped,
    rejections: rejections.length,
    sources: Array.from(sourceMap.entries())
      .map(([source, value]) => ({ source, ...value }))
      .sort((a, b) => b.inserted + b.rejected - (a.inserted + a.rejected)),
  };
}

export async function getRecommendationQuality() {
  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return { impressions: 0, clicks: 0, clickRate: 0, useful: 0, notRelevant: 0 };
  const [{ data: events }, { data: feedback }] = await Promise.all([
    supabase.from('recommendation_impressions').select('event_type').limit(10000),
    supabase.from('recommendation_feedback').select('feedback').limit(10000),
  ]);
  const impressions = (events ?? []).filter((event) => event.event_type === 'impression').length;
  const clicks = (events ?? []).filter((event) => event.event_type === 'click').length;
  const useful = (feedback ?? []).filter((item) => item.feedback === 'useful').length;
  const notRelevant = (feedback ?? []).filter((item) => item.feedback === 'not_relevant' || item.feedback === 'show_less').length;
  return {
    impressions,
    clicks,
    clickRate: impressions ? Math.round((clicks / impressions) * 100) : 0,
    useful,
    notRelevant,
  };
}
