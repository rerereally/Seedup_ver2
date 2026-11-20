-- Stage 2 B1: server-only verdicts for immutable public commits. No raw diff, file bodies or API credentials.
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_key text not null,
  feature_id text not null check (char_length(feature_id) between 1 and 160),
  repo text not null,
  sha text not null check (sha ~ '^[0-9a-f]{40}$'),
  status text not null check (status in ('queued', 'running', 'passed', 'failed', 'blocked', 'error')),
  findings jsonb not null default '[]'::jsonb check (jsonb_typeof(findings) = 'array'),
  verdicts jsonb not null default '[]'::jsonb check (jsonb_typeof(verdicts) = 'array'),
  drift jsonb not null default '[]'::jsonb check (jsonb_typeof(drift) = 'array'),
  checks jsonb not null default '[]'::jsonb check (jsonb_typeof(checks) = 'array'),
  unseen jsonb not null default '[]'::jsonb check (jsonb_typeof(unseen) = 'array'),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric not null default 0 check (cost_usd >= 0),
  token text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (user_id, project_key) references public.supervisor_projects(user_id, project_key) on delete cascade,
  unique (user_id, project_key, feature_id, repo, sha),
  check ((status = 'passed') = (token is not null)),
  check ((status in ('queued', 'running')) = (finished_at is null))
);

create index if not exists verifications_recent_idx on public.verifications (user_id, project_key, created_at desc);
alter table public.verifications enable row level security;
drop policy if exists "read own verifications" on public.verifications;
create policy "read own verifications" on public.verifications
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.verifications from public, anon, authenticated;
grant select on public.verifications to authenticated;
grant select, insert, update, delete on public.verifications to service_role;
