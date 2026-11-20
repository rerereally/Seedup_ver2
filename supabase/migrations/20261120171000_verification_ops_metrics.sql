-- Stage 2 F6: record per-verification GitHub request count, elapsed duration (ms), and safe error reason for p50/p95 and policy-failure reporting.
-- Safe to run more than once.
alter table public.verifications
  add column if not exists github_requests integer not null default 0 check (github_requests >= 0),
  add column if not exists duration_ms integer check (duration_ms is null or duration_ms >= 0),
  add column if not exists error_message text;
