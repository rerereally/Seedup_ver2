-- Add verification_level column to build_progress and backfill existing supervisor_verified rows from note tags.
-- Safe to run more than once.
alter table public.build_progress
  add column if not exists verification_level text not null default 'self_reported'
    check (verification_level in ('supervisor_verified', 'local_checked', 'self_reported'));

update public.build_progress
set verification_level = 'supervisor_verified'
where status = 'done'
  and verification_level = 'self_reported'
  and note ~ '^\[supervisor_verified(?::[0-9a-fA-F]{7,40})?\](?:\s|$)';

-- Replace the 6-arg RPC with a 7-arg default-parameter RPC so existing 6-arg callers (flag_build_progress_for_commit) remain unambiguous.
drop function if exists public.write_build_progress(uuid, text, text, text, text, text);

create or replace function public.write_build_progress(
  p_user_id uuid,
  p_slug text,
  p_feature_id text,
  p_feature_title text,
  p_status text,
  p_note text,
  p_verification_level text default 'self_reported'
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  previous_status text;
  changed_at timestamptz := clock_timestamp();
  effective_level text := case when p_status = 'done' then coalesce(p_verification_level, 'self_reported') else 'self_reported' end;
begin
  insert into public.build_progress (user_id, slug, feature_id, feature_title, status, note, verification_level, updated_at, done_at)
  values (p_user_id, p_slug, p_feature_id, p_feature_title, p_status, p_note, effective_level, changed_at,
    case when p_status = 'done' then changed_at end)
  on conflict (user_id, slug, feature_id) do nothing;

  if not found then
    select status into strict previous_status
    from public.build_progress
    where user_id = p_user_id and slug = p_slug and feature_id = p_feature_id
    for update;

    changed_at := clock_timestamp();
    update public.build_progress
    set feature_title = p_feature_title,
      status = p_status,
      note = p_note,
      verification_level = effective_level,
      updated_at = changed_at,
      done_at = case when p_status = 'done' and previous_status <> 'done' then changed_at else done_at end
    where user_id = p_user_id and slug = p_slug and feature_id = p_feature_id;
  end if;

  insert into public.build_progress_events (user_id, slug, feature_id, status, note, created_at)
  values (p_user_id, p_slug, p_feature_id, p_status, p_note, changed_at);

  return p_status = 'blocked' and previous_status is distinct from 'blocked';
end;
$$;

revoke all on function public.write_build_progress(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.write_build_progress(uuid, text, text, text, text, text, text) to service_role;
