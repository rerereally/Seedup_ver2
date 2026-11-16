-- Features a coding agent marked done through MCP (mark_feature_done), shown on the PRD page.
-- Safe to run more than once.
create table if not exists public.build_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  feature_id text not null,
  feature_title text not null default '',
  note text not null default '',
  done_at timestamptz not null default now(),
  primary key (user_id, slug, feature_id)
);

-- Users read their own rows on the PRD page; only the server (service role) writes, from the MCP endpoint.
alter table public.build_progress enable row level security;
drop policy if exists "read own build progress" on public.build_progress;
create policy "read own build progress" on public.build_progress for select to authenticated using (auth.uid() = user_id);
revoke all on public.build_progress from anon;
revoke insert, update, delete on public.build_progress from authenticated;
grant select on public.build_progress to authenticated;
grant select, insert, update, delete on public.build_progress to service_role;
