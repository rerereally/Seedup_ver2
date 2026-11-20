-- Run on a local database after migrations. Every fixture and report is rolled back.
begin;

do $$
declare
  owner uuid := gen_random_uuid();
  dossier uuid;
  alternative uuid;
begin
  insert into auth.users (id) values (owner);
  insert into public.evidence_dossiers (user_id, dossier_key, title, prd_markdown, shared, listed, updated_at)
    values (owner, 'report-target', 'Reported PRD', '# PRD', true, true, '2100-01-01') returning id into dossier;
  insert into public.evidence_dossiers (user_id, dossier_key, title, prd_markdown, shared, listed, updated_at)
    values (owner, 'report-alternative', 'Other PRD', '# PRD', true, true, '2099-01-01') returning id into alternative;

  if has_table_privilege('anon', 'public.prd_reports', 'INSERT')
    or has_table_privilege('authenticated', 'public.prd_reports', 'SELECT')
    or has_function_privilege('anon', 'public.submit_prd_report(uuid,text,text,uuid,text)', 'EXECUTE')
    or not (select relrowsecurity from pg_class where oid = 'public.prd_reports'::regclass) then
    raise exception 'Reports must be private and accessible only to the service role';
  end if;

  if not public.submit_prd_report(dossier, 'spam', 'Ad', null, 'reporter-a') then
    raise exception 'Anonymous report on shared PRD must be accepted';
  end if;
  perform public.submit_prd_report(dossier, 'other', 'Duplicate from the same reporter', null, 'reporter-a');
  perform public.submit_prd_report(dossier, 'spam', 'Ad', null, 'reporter-b');
  if (select count(*) from public.prd_reports where dossier_id = dossier) <> 2
    or not exists (select from public.moderated_listed_prds(1) where id = dossier) then
    raise exception 'Two reports must leave the PRD listed and repeat reporters must count once';
  end if;

  perform public.submit_prd_report(dossier, 'spam', 'Ad', null, 'reporter-c');
  if not exists (select from public.moderated_listed_prds(1) where id = alternative)
    or not (select shared from public.evidence_dossiers where id = dossier) then
    raise exception 'Three reports must filter before applying the limit without unsharing the PRD';
  end if;

  update public.prd_reports set status = 'ignored' where dossier_id = dossier and reporter_key = 'reporter-c';
  if not exists (select from public.moderated_listed_prds(1) where id = dossier) then
    raise exception 'Ignoring a report must restore a PRD below the threshold';
  end if;

  update public.prd_reports set status = 'removed' where dossier_id = dossier and reporter_key = 'reporter-a';
  if exists (select from public.moderated_listed_prds(100) where id = dossier)
    or not (select shared from public.evidence_dossiers where id = dossier) then
    raise exception 'An administrator can remove a PRD from the list while leaving its link available';
  end if;

  update public.evidence_dossiers set shared = false where id = dossier;
  if public.submit_prd_report(dossier, 'spam', 'Ad', null, 'reporter-d') then
    raise exception 'Reports on private PRDs must be rejected';
  end if;
end;
$$;

rollback;
