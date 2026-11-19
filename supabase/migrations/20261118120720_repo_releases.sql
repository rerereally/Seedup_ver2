-- The latest GitHub release of each collected repository, filled for repositories someone kept.
-- Run once in the Supabase SQL editor.
alter table public.github_trends add column if not exists latest_release jsonb;
