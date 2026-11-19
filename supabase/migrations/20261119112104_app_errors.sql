-- Server errors, recorded by instrumentation.ts and counted by scripts/check-app-errors.ts so a failing page or API
-- is noticed within hours. Only the path (no query string), the route and the error message are kept; nothing
-- about the visitor. Safe to run more than once.
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null,
  method text not null,
  route text,
  kind text,
  message text not null,
  digest text
);

create index if not exists app_errors_created_at on public.app_errors (created_at desc);

-- Written and read only with the service key; no policy means no access for visitors.
alter table public.app_errors enable row level security;

-- Old rows are not needed once a day's check has run; keep two weeks for looking back.
delete from public.app_errors where created_at < now() - interval '14 days';
