-- PRD model menu: which models the admin allows, and a log of who ran which model. Safe to run more than once.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.prd_runs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  kind text not null,
  model text not null,
  requested_model text not null,
  title text,
  ok boolean not null,
  calls int not null default 0,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  duration_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists prd_runs_created_at_idx on public.prd_runs (created_at desc);

-- No policies on purpose: only the server (service role) reads and writes these.
alter table public.app_settings enable row level security;
alter table public.prd_runs enable row level security;
revoke all on public.app_settings, public.prd_runs from anon, authenticated;
grant select, insert, update, delete on public.app_settings, public.prd_runs to service_role;

-- To make an account an admin from Supabase (instead of, or as well as, the ADMIN_EMAILS setting), run with the email:
-- update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}' where email = 'you@example.com';
-- Users cannot edit app metadata themselves, so this is safe. The change applies at that account's next sign-in.
