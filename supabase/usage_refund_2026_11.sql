-- Gives back one use counted by consume_ai_usage when the model call behind it failed.
create or replace function public.release_ai_usage(p_feature text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.ai_usage
  set count = count - 1
  where user_id = auth.uid()
    and feature = p_feature
    and usage_date = (now() at time zone 'Asia/Seoul')::date
    and count > 0;
end;
$$;

revoke all on function public.release_ai_usage(text) from public, anon;
grant execute on function public.release_ai_usage(text) to authenticated;
