alter table public.build_progress
  add column if not exists status text not null default 'done'
    check (status in ('todo', 'in_progress', 'improving', 'done', 'blocked', 'needs_recheck')),
  add column if not exists updated_at timestamptz not null default now(),
  alter column done_at drop not null;

create table if not exists public.build_progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  feature_id text not null,
  status text not null check (status in ('todo', 'in_progress', 'improving', 'done', 'blocked', 'needs_recheck')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists build_progress_events_user_slug_created_idx
  on public.build_progress_events (user_id, slug, created_at desc);

alter table public.build_progress_events enable row level security;
drop policy if exists "read own build progress events" on public.build_progress_events;
create policy "read own build progress events" on public.build_progress_events
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.build_progress_events from public, anon, authenticated;
grant select on public.build_progress_events to authenticated;
grant select, insert, update, delete on public.build_progress_events to service_role;

-- Keep the status and its history in one transaction, and only notify on entry into blocked.
create or replace function public.write_build_progress(
  p_user_id uuid, p_slug text, p_feature_id text, p_feature_title text, p_status text, p_note text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  previous_status text;
  changed_at timestamptz := clock_timestamp();
begin
  insert into public.build_progress (user_id, slug, feature_id, feature_title, status, note, updated_at, done_at)
  values (p_user_id, p_slug, p_feature_id, p_feature_title, p_status, p_note, changed_at,
    case when p_status = 'done' then changed_at end)
  on conflict (user_id, slug, feature_id) do nothing;

  if not found then
    select status into strict previous_status
    from public.build_progress
    where user_id = p_user_id and slug = p_slug and feature_id = p_feature_id
    for update;

    changed_at := clock_timestamp();
    update public.build_progress
    set feature_title = p_feature_title, status = p_status, note = p_note, updated_at = changed_at,
      done_at = case when p_status = 'done' and previous_status <> 'done' then changed_at else done_at end
    where user_id = p_user_id and slug = p_slug and feature_id = p_feature_id;
  end if;

  insert into public.build_progress_events (user_id, slug, feature_id, status, note, created_at)
  values (p_user_id, p_slug, p_feature_id, p_status, p_note, changed_at);

  return p_status = 'blocked' and previous_status is distinct from 'blocked';
end;
$$;

revoke all on function public.write_build_progress(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.write_build_progress(uuid, text, text, text, text, text) to service_role;
