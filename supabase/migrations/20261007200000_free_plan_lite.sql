-- Free plan: last 30 days of shared permits; paid plans see everything.
alter policy "View own permits, or shared permits per plan" on public.permits using (
  auth.uid() = user_id
  or (is_shared = true and (
    (select plan from public.profiles where id = auth.uid()) = any (array['starter','pro'])
    or coalesce(approval_date, submit_date, date_imported) >= (current_date - 30)
  ))
);

-- Free plan: at most 3 deals and 3 products.
create or replace function public.enforce_free_plan_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int; p text;
begin
  if auth.role() = 'service_role' then return new; end if;
  select plan into p from public.profiles where id = new.user_id;
  if coalesce(p, 'free') <> 'free' then return new; end if;
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into cnt using new.user_id;
  if cnt >= 3 then
    raise exception 'FREE_LIMIT:%', tg_table_name using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger free_limit_deals before insert on public.deals for each row execute function public.enforce_free_plan_limit();
create trigger free_limit_selling_options before insert on public.selling_options for each row execute function public.enforce_free_plan_limit();

-- Full-history operator scores are paid-only.
alter policy "Signed-in users read operator scores" on public.operator_scores using (
  (select plan from public.profiles where id = auth.uid()) = any (array['starter','pro'])
);
