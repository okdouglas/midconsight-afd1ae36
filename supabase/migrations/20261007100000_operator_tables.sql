-- Operator-level intelligence: public OCC facts per operator (operator_profiles)
-- and the server-side lead score with its reasons (operator_scores).
-- Both are derived from public data and the shared permit feed, so every
-- signed-in user may read them. Only the service role writes.

CREATE TABLE public.operator_profiles (
  operator_key text PRIMARY KEY,               -- upper(trim(name)), matches OCC RBDMS OPERATOR exactly
  operator_name text NOT NULL,
  wells_total integer NOT NULL DEFAULT 0,
  wells_by_class jsonb NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"OIL": 8, "GAS": 42, "PLUGGED": 18}
  wells_active integer NOT NULL DEFAULT 0,             -- OIL + GAS + OIL/GAS
  wells_plugged integer NOT NULL DEFAULT 0,
  wells_orphan integer NOT NULL DEFAULT 0,
  county_count integer NOT NULL DEFAULT 0,
  top_counties jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{"county":"GRADY","wells":40}, ...]
  matched boolean NOT NULL DEFAULT false,              -- false = OCC returned no wells for this name
  source text NOT NULL DEFAULT 'occ_rbdms_wells',
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.operator_scores (
  operator_key text PRIMARY KEY,
  operator_name text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('hot','warm','steady')),
  rule_version text NOT NULL,
  permit_count integer NOT NULL,
  recent_count integer NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,          -- plain-English lines shown next to the tier
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,          -- raw numbers used or recorded, incl. profile facts
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read operator profiles" ON public.operator_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users read operator scores" ON public.operator_scores
  FOR SELECT TO authenticated USING (true);
