-- v2.1: Monday imports for Kansas and New Mexico. NOT APPLIED until Tom approves.
-- Apply AFTER 20261009100000_v21_multistate_foundation.sql, after the functions are deployed,
-- after STATE_FEED_USER_ID is set, and after a dry run looks right.
--
-- One job per state, so one state failing never blocks another. Oklahoma
-- (itd-weekly-import-*) is not touched. All run Monday, after Oklahoma (12:00/13:00 UTC)
-- and before scoring (15:00 UTC) and the digest (16:00 UTC).
-- Auth is the same vault secret the other jobs use.

select cron.schedule('ks-weekly-import', '20 13 * * 1', $$select net.http_post(
  url := 'https://hhlxkhlyilfcrtxrjptq.supabase.co/functions/v1/import-permits-ks',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_shared_secret')),
  body := '{"commit": true}'::jsonb, timeout_milliseconds := 150000)$$);

select cron.schedule('nm-weekly-import', '30 13 * * 1', $$select net.http_post(
  url := 'https://hhlxkhlyilfcrtxrjptq.supabase.co/functions/v1/import-permits-nm',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_shared_secret')),
  body := '{"commit": true}'::jsonb, timeout_milliseconds := 150000)$$);

-- To remove: select cron.unschedule('ks-weekly-import'); select cron.unschedule('nm-weekly-import');
