alter table public.feature_commits add column if not exists dismissed_at timestamptz;

-- The user's client can only update its own unlinked rows and only this column.
drop policy if exists "dismiss own unlinked commits" on public.feature_commits;
create policy "dismiss own unlinked commits" on public.feature_commits
  for update to authenticated
  using ((select auth.uid()) = user_id and feature_id = '')
  with check ((select auth.uid()) = user_id and feature_id = '');
grant update (dismissed_at) on public.feature_commits to authenticated;
