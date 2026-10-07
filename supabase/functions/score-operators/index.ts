// Recomputes every operator's lead tier and the reasons behind it.
// Rule v1 lives in the SQL function compute_operator_scores (see the
// 20261007100000 migration). Called by pg_cron after the Monday import,
// guarded by the shared secret like the other cron functions.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

Deno.serve(async (req) => {
  try {
    const sharedSecret = Deno.env.get('CRON_SHARED_SECRET');
    if (sharedSecret && req.headers.get('x-cron-secret') !== sharedSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await supabase.rpc('compute_operator_scores');
    if (error) throw error;

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
