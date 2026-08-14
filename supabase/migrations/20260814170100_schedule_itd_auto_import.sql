-- Schedules the import-itd-weekly Edge Function every Monday morning.
--
-- IMPORTANT — before this migration will actually work, you must:
--   1. Deploy the function:  supabase functions deploy import-itd-weekly
--   2. Set secrets:
--        supabase secrets set AUTO_IMPORT_USER_ID=<your-user-uuid>
--        supabase secrets set CRON_SHARED_SECRET=<a-random-string>
--   3. Replace the two placeholders below (search for "REPLACE_ME") with
--      your actual project ref and the same CRON_SHARED_SECRET value, then
--      re-run this migration (or run the replaced SQL directly in the
--      Supabase SQL editor).
--
-- Two cron times (12:00 and 13:00 UTC) are scheduled to cover both CST and
-- CDT — the Edge Function itself checks the true America/Chicago hour and
-- only does real work at the one that's actually 7am Central, so exactly
-- one of the two runs does anything each Monday.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'itd-weekly-import-cdt-slot',
  '0 12 * * 1', -- Monday 12:00 UTC = 7am CDT (summer)
  $$
  SELECT net.http_post(
    url := 'https://REPLACE_ME_PROJECT_REF.supabase.co/functions/v1/import-itd-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_ME_CRON_SHARED_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'itd-weekly-import-cst-slot',
  '0 13 * * 1', -- Monday 13:00 UTC = 7am CST (winter)
  $$
  SELECT net.http_post(
    url := 'https://REPLACE_ME_PROJECT_REF.supabase.co/functions/v1/import-itd-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_ME_CRON_SHARED_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To inspect scheduled jobs later:      SELECT * FROM cron.job;
-- To see run history:                   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- To remove a job:                      SELECT cron.unschedule('itd-weekly-import-cdt-slot');
