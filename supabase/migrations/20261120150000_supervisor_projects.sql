-- Goal-centred supervision (docs/supervisor-plan.md 3-1, 3-3, 3-11): one project per user and key ('<slug>' or
-- 'prd:<dossier id>'), every locked goal kept as a version, and the shared memory agents and people read back
-- (decisions, handoffs, project facts). Users read their own rows; only the server (service role) writes.

create table if not exists public.supervisor_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_key text not null check (char_length(project_key) between 1 and 160),
  repo text,
  track text not null default 'personal' check (track in ('personal', 'launch')),
  strict boolean not null default false,
  goal_version integer check (goal_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, project_key)
);

create table if not exists public.project_goals (
  user_id uuid not null,
  project_key text not null,
  version integer not null check (version > 0),
  track text not null check (track in ('personal', 'launch')),
  statement text not null,
  criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria) = 'array'),
  in_scope text[] not null default '{}',
  out_of_scope text[] not null default '{}',
  change_reason text,
  locked_at timestamptz not null default now(),
  primary key (user_id, project_key, version),
  foreign key (user_id, project_key) references public.supervisor_projects(user_id, project_key) on delete cascade
);

create table if not exists public.project_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_key text not null,
  kind text not null check (kind in ('decision', 'handoff', 'fact')),
  body jsonb not null check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 8000),
  created_at timestamptz not null default now(),
  foreign key (user_id, project_key) references public.supervisor_projects(user_id, project_key) on delete cascade
);

create index if not exists project_memory_recent_idx on public.project_memory (user_id, project_key, kind, created_at desc);

alter table public.supervisor_projects enable row level security;
alter table public.project_goals enable row level security;
alter table public.project_memory enable row level security;

drop policy if exists "read own supervisor projects" on public.supervisor_projects;
create policy "read own supervisor projects" on public.supervisor_projects
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own project goals" on public.project_goals;
create policy "read own project goals" on public.project_goals
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own project memory" on public.project_memory;
create policy "read own project memory" on public.project_memory
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.supervisor_projects, public.project_goals, public.project_memory from public, anon, authenticated;
grant select on public.supervisor_projects, public.project_goals, public.project_memory to authenticated;
grant select, insert, update, delete on public.supervisor_projects, public.project_goals, public.project_memory to service_role;

-- Locks the next goal version in one transaction, so two saves at once cannot take the same version or leave the
-- project pointing at an older one. A change after the first version needs a reason (plan 3-1).
create or replace function public.lock_project_goal(
  p_user_id uuid, p_project_key text, p_track text, p_statement text, p_criteria jsonb,
  p_in_scope text[], p_out_of_scope text[], p_change_reason text
)
returns public.project_goals
language plpgsql
set search_path = ''
as $$
declare
  v_version integer;
  v_goal public.project_goals;
begin
  insert into public.supervisor_projects (user_id, project_key, track)
  values (p_user_id, p_project_key, p_track)
  on conflict (user_id, project_key) do nothing;

  select coalesce(p.goal_version, 0) + 1 into v_version
  from public.supervisor_projects p
  where p.user_id = p_user_id and p.project_key = p_project_key
  for update;

  if v_version > 1 and coalesce(btrim(p_change_reason), '') = '' then
    raise exception 'change_reason_required' using errcode = '22023';
  end if;

  insert into public.project_goals (user_id, project_key, version, track, statement, criteria, in_scope, out_of_scope, change_reason)
  values (p_user_id, p_project_key, v_version, p_track, p_statement, p_criteria, p_in_scope, p_out_of_scope, nullif(btrim(p_change_reason), ''))
  returning * into v_goal;

  update public.supervisor_projects
  set goal_version = v_version, track = p_track, updated_at = now()
  where user_id = p_user_id and project_key = p_project_key;

  return v_goal;
end;
$$;

revoke execute on function public.lock_project_goal(uuid, text, text, text, jsonb, text[], text[], text) from public, anon, authenticated;
grant execute on function public.lock_project_goal(uuid, text, text, text, jsonb, text[], text[], text) to service_role;
