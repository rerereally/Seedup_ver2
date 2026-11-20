-- Drift detection input (docs/supervisor-plan.md 3-6, stage 2 fix 4): store per-file status
-- (added | modified | deleted) alongside files[] so findDrift can inspect newly added screens and API routes.
alter table public.feature_commits
  add column if not exists file_statuses jsonb not null default '{}'::jsonb
  check (jsonb_typeof(file_statuses) = 'object');
