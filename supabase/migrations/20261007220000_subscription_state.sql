-- Subscription state kept in step with Stripe by the stripe-webhook function.
-- Lets the Account page show the renewal or cancel date and a past-due notice.
-- Idempotent. Safe to run twice.

alter table public.profiles add column if not exists subscription_status text;
alter table public.profiles add column if not exists current_period_end timestamptz;
alter table public.profiles add column if not exists cancel_at_period_end boolean not null default false;
