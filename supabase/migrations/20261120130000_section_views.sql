create table if not exists public.section_views (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  signed_in boolean not null,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (signed_in = (user_id is not null))
);

create index if not exists section_views_created_at_id_idx on public.section_views (created_at, id);
create index if not exists section_views_user_id_idx on public.section_views (user_id) where user_id is not null;

-- Match prd_runs: the reporting script reads via the service role, with no public or authenticated access.
alter table public.section_views enable row level security;
revoke all on public.section_views from public, anon, authenticated, service_role;
grant select, insert on public.section_views to service_role;
