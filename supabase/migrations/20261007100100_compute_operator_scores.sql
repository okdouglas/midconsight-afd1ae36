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
               ELSE jsonb_build_array(t.permit_count || ' permits in the feed. Warm starts at 3.')
             END
             ||
             CASE
               WHEN t.recent_count >= 3 THEN jsonb_build_array(t.recent_count || ' imported in the last 30 days. Hot starts at 3.')
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

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_operator_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_operator_scores() TO service_role;
