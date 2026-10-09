-- v2.1 multi-state foundation. NOT APPLIED until Tom approves. Staging and main share one
-- database, so applying this goes live at once. All changes are additive or tightening for
-- new states only. Oklahoma rows keep their current behavior.
--
--  1. permits.permit_state: the state the WELL is in. Existing rows backfill to 'OK'.
--     (The old permits.state column is the operator's mailing state. Do not use it.)
--  2. permits.location_precision: exact | section | county.
--  3. Plan rules by state. Free: OK and KS (last 30 days). Starter: OK and KS (all). Pro: all states.
--  4. Scoring: only Oklahoma permits are scored. Operators with only non-OK permits get tier 'pending'.

ALTER TABLE public.permits
  ADD COLUMN IF NOT EXISTS permit_state text NOT NULL DEFAULT 'OK',
  ADD COLUMN IF NOT EXISTS location_precision text NOT NULL DEFAULT 'exact';
ALTER TABLE public.permits
  ADD CONSTRAINT permits_permit_state_check CHECK (permit_state IN ('OK','KS','NM','TX')),
  ADD CONSTRAINT permits_location_precision_check CHECK (location_precision IN ('exact','section','county'));
CREATE INDEX IF NOT EXISTS idx_permits_permit_state_approval ON public.permits (permit_state, approval_date);

-- Plan rules by state. Same 30-day window for free users as before.
ALTER POLICY "View own permits, or shared permits per plan" ON public.permits USING (
  auth.uid() = user_id
  OR (is_shared = true AND (
    (permit_state IN ('OK','KS') AND (
      (SELECT plan FROM public.profiles WHERE id = auth.uid()) = ANY (ARRAY['starter','pro'])
      OR coalesce(approval_date, submit_date, date_imported) >= (current_date - 30)
    ))
    OR (permit_state IN ('NM','TX') AND (SELECT plan FROM public.profiles WHERE id = auth.uid()) = 'pro')
  ))
);

-- New tier for states that are not scored yet.
ALTER TABLE public.operator_scores DROP CONSTRAINT IF EXISTS operator_scores_tier_check;
ALTER TABLE public.operator_scores
  ADD CONSTRAINT operator_scores_tier_check CHECK (tier IN ('hot','warm','cold','pending'));

-- Scoring v4.1, Oklahoma permits only. Everything else is unchanged from 20261007140000.
CREATE OR REPLACE FUNCTION public.compute_operator_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH w AS (
    SELECT upper(trim(operator)) AS operator_key,
           operator,
           permit_state,
           bool_or(permit_state = 'OK') OVER (PARTITION BY upper(trim(operator))) AS has_ok,
           (coalesce(approval_date, date_imported) IS NOT NULL AND permit_state <> 'OK') AS pend_ok,
           (current_date - coalesce(approval_date, date_imported))::int AS age,
           (permit_state = 'OK'
             AND coalesce(approval_date, date_imported) IS NOT NULL
             AND (expire_date IS NULL OR expire_date >= current_date)
             AND upper(trim(coalesce(application_type, ''))) NOT IN ('AM', 'RC', 'RE', 'DP')) AS counts,
           CASE
             WHEN upper(trim(coalesce(drill_type, ''))) = 'HH' OR upper(trim(coalesce(drill_type, ''))) LIKE 'MU%'
               THEN 0.168
             WHEN upper(trim(coalesce(drill_type, ''))) IN ('SH', 'DH') THEN 0.426
             ELSE 0.248
           END AS c,
           CASE
             WHEN upper(trim(coalesce(drill_type, ''))) = 'HH' OR upper(trim(coalesce(drill_type, ''))) LIKE 'MU%'
               THEN 181.9
             WHEN upper(trim(coalesce(drill_type, ''))) IN ('SH', 'DH') THEN 132.7
             ELSE 179.3
           END AS a,
           CASE
             WHEN upper(trim(coalesce(drill_type, ''))) = 'HH' OR upper(trim(coalesce(drill_type, ''))) LIKE 'MU%'
               THEN 2.431
             WHEN upper(trim(coalesce(drill_type, ''))) IN ('SH', 'DH') THEN 2.141
             ELSE 2.307
           END AS b
    FROM public.permits
    WHERE is_shared
      AND operator IS NOT NULL AND trim(operator) <> ''
  ), agg AS (
    SELECT operator_key,
           min(operator) AS operator_name,
           count(*) FILTER (WHERE (counts OR (pend_ok AND NOT has_ok)) AND age <= 365)::int AS permit_count,
           count(*) FILTER (WHERE (counts OR (pend_ok AND NOT has_ok)) AND age <= 30)::int AS recent_count,
           bool_and(permit_state <> 'OK') AS only_pending,
           coalesce(sum((1 - c) / (1 + power(greatest(age, 0) / a, b))) FILTER (WHERE counts AND age <= 365), 0) AS pipeline
    FROM w
    GROUP BY 1
  ), tiered AS (
    SELECT a.*,
           CASE
             WHEN only_pending THEN 'pending'
             WHEN pipeline >= 1.6 AND recent_count > 0 THEN 'hot'
             WHEN pipeline >= 0.75 THEN 'warm'
             ELSE 'cold'
           END AS tier
    FROM agg a
  ), upserted AS (
    INSERT INTO public.operator_scores AS s
      (operator_key, operator_name, tier, rule_version, permit_count, recent_count, reasons, signals, computed_at)
    SELECT t.operator_key, t.operator_name, t.tier, 'v4.1', t.permit_count, t.recent_count,
           jsonb_build_array(
             CASE WHEN t.only_pending THEN 'Permits in states we do not score yet. Shown as pending.' ELSE
             'About ' || to_char(round(t.pipeline::numeric, 1), 'FM990.0') || ' wells still expected from ' ||
               t.permit_count || ' new-drill permits in the last 12 months. Warm starts at 0.75. Hot starts at 1.6.' END,
             t.recent_count || ' permits approved in the last 30 days.' || CASE WHEN t.only_pending THEN '' ELSE ' Hot needs at least 1.' END
           ),
           jsonb_build_object(
             'pipeline', round(t.pipeline::numeric, 3),
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

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_operator_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_operator_scores() TO service_role;
