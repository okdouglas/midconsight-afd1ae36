// Opens Stripe's hosted billing portal (change card, switch plan, cancel) for the signed-in user.
// Returns { url }. Returns 503 { error: 'billing_not_configured' } until STRIPE_SECRET_KEY is set.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SITE = Deno.env.get('SITE_URL') ?? 'https://midconsight.com';

function safeOrigin(candidate: unknown): string {
  try {
    const u = new URL(String(candidate));
    const ok =
      u.hostname === 'midconsight.com' ||
      u.hostname === 'www.midconsight.com' ||
      u.hostname.endsWith('.workers.dev') ||
      u.hostname === 'localhost';
    return ok ? u.origin : SITE;
  } catch {
    return SITE;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) return json({ error: 'billing_not_configured' }, 503);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
    const { data: auth } = await supabase.auth.getUser(token);
    if (!auth?.user) return json({ error: 'not_signed_in' }, 401);

    const body = await req.json().catch(() => ({}));
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (!profile?.stripe_customer_id) return json({ error: 'no_billing_account' }, 404);

    const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        customer: profile.stripe_customer_id,
        return_url: `${safeOrigin(body.returnOrigin)}/app`,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`);
    return json({ url: data.url });
  } catch (err) {
    console.error('billing-portal failed:', err);
    return json({ error: err instanceof Error ? err.message : 'portal_failed' }, 500);
  }
});
