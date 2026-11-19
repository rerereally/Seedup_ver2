create table if not exists public.feature_commits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  feature_id text not null,
  sha text not null,
  message text not null,
  files text[] not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug, sha, feature_id)
);

create index if not exists feature_commits_user_slug_idx on public.feature_commits (user_id, slug);

alter table public.feature_commits enable row level security;
drop policy if exists "read own feature commits" on public.feature_commits;
create policy "read own feature commits" on public.feature_commits
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.feature_commits from public, anon, authenticated;
grant select on public.feature_commits to authenticated;
grant select, insert, update, delete on public.feature_commits to service_role;
