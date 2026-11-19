import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import {
  addBuildIdeaSignals,
  addImplementationPatternSignals,
  addKnownToolModelSignals,
  addOpenSourceSignal,
  addToolModelSignal,
  addWorkflowSignals,
  buildBars,
  buildNextActions,
  buildSummary,
  buildTrendCandidates,
  buildWhyTrending,
  CATEGORIES,
  DAY_MS,
  dedupeSignals,
  getTrendDirection,
  getTrendStatus,
  getWeeklyGrowthRate,
  inferNewsSourceType,
  inferTargetRoles,
  isGenericTitle,
  isTrendCandidateStrongEnough,
  type KeywordSignalInput,
  legacySourceType,
  normalizeDisplayScore,
  pickTopByCategory,
  repoDisplayName,
  staleTrendKeywords,
} from '@/lib/ingest/trend-builder';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function ingestTrends(request: Request) {
  const startedAt = Date.now();

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase server configuration' }, { status: 500 });
  }

  const [newsResult, productsResult, reposResult, papersResult] = await Promise.all([
    supabase.from('news_items').select('id,title,category,related_skills,topic_tags,skill_tags,intent_tags,project_idea,relevance_score,daily_rank_score,original_url,source,published_at,created_at').order('published_at', { ascending: false }).limit(220),
    supabase.from('ai_products').select('id,name,category,use_cases,topic_tags,skill_tags,related_project_ideas,score,website_url,product_hunt_url,created_at').order('created_at', { ascending: false }).limit(140),
    supabase.from('github_trends').select('id,repo_full_name,repo_url,topics,language,short_summary,beginner_summary,project_idea,relevance_score,stars,stars_delta_7d,pushed_at,created_at').order('stars_delta_7d', { ascending: false, nullsFirst: false }).order('stars', { ascending: false }).limit(180),
    supabase.from('research_papers').select('id,title,categories,related_skills,implementation_idea,service_idea,relevance_score,trend_score,buildability_score,paper_url,published_at,created_at').order('published_at', { ascending: false }).limit(120),
  ]);

  const signals: KeywordSignalInput[] = [];

  for (const item of newsResult.data ?? []) {
    const text = [item.title, item.category, item.project_idea, ...(item.topic_tags ?? []), ...(item.intent_tags ?? []), ...(item.related_skills ?? []), ...(item.skill_tags ?? [])].join(' ');
    const sourceType = inferNewsSourceType(item.source);
    const weight = 12 + Number(item.relevance_score ?? 50) / 10 + Number(item.daily_rank_score ?? 0) / 9;
    const skills = [...(item.related_skills ?? []), ...(item.skill_tags ?? [])];
    addWorkflowSignals(signals, text, weight, sourceType, item.id, item.title, item.original_url, item.published_at ?? item.created_at, skills, [], item.source);
    addImplementationPatternSignals(signals, text, weight * 0.92, sourceType, item.id, item.title, item.original_url, item.published_at ?? item.created_at, skills, [], item.source);
    addBuildIdeaSignals(signals, item.project_idea ?? text, weight * 0.82, sourceType, item.id, item.title, item.original_url, item.published_at ?? item.created_at, skills, [], item.source);
  }

  for (const item of productsResult.data ?? []) {
    const url = item.product_hunt_url ?? item.website_url;
    const text = [item.name, item.category, ...(item.use_cases ?? []), ...(item.topic_tags ?? []), ...(item.related_project_ideas ?? [])].join(' ');
    const weight = 18 + Number(item.score ?? 7);
    const skills = item.skill_tags ?? [];
    addToolModelSignal(signals, item.name, weight * 1.25, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    addKnownToolModelSignals(signals, text, weight, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    addWorkflowSignals(signals, text, weight * 0.75, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    for (const idea of item.related_project_ideas ?? []) {
      addBuildIdeaSignals(signals, idea, weight, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    }
  }

  for (const repo of reposResult.data ?? []) {
    const stars = Number(repo.stars ?? 0);
    const starDelta = Number(repo.stars_delta_7d ?? 0);
    if (stars < 50) continue;

    const displayName = repoDisplayName(repo.repo_full_name);
    const text = [repo.repo_full_name, repo.short_summary, repo.beginner_summary, repo.project_idea, ...(repo.topics ?? [])].join(' ');
    const weight = 18 + Math.min(stars / 800, 16) + Math.min(Math.max(starDelta, 0) / 5, 14) + Number(repo.relevance_score ?? 50) / 18;
    const skills = [repo.language, ...(repo.topics ?? [])].filter(Boolean) as string[];
    const repoDate = repo.created_at ?? repo.pushed_at;
    addOpenSourceSignal(signals, displayName, weight * 1.35, 'github', repo.id, repo.repo_full_name, repo.repo_url, repoDate, skills, [displayName], 'GitHub');
    addKnownToolModelSignals(signals, text, weight * 0.82, 'github', repo.id, repo.repo_full_name, repo.repo_url, repoDate, skills, [displayName], 'GitHub');
    addWorkflowSignals(signals, text, weight * 0.7, 'github', repo.id, repo.repo_full_name, repo.repo_url, repoDate, skills, [displayName], 'GitHub');
    addImplementationPatternSignals(signals, text, weight * 0.9, 'github', repo.id, repo.repo_full_name, repo.repo_url, repoDate, skills, [displayName], 'GitHub');
    addBuildIdeaSignals(signals, repo.project_idea ?? text, weight * 0.82, 'github', repo.id, repo.repo_full_name, repo.repo_url, repoDate, skills, [displayName], 'GitHub');
  }

  for (const paper of papersResult.data ?? []) {
    const text = [paper.title, paper.implementation_idea, paper.service_idea, ...(paper.categories ?? []), ...(paper.related_skills ?? [])].join(' ');
    const weight = 12 + Number(paper.trend_score ?? paper.relevance_score ?? 55) / 9 + Number(paper.buildability_score ?? 0) / 18;
    const skills = paper.related_skills ?? paper.categories ?? [];
    addImplementationPatternSignals(signals, text, weight * 1.18, 'paper', paper.id, paper.title, paper.paper_url, paper.published_at ?? paper.created_at, skills, [], 'arXiv');
    addBuildIdeaSignals(signals, paper.implementation_idea ?? paper.service_idea ?? text, weight, 'paper', paper.id, paper.title, paper.paper_url, paper.published_at ?? paper.created_at, skills, [], 'arXiv');
  }

  const deduplicatedSignals = dedupeSignals(signals);
  const BATCH_SIZE = 200;
  let errors = 0;
  for (let i = 0; i < deduplicatedSignals.length; i += BATCH_SIZE) {
    const batch = deduplicatedSignals.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('keyword_signals')
      .upsert(batch, { onConflict: 'source_type,source_id,normalized_keyword' });
    if (error) {
      const legacyBatch = batch.map((signal) => ({ ...signal, source_type: legacySourceType(signal.source_type) }));
      const retry = /source_type|check constraint|violates/i.test(error.message)
        ? await supabase.from('keyword_signals').upsert(legacyBatch, { onConflict: 'source_type,source_id,normalized_keyword' })
        : { error };
      if (retry.error) {
        errors += 1;
        console.error('Keyword signal upsert batch failed', retry.error);
      }
    }
  }

  const since30Days = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data: storedSignals, error: readError } = await supabase
    .from('keyword_signals')
    .select('keyword,normalized_keyword,source_type,source_id,source_title,source_url,weight,metadata,detected_at')
    .gte('detected_at', since30Days)
    .order('detected_at', { ascending: false })
    .limit(5000);

  if (readError) {
    return NextResponse.json({ error: 'Keyword signal read failed', detail: readError.message }, { status: 500 });
  }

  const candidates = [...buildTrendCandidates(storedSignals ?? []).values()]
    .filter(isTrendCandidateStrongEnough)
    .sort((a, b) => b.score - a.score);

  const maxScore = Math.max(1, ...candidates.map((candidate) => candidate.score));
  const rankedCandidates = pickTopByCategory(candidates, 30);
  const ranked = rankedCandidates.map((candidate, index) => {
    const displayScore = normalizeDisplayScore(candidate.score, maxScore);
    const previousScore = candidate.previousSourceKeys.size
      ? normalizeDisplayScore(candidate.previousSourceKeys.size * 18 + candidate.signalStrength * 0.15, maxScore)
      : 0;
    const weeklyGrowthRate = getWeeklyGrowthRate(candidate.recentSourceKeys.size, candidate.previousSourceKeys.size);
    const trendDirection = getTrendDirection(weeklyGrowthRate, previousScore === 0 && candidate.recentSourceKeys.size > 0);
    const status = getTrendStatus(displayScore, weeklyGrowthRate, candidate.sourceKeys.size, trendDirection === 'new');
    return { candidate, rank: index + 1, displayScore, previousScore, weeklyGrowthRate, trendDirection, status };
  });

  const today = new Date().toISOString().slice(0, 10);
  const since6Days = new Date(Date.now() - 6 * DAY_MS).toISOString().slice(0, 10);
  const rankedKeywords = ranked.map((item) => item.candidate.displayName);
  const historyByKeyword = new Map<string, number[]>();
  if (rankedKeywords.length) {
    const { data: priorSnapshots } = await supabase
      .from('trend_snapshots')
      .select('keyword,snapshot_date,score')
      .in('keyword', rankedKeywords)
      .gte('snapshot_date', since6Days)
      .lt('snapshot_date', today)
      .order('snapshot_date', { ascending: true });
    for (const row of (priorSnapshots ?? []) as Array<{ keyword: string; score: number | null }>) {
      const scores = historyByKeyword.get(row.keyword) ?? [];
      scores.push(Number(row.score ?? 0));
      historyByKeyword.set(row.keyword, scores);
    }
  }

  let upserted = 0;
  for (const item of ranked) {
    const { candidate } = item;
    const realBars = buildBars([...(historyByKeyword.get(candidate.displayName) ?? []), item.displayScore]);
    const payload = {
      keyword: candidate.displayName,
      display_name: candidate.displayName,
      normalized_name: candidate.normalizedName,
      entity_type: candidate.entityType,
      rank: item.rank,
      trend_type: candidate.entityType,
      category: candidate.category,
      summary: buildSummary(candidate),
      raw_score: Number(candidate.score.toFixed(2)),
      display_score: item.displayScore,
      previous_score: item.previousScore,
      weekly_growth_rate: item.weeklyGrowthRate,
      trend_direction: item.trendDirection,
      score: item.displayScore,
      status: item.status,
      bars: realBars,
      why_trending: buildWhyTrending(candidate, item.weeklyGrowthRate, item.trendDirection === 'new'),
      related_skills: [...candidate.relatedSkills].filter((skill) => !isGenericTitle(skill)).slice(0, 10),
      related_tools: [...candidate.relatedTools].filter((tool) => !isGenericTitle(tool)).slice(0, 8),
      target_roles: inferTargetRoles(candidate.category, candidate.entityType),
      project_ideas: buildNextActions(candidate).slice(0, 5),
      sources_count: candidate.sourceKeys.size,
      news_count: candidate.news,
      product_count: candidate.products,
      github_repo_count: candidate.repos,
      paper_count: candidate.papers,
      source_mix: candidate.sourceMix,
      detected_sources: candidate.refs.slice(0, 12),
      source_refs: candidate.refs.slice(0, 12),
    };
    const result = await supabase.from('trends').upsert(payload, { onConflict: 'keyword' });
    const fallbackPayload = {
      keyword: payload.keyword,
      rank: payload.rank,
      trend_type: payload.trend_type,
      category: payload.category,
      summary: payload.summary,
      score: payload.score,
      status: payload.status,
      bars: payload.bars,
      project_ideas: payload.project_ideas,
      sources_count: payload.sources_count,
      news_count: payload.news_count,
      product_count: payload.product_count,
      github_repo_count: payload.github_repo_count,
      paper_count: payload.paper_count,
      source_refs: payload.source_refs,
    };
    const fallbackResult = result.error && /column|schema|paper_count|trend_type|display_score|weekly_growth_rate|entity_type|display_name|normalized_name|source_mix|detected_sources/i.test(result.error.message)
      ? await supabase.from('trends').upsert(fallbackPayload, { onConflict: 'keyword' })
      : result;

    if (fallbackResult.error) {
      errors += 1;
      console.error('Trend upsert failed', candidate.displayName, fallbackResult.error);
    } else {
      upserted += 1;
    }
  }

  let pruned = 0;
  if (upserted > 0 && errors === 0) {
    const { data: existingRows, error: listError } = await supabase.from('trends').select('keyword');
    if (listError) {
      console.error('Failed to list existing trends for pruning', listError);
    } else {
      const stale = staleTrendKeywords(
        ((existingRows ?? []) as Array<{ keyword: string }>).map((row) => row.keyword),
        rankedKeywords,
      );
      for (let i = 0; i < stale.length; i += 100) {
        const chunk = stale.slice(i, i + 100);
        const { error: deleteError } = await supabase.from('trends').delete().in('keyword', chunk);
        if (deleteError) {
          console.error('Failed to prune stale trends', deleteError);
        } else {
          pruned += chunk.length;
        }
      }
    }
  }

  const snapshotPayload = ranked.slice(0, 150).map(({ candidate, displayScore }) => ({
    keyword: candidate.displayName,
    snapshot_date: today,
    score: displayScore,
    signal_count: candidate.sourceKeys.size,
    news_count: candidate.news,
    product_count: candidate.products,
    github_repo_count: candidate.repos,
    paper_count: candidate.papers,
    source_refs: candidate.refs.slice(0, 8),
  }));
  const snapshotResult = await supabase.from('trend_snapshots').upsert(snapshotPayload, { onConflict: 'keyword,snapshot_date' });
  const fallbackSnapshotResult = snapshotResult.error && /column|schema|paper_count/i.test(snapshotResult.error.message)
    ? await supabase.from('trend_snapshots').upsert(snapshotPayload.map(({ paper_count, ...snapshot }) => snapshot), { onConflict: 'keyword,snapshot_date' })
    : snapshotResult;

  if (fallbackSnapshotResult.error) {
    errors += 1;
    console.error('Trend snapshot upsert failed', fallbackSnapshotResult.error);
  }

  await recordIngestRun(supabase, {
    source: 'trends',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped: Math.max(0, candidates.length - ranked.length),
    errors,
    durationMs: Date.now() - startedAt,
    detail: { signals: signals.length, deduplicated: deduplicatedSignals.length, ranked: ranked.length, pruned, categories: CATEGORIES },
  });

  return NextResponse.json({ ok: errors === 0, signals: signals.length, upserted, pruned, errors, ranked: ranked.length });
}
