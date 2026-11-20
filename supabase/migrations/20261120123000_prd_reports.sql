create table public.prd_reports (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.evidence_dossiers(id) on delete cascade,
  reason text not null check (reason in ('spam', 'personal_information', 'inappropriate', 'other')),
  note text not null check (char_length(trim(note)) between 1 and 200 and note !~ '[[:cntrl:]]'),
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_key text not null,
  status text not null default 'pending' check (status in ('pending', 'ignored', 'removed')),
  created_at timestamptz not null default now(),
  unique (dossier_id, reporter_key)
);

alter table public.prd_reports enable row level security;
revoke all on public.prd_reports from public, anon, authenticated, service_role;
grant select, insert, update on public.prd_reports to service_role;

create index prd_reports_visibility_idx on public.prd_reports (dossier_id, status) where status in ('pending', 'removed');
create index prd_reports_queue_idx on public.prd_reports (created_at) where status = 'pending';

create function public.submit_prd_report(p_dossier_id uuid, p_reason text, p_note text, p_reporter_id uuid, p_reporter_key text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select from public.evidence_dossiers d where d.id = p_dossier_id and d.shared and d.prd_markdown is not null
  ) then
    return false;
  end if;

  insert into public.prd_reports (dossier_id, reason, note, reporter_id, reporter_key)
  values (p_dossier_id, p_reason, p_note, p_reporter_id, p_reporter_key)
  on conflict (dossier_id, reporter_key) do nothing;
  return true;
end;
$$;

create function public.moderated_listed_prds(p_limit integer)
returns table (id uuid, title text, opportunity_slug text, evidence_ids text[], built_url text, updated_at timestamptz)
language sql stable
set search_path = ''
as $$
  select d.id, d.title, d.opportunity_slug, d.evidence_ids, d.built_url, d.updated_at
  from public.evidence_dossiers d
  where d.shared and d.listed and d.prd_markdown is not null
    and not exists (
      select from public.prd_reports r where r.dossier_id = d.id and r.status = 'removed'
    )
    and not exists (
      select from public.prd_reports r where r.dossier_id = d.id and r.status = 'pending' offset 2
    )
  order by d.updated_at desc, d.id
  limit greatest(0, least(p_limit, 100));
$$;

revoke execute on function public.submit_prd_report(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.moderated_listed_prds(integer) from public, anon, authenticated;
grant execute on function public.submit_prd_report(uuid, text, text, uuid, text) to service_role;
grant execute on function public.moderated_listed_prds(integer) to service_role;
