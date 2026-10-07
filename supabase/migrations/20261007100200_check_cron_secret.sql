-- Lets edge functions verify the x-cron-secret header against the Vault secret
-- that pg_cron sends. The CRON_SHARED_SECRET env var had drifted from the vault
-- value, so every cron call returned 401 (found 2026-10-07).
CREATE OR REPLACE FUNCTION public.check_cron_secret(candidate text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT candidate IS NOT NULL AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'cron_shared_secret' AND decrypted_secret = candidate
  );
$$;

REVOKE ALL ON FUNCTION public.check_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_cron_secret(text) TO service_role;
