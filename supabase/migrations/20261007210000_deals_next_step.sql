-- Next step and next step date on deals. Idempotent.
alter table public.deals add column if not exists next_step text;
alter table public.deals add column if not exists next_step_date date;
