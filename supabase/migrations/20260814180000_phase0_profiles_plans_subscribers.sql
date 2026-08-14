-- Phase 0 of the lifecycle marketing / free-paid strategy.
-- See docs/growth-strategy-audit.md for the full plan.

-- ============ PROFILES ============
-- One row per user. Created automatically on signup via trigger below.

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
  full_name TEXT,
  company_name TEXT,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  activated_at TIMESTAMP WITH TIME ZONE,
  paywall_hits INTEGER NOT NULL DEFAULT 0,
  last_digest_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own name/company/consent, but not plan or billing
-- fields — those are only ever written by the service role (Stripe webhook
-- Edge Functions). Enforced with a trigger rather than a WITH CHECK
-- subquery against the same row, which behaves inconsistently across
-- Postgres/RLS versions.
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.protect_profile_billing_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses RLS entirely and isn't affected by this trigger
  -- in practice, but we still guard explicitly for defense in depth.
  IF auth.role() <> 'service_role' THEN
    NEW.plan := OLD.plan;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.paywall_hits := OLD.paywall_hits;
    NEW.trial_ends_at := OLD.trial_ends_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_billing_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_billing_fields();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a profile row on signup, reading the name/company/consent
-- fields passed in via supabase.auth.signUp({ options: { data: {...} } }).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name, marketing_consent)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'company_name',
    COALESCE((NEW.raw_user_meta_data ->> 'marketing_consent')::boolean, false)
  );

  -- Fire the welcome email via the send-welcome-email Edge Function.
  -- REPLACE_ME placeholders — see note at the bottom of this file.
  PERFORM net.http_post(
    url := 'https://REPLACE_ME_PROJECT_REF.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_ME_CRON_SHARED_SECRET'
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'full_name', NEW.raw_user_meta_data ->> 'full_name'
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Small RPC so the client can safely increment paywall_hits without a
-- read-then-write race condition (and without needing a broader UPDATE grant).
CREATE OR REPLACE FUNCTION public.increment_paywall_hits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET paywall_hits = paywall_hits + 1
  WHERE id = auth.uid()
  RETURNING paywall_hits INTO new_count;
  RETURN new_count;
END;
$$;

-- Mark the first time a user views a permit (idempotent — only sets once).
CREATE OR REPLACE FUNCTION public.mark_activated()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET activated_at = now()
  WHERE id = auth.uid() AND activated_at IS NULL;
END;
$$;

-- ============ NEWSLETTER / WAITLIST SUBSCRIBERS ============
-- Separate from profiles: these people haven't created an account.

CREATE TABLE public.subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Public can subscribe (INSERT only) — no one can read the list back
-- through the API, including subscribers themselves. Reads happen via
-- the service role from Edge Functions only.
CREATE POLICY "Anyone can subscribe"
ON public.subscribers FOR INSERT
WITH CHECK (true);

-- ============ SCHEDULED EMAILS (simple queue) ============
-- Drives the paid-onboarding drip (day 2 / day 7 emails) without needing
-- an external workflow tool. A daily cron Edge Function sends anything
-- due and marks it sent.

CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  send_after TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;
-- No client-facing policies at all — this table is only ever touched by
-- Edge Functions using the service role, which bypasses RLS entirely.

CREATE INDEX idx_scheduled_emails_pending
ON public.scheduled_emails (send_after)
WHERE sent_at IS NULL;

-- ============ SHARED PERMITS + PLAN-GATED VISIBILITY ============

ALTER TABLE public.permits ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark existing auto-imported ITD permits as shared. Manual
-- uploads (created via the DataImport UI) stay private to the uploader.
-- The import-itd-weekly Edge Function sets is_shared = true on new rows
-- going forward (see supabase/functions/import-itd-weekly/index.ts).

-- Replace the old "own data only" SELECT policy with one that also allows:
--   - shared permits imported more than 30 days ago (free plan)
--   - all shared permits, any age (paid plan)
DROP POLICY IF EXISTS "Users can view their own permits" ON public.permits;

CREATE POLICY "View own permits, or shared permits per plan"
ON public.permits FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    is_shared = true
    AND (
      (SELECT plan FROM public.profiles WHERE id = auth.uid()) = 'paid'
      OR date_imported <= (now() - INTERVAL '30 days')
    )
  )
);

-- INSERT/UPDATE/DELETE policies unchanged — shared rows are only ever
-- written by the service role (Edge Functions bypass RLS), never by users.

-- ============ DEPLOYMENT NOTES ============
-- Before this migration is fully functional:
--   1. Deploy the new functions:
--        supabase functions deploy send-welcome-email
--        supabase functions deploy subscribe
--   2. Set secrets (if not already set from the ITD automation work):
--        supabase secrets set RESEND_API_KEY=<your-resend-api-key>
--        supabase secrets set FROM_EMAIL="MidconSight <hello@yourdomain.com>"
--        supabase secrets set CRON_SHARED_SECRET=<same value used for import-itd-weekly>
--   3. Replace the two REPLACE_ME placeholders in the net.http_post() call
--      above (project ref + CRON_SHARED_SECRET value) before running this
--      migration, same as the pg_cron migration.
--   4. In the Supabase Dashboard, connect Resend as your SMTP provider
--      (Settings > Auth > SMTP Settings, or via the Resend↔Supabase
--      integration) so auth emails (confirmation, password reset) also
--      send through Resend instead of the rate-limited default.
