-- Operator lead score, rule v4.1 (measured permit-to-production curve, new drills only).
-- Same as v4 plus: amendments, recompletions, re-entries and deepenings (AM, RC, RE, DP) do not count.
-- Mirrors src/lib/scoring.ts and the rule on the landing page.
--
--   weight(t) = (1 - c) / (1 + (t / a)^b), t = days since approval
--   Horizontal (HH, MU*):   c 0.168, a 181.9, b 2.431
--   Vertical (SH, DH):      c 0.426, a 132.7, b 2.141
--   Unknown type:           c 0.248, a 179.3, b 2.307
--   Expired permits count 0. Lookback is 365 days.
--   Hot   pipeline >= 1.6 AND a permit approved in the last 30 days
--   Warm  pipeline >= 0.75
--   Cold  everything else
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
  WITH w AS (
    SELECT upper(trim(operator)) AS operator_key,
           operator,
           (current_date - coalesce(approval_date, date_imported))::int AS age,
           (coalesce(approval_date, date_imported) IS NOT NULL
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
           count(*) FILTER (WHERE counts AND age <= 365)::int AS permit_count,
           count(*) FILTER (WHERE counts AND age <= 30)::int AS recent_count,
           coalesce(sum((1 - c) / (1 + power(greatest(age, 0) / a, b))) FILTER (WHERE counts AND age <= 365), 0) AS pipeline
    FROM w
    GROUP BY 1
  ), tiered AS (
    SELECT a.*,
           CASE
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
             'About ' || to_char(round(t.pipeline::numeric, 1), 'FM990.0') || ' wells still expected from ' ||
               t.permit_count || ' new-drill permits in the last 12 months. Warm starts at 0.75. Hot starts at 1.6.',
             t.recent_count || ' permits approved in the last 30 days. Hot needs at least 1.'
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
