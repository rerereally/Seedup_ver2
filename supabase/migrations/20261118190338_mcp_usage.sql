-- Atomic daily limit for MCP calls. Safe to run more than once.
-- MCP requests carry a personal token, not a Supabase session, so auth.uid() is empty and consume_ai_usage cannot
-- be used. This variant takes the user id from the server (service role only) and counts in one statement, so two
-- calls in the same instant cannot both pass at the limit.
create or replace function public.consume_ai_usage_for(p_user uuid, p_feature text, p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user is null then
    return false;
  end if;

  insert into public.ai_usage (user_id, feature, count)
  values (p_user, p_feature, 1)
  on conflict (user_id, feature, usage_date)
  do update set count = public.ai_usage.count + 1
  returning count into v_count;

  return v_count <= p_daily_limit;
end;
$$;

revoke all on function public.consume_ai_usage_for(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_usage_for(uuid, text, integer) to service_role;
