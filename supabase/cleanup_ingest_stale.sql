-- Seedup ingest cleanup helpers.
-- Review each section before running. These statements are intentionally scoped
-- to logs, stale signals, rejected rows, duplicates, and failed partial rows.

-- 1) Remove old ingest logs/rejections. Keep the last 14 days for debugging.
delete from public.ingest_rejections
where created_at < now() - interval '14 days';

delete from public.ingest_runs
where created_at < now() - interval '14 days';

-- 2) Remove stale trend signal cache. Trends are recalculated from fresh sources.
delete from public.keyword_signals
where detected_at < now() - interval '45 days';

delete from public.trend_snapshots
where snapshot_date < current_date - interval '45 days';

-- 3) Remove news rows that were inserted during failed/old runs but never processed.
-- Keep recent rows because an active run may still be working.
delete from public.news_items
where processed_at is null
  and created_at < now() - interval '1 day';

-- 4) Remove hard-rejected source URLs if they were accidentally inserted before
-- the rejection was recorded.
delete from public.news_items n
using public.ingest_rejections r
where n.original_url = r.original_url
  and r.reason in (
    'hard_excluded_keyword',
    'keyword_score_too_low',
    'rank_score_too_low',
    'metadata_summary_too_short',
    'metadata_key_points_too_few',
    'metadata_routing_missing',
    'article_summary_too_short',
    'article_key_points_too_few'
  )
  and r.created_at > now() - interval '30 days';

-- 5) Deduplicate by original_url, keeping the newest/highest ranked row.
with ranked as (
  select
    id,
    row_number() over (
      partition by original_url
      order by daily_rank_score desc nulls last, processed_at desc nulls last, created_at desc
    ) as duplicate_rank
  from public.news_items
  where original_url is not null
)
delete from public.news_items n
using ranked r
where n.id = r.id
  and r.duplicate_rank > 1;

-- 6) Deduplicate by canonical_key, keeping the newest/highest ranked row.
with ranked as (
  select
    id,
    row_number() over (
      partition by canonical_key
      order by daily_rank_score desc nulls last, processed_at desc nulls last, created_at desc
    ) as duplicate_rank
  from public.news_items
  where canonical_key is not null
)
delete from public.news_items n
using ranked r
where n.id = r.id
  and r.duplicate_rank > 1;

-- 7) Recalculate duplicate counters after cleanup.
with grouped as (
  select canonical_key, count(*)::integer as duplicate_count
  from public.news_items
  where canonical_key is not null
  group by canonical_key
)
update public.news_items n
set
  duplicate_group_key = n.canonical_key,
  duplicate_count = grouped.duplicate_count
from grouped
where n.canonical_key = grouped.canonical_key;

-- Optional: full reset for derived trend tables only.
-- Use this when trend ranking looks polluted and you plan to rerun /api/ingest/trends.
--
-- truncate table public.keyword_signals restart identity;
-- truncate table public.trend_snapshots restart identity;
-- delete from public.trends;
