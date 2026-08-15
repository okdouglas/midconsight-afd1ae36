-- Schedules enrich-permits-rbdms daily. Unlike the ITD weekly import,
-- this has no business-hours requirement — well status doesn't change
-- fast enough to need precise timing — so one fixed UTC time is fine.
--
-- Same placeholder pattern as the earlier cron migration: replace
-- REPLACE_ME_PROJECT_REF and REPLACE_ME_CRON_SHARED_SECRET before running.

SELECT cron.schedule(
  'rbdms-enrichment-daily',
  '0 9 * * *', -- 9:00 UTC daily — off-peak, no precision needed
  $$
  SELECT net.http_post(
    url := 'https://REPLACE_ME_PROJECT_REF.supabase.co/functions/v1/enrich-permits-rbdms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_ME_CRON_SHARED_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
