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

-- Closed Lost deals carry 0% probability.
alter table public.deals drop constraint deals_probability_check, add constraint deals_probability_check check (probability = any (array[0, 10, 30, 60, 90, 100]));

-- Free deal limit counts open deals only.
create or replace function public.enforce_free_plan_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int; p text;
begin
  if auth.role() = 'service_role' then return new; end if;
  select plan into p from public.profiles where id = new.user_id;
  if coalesce(p, 'free') <> 'free' then return new; end if;
  if tg_table_name = 'deals' then
    select count(*) into cnt from public.deals where user_id = new.user_id and status = 'open';
  else
    execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into cnt using new.user_id;
  end if;
  if cnt >= 3 then
    raise exception 'FREE_LIMIT:%', tg_table_name using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Importing your own permit files (datasets) is Pro only.
create or replace function public.require_pro_for_dataset() returns trigger language plpgsql security definer set search_path = public as $$
declare p text;
begin
  if auth.role() = 'service_role' or auth.uid() is null then return new; end if;
  select plan into p from public.profiles where id = new.user_id;
  if coalesce(p, 'free') <> 'pro' then
    raise exception 'PRO_REQUIRED:datasets' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger require_pro_datasets before insert on public.datasets for each row execute function public.require_pro_for_dataset();

-- Monday 16:00 UTC weekly digest email (after import 12/13 and scoring 15).
select cron.schedule('weekly-digest-monday', '0 16 * * 1', $$select net.http_post(url:='https://hhlxkhlyilfcrtxrjptq.supabase.co/functions/v1/send-weekly-digest', headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_shared_secret')), body:='{}'::jsonb, timeout_milliseconds:=60000)$$);
