-- Ideas a person asked Seedup to keep checking: new quotes or new rival tools are mailed to them.
-- Run once in the Supabase SQL editor.
create table if not exists public.idea_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idea text not null check (char_length(idea) between 4 and 300),
  known_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  unique (user_id, idea)
);

alter table public.idea_watches enable row level security;

drop policy if exists "idea_watches_own_select" on public.idea_watches;
create policy "idea_watches_own_select" on public.idea_watches for select to authenticated using (auth.uid() = user_id);
drop policy if exists "idea_watches_own_insert" on public.idea_watches;
create policy "idea_watches_own_insert" on public.idea_watches for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "idea_watches_own_delete" on public.idea_watches;
create policy "idea_watches_own_delete" on public.idea_watches for delete to authenticated using (auth.uid() = user_id);

grant select, insert, delete on public.idea_watches to authenticated;
grant select, insert, update, delete on public.idea_watches to service_role;
