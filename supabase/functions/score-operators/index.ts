// Recomputes every operator's lead tier and the reasons behind it.
// Rule v1 lives in the SQL function compute_operator_scores (see the
// 20261007100100 migration). Called by pg_cron after the Monday import,
// guarded by the shared secret like the other cron functions.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

/**
 * Cron auth. The pg_cron jobs send the secret stored in Supabase Vault, so the
 * vault is the source of truth: check the header against it through the
 * check_cron_secret function. The CRON_SHARED_SECRET env var still works if set
 * and equal to the header. (Found 2026-10-07: the env value and the vault value
 * differed, so every cron call returned 401.)
 */
// deno-lint-ignore no-explicit-any
async function cronAuthorized(req: Request, supabase: any): Promise<boolean> {
  const header = req.headers.get('x-cron-secret');
  if (!header) return false;
  const envSecret = Deno.env.get('CRON_SHARED_SECRET');
  if (envSecret && header === envSecret) return true;
  const { data, error } = await supabase.rpc('check_cron_secret', { candidate: header });
  return !error && data === true;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!(await cronAuthorized(req, supabase))) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { data, error } = await supabase.rpc('compute_operator_scores');
    if (error) throw error;

    // Operators that left the shared feed no longer carry a score.
    const { data: feedOps } = await supabase.from('permits').select('operator').eq('is_shared', true);
    const live = new Set((feedOps ?? []).map((r) => String(r.operator ?? '').trim().toUpperCase()));
    const { data: scored } = await supabase.from('operator_scores').select('operator_key');
    const stale = (scored ?? []).map((r) => r.operator_key).filter((k) => !live.has(k));
    if (stale.length) await supabase.from('operator_scores').delete().in('operator_key', stale);

    const { data: tiers } = await supabase.from('operator_scores').select('tier');
    const counts = { hot: 0, warm: 0, steady: 0 } as Record<string, number>;
    for (const row of tiers ?? []) counts[row.tier] = (counts[row.tier] ?? 0) + 1;

    return new Response(JSON.stringify({ success: true, scored: data, tiers: counts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('score-operators failed:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
