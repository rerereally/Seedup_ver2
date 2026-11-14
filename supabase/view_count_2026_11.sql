-- Atomic content view counter. Safe to run more than once.
-- The table allowlist must match getContentTable in lib/content-targets.ts.

create or replace function public.increment_content_view(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table is null or p_table not in ('news_items', 'research_papers', 'github_trends', 'project_ideas', 'ai_products') then
    raise exception 'increment_content_view: unknown table %', p_table;
  end if;

  execute format('update public.%I set view_count = coalesce(view_count, 0) + 1 where id = $1', p_table)
  using p_id;
end;
$$;

revoke all on function public.increment_content_view(text, uuid) from public, anon, authenticated;
grant execute on function public.increment_content_view(text, uuid) to service_role;
