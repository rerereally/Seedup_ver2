-- Agent uploads contain usage metadata only. Retries keep the first row for each event and owner.
create table if not exists public.agent_usage (
  user_id uuid not null,
  project_key text not null,
  source text not null check (source in ('claude_code', 'codex')),
  session_id text not null check (session_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  ts timestamptz not null,
  model text not null check (model ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,123}(\[1m\])?$'),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  primary key (user_id, source, session_id, ts, model),
  foreign key (user_id, project_key) references public.supervisor_projects(user_id, project_key) on delete cascade
);

create index if not exists agent_usage_project_time_idx on public.agent_usage (user_id, project_key, ts);
alter table public.agent_usage enable row level security;
drop policy if exists "read own agent usage" on public.agent_usage;
create policy "read own agent usage" on public.agent_usage for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.agent_usage from public, anon, authenticated;
grant select on public.agent_usage to authenticated;
grant select, insert on public.agent_usage to service_role;

-- Only successful, explicit links count toward a project. Old runs retain their null project key.
alter table public.prd_runs
  add column if not exists run_key uuid,
  add column if not exists project_key text,
  add column if not exists cost_complete boolean;
create unique index if not exists prd_runs_run_key_idx on public.prd_runs (run_key) where run_key is not null;
create index if not exists prd_runs_project_idx on public.prd_runs (user_id, project_key, id) where project_key is not null;

-- The saved result and its owner-scoped claim commit together. A claimed run can never move to another project.
create or replace function public.save_dossier_with_usage(
  p_user_id uuid, p_dossier jsonb, p_run_keys uuid[], p_project_slug text, p_draft_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_saved uuid;
begin
  if p_draft_id is not null then
    update public.evidence_dossiers
    set prd_markdown = p_dossier ->> 'prd_markdown', updated_at = now()
    where id = p_draft_id and user_id = p_user_id and prd_markdown is null
    returning id into v_saved;
  else
    insert into public.evidence_dossiers (user_id, dossier_key, title, opportunity_slug, evidence_ids, evidence, prd_markdown)
    values (p_user_id, p_dossier ->> 'dossier_key', p_dossier ->> 'title', p_dossier ->> 'opportunity_slug',
      array(select jsonb_array_elements_text(p_dossier -> 'evidence_ids')), p_dossier -> 'evidence', p_dossier ->> 'prd_markdown')
    on conflict (user_id, dossier_key) do update set title = excluded.title, opportunity_slug = excluded.opportunity_slug,
      evidence_ids = excluded.evidence_ids, evidence = excluded.evidence, prd_markdown = excluded.prd_markdown, updated_at = now()
    returning id into v_saved;
  end if;

  if v_saved is not null then
    update public.prd_runs
    set project_key = coalesce(p_project_slug, 'prd:' || v_saved)
    where user_id = p_user_id and ok and project_key is null and run_key = any(p_run_keys);
  end if;
  return v_saved;
end;
$$;

revoke all on function public.save_dossier_with_usage(uuid, jsonb, uuid[], text, uuid) from public, anon, authenticated;
grant execute on function public.save_dossier_with_usage(uuid, jsonb, uuid[], text, uuid) to service_role;
