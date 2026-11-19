-- Last good PRD per evidence set, so a demo still shows a result when the free model is down.
create table if not exists public.prd_cache (
  evidence_key text primary key,
  input jsonb not null,
  spec jsonb not null,
  created_at timestamptz not null default now()
);

-- No policies on purpose: only the server (service role) reads and writes it.
alter table public.prd_cache enable row level security;
revoke all on public.prd_cache from anon, authenticated;
grant select, insert, update, delete on public.prd_cache to service_role;
