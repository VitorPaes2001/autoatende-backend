create or replace function public.try_consume_usage(
  p_client_id uuid,
  p_year int,
  p_month int,
  p_templates_delta int,
  p_conversations_delta int,
  p_templates_limit int
)
returns table(
  allowed boolean,
  templates_used int,
  conversations_used int,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_templates_used int;
  v_conversations_used int;
  v_limit int;
  v_new_templates int;
  v_new_conversations int;
begin
  if p_client_id is null then
    return query select false, 0, 0, 'INVALID_CLIENT_ID';
    return;
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id) then
    return query select false, 0, 0, 'UNKNOWN_CLIENT';
    return;
  end if;

  v_limit := coalesce(p_templates_limit, 0);

  insert into public.monthly_usage (client_id, year, month, templates_used, conversations_used)
  values (p_client_id, p_year, p_month, 0, 0)
  on conflict (client_id, year, month) do nothing;

  select mu.templates_used, mu.conversations_used
    into v_templates_used, v_conversations_used
  from public.monthly_usage mu
  where mu.client_id = p_client_id and mu.year = p_year and mu.month = p_month
  for update;

  if coalesce(p_templates_delta, 0) > 0
     and v_limit >= 0
     and (v_templates_used + coalesce(p_templates_delta, 0)) > v_limit then
    return query select false, v_templates_used, v_conversations_used, 'TEMPLATE_LIMIT_EXCEEDED';
    return;
  end if;

  update public.monthly_usage mu
    set templates_used = mu.templates_used + coalesce(p_templates_delta, 0),
        conversations_used = mu.conversations_used + coalesce(p_conversations_delta, 0)
  where mu.client_id = p_client_id and mu.year = p_year and mu.month = p_month
  returning mu.templates_used, mu.conversations_used
  into v_new_templates, v_new_conversations;

  return query select true, v_new_templates, v_new_conversations, 'OK';
end;
$$;
