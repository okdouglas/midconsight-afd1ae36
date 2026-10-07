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

-- Rule v1 mirrors calculateScore in src/lib/data-processor.ts and the rule published on the landing page:
--   hot:  5+ permits OR 3+ imported in the last 30 days
--   warm: 3-4 permits OR 2 imported in the last 30 days
--   steady: everything else
-- Scope: the shared permit feed. Private per-user permits are not included.
CREATE OR REPLACE FUNCTION public.compute_operator_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH agg AS (
    SELECT upper(trim(operator)) AS operator_key,
           min(operator) AS operator_name,
           count(*)::int AS permit_count,
           count(*) FILTER (WHERE date_imported >= current_date - 30)::int AS recent_count
    FROM public.permits
    WHERE is_shared AND operator IS NOT NULL AND trim(operator) <> ''
    GROUP BY 1
  ), tiered AS (
    SELECT a.*,
           CASE
             WHEN permit_count >= 5 OR recent_count >= 3 THEN 'hot'
             WHEN permit_count >= 3 OR recent_count >= 2 THEN 'warm'
             ELSE 'steady'
           END AS tier
    FROM agg a
  ), upserted AS (
    INSERT INTO public.operator_scores AS s
      (operator_key, operator_name, tier, rule_version, permit_count, recent_count, reasons, signals, computed_at)
    SELECT t.operator_key, t.operator_name, t.tier, 'v1', t.permit_count, t.recent_count,
           (
             CASE
               WHEN t.permit_count >= 5 THEN jsonb_build_array(t.permit_count || ' permits in the feed. Hot starts at 5.')
               WHEN t.permit_count >= 3 THEN jsonb_build_array(t.permit_count || ' permits in the feed. Warm starts at 3.')
               ELSE jsonb_build_array(t.permit_count || ' permits in the feed. Warm starts at 3.')
             END
             ||
             CASE
               WHEN t.recent_count >= 3 THEN jsonb_build_array(t.recent_count || ' imported in the last 30 days. Hot starts at 3.')
               WHEN t.recent_count = 2 THEN jsonb_build_array('2 imported in the last 30 days. Warm starts at 2.')
               ELSE jsonb_build_array(t.recent_count || ' imported in the last 30 days. Warm starts at 2.')
             END
           ),
           jsonb_build_object(
             'wells_active', p.wells_active,
             'wells_plugged', p.wells_plugged,
             'wells_orphan', p.wells_orphan,
             'profile_matched', coalesce(p.matched, false)
           ),
           now()
    FROM tiered t
    LEFT JOIN public.operator_profiles p USING (operator_key)
    ON CONFLICT (operator_key) DO UPDATE SET
      operator_name = EXCLUDED.operator_name,
      tier = EXCLUDED.tier,
      rule_version = EXCLUDED.rule_version,
      permit_count = EXCLUDED.permit_count,
      recent_count = EXCLUDED.recent_count,
      reasons = EXCLUDED.reasons,
      signals = EXCLUDED.signals,
      computed_at = EXCLUDED.computed_at
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upserted;

  -- Operators that left the feed no longer carry a score.
  DELETE FROM public.operator_scores s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.permits p
    WHERE p.is_shared AND upper(trim(p.operator)) = s.operator_key
  );

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_operator_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_operator_scores() TO service_role;
