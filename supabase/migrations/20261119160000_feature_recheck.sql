-- Lock the feature so concurrent uploads and retries cannot overwrite a newer verification.
create or replace function public.flag_build_progress_for_commit(
  p_user_id uuid, p_slug text, p_feature_id text, p_sha text, p_note text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  feature_title_at_check text;
begin
  select feature_title into feature_title_at_check
  from public.build_progress
  where user_id = p_user_id and slug = p_slug and feature_id = p_feature_id
    and status = 'done' and updated_at <= (
      select min(created_at) from public.feature_commits
      where user_id = p_user_id and slug = p_slug and sha = p_sha
    )
  for update;

  if not found then return false; end if;

  perform public.write_build_progress(p_user_id, p_slug, p_feature_id, feature_title_at_check, 'needs_recheck', p_note);
  return true;
end;
$$;

revoke all on function public.flag_build_progress_for_commit(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.flag_build_progress_for_commit(uuid, text, text, text, text) to service_role;
