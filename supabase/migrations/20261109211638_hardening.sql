-- Apply once to databases created before this hardening. schema.sql already includes these changes.

-- Ingest logs are read only through the server-side secret key on the admin page.
drop policy if exists "Authenticated users can read ingest runs" on public.ingest_runs;
drop policy if exists "Authenticated users can read ingest rejections" on public.ingest_rejections;
revoke select on public.ingest_runs from authenticated;
revoke select on public.ingest_rejections from authenticated;

-- Idea evaluation now requires a signed-in user.
drop policy if exists "Anyone can create pending idea evaluations" on public.idea_evaluations;
drop policy if exists "Anyone can create idea evaluations" on public.idea_evaluations;
drop policy if exists "Users can create own idea evaluations" on public.idea_evaluations;
create policy "Users can create own idea evaluations"
  on public.idea_evaluations for insert
  with check (auth.uid() = user_id);
revoke select, insert on public.idea_evaluations from anon;
