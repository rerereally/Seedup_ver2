-- Aggregate before the API row limit so the list can show the full number of makers.
create or replace function public.built_example_counts(p_slugs text[])
returns table (opportunity_slug text, maker_count integer)
language sql stable security invoker set search_path = ''
as $$
  select d.opportunity_slug, count(distinct d.user_id)::integer
  from public.evidence_dossiers as d
  where d.opportunity_slug = any(p_slugs)
    and d.shared = true
    and d.built_at is not null
  group by d.opportunity_slug;
$$;

revoke all on function public.built_example_counts(text[]) from public, anon, authenticated;
grant execute on function public.built_example_counts(text[]) to service_role;
