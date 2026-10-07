// Starts a Stripe Checkout session for the signed-in user.
// Body: { tier: 'starter' | 'pro', interval: 'month' | 'year', returnOrigin?: string }
// Returns { url } to redirect to. Returns 503 { error: 'billing_not_configured' } until the
// Stripe secrets are set, so the app can fall back to the "request access" form.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER_MONTH, STRIPE_PRICE_STARTER_YEAR,
//          STRIPE_PRICE_PRO_MONTH, STRIPE_PRICE_PRO_YEAR, optional SITE_URL.
// Optional: STRIPE_AUTOMATIC_TAX=true turns on Stripe Tax at checkout. Set it only after Stripe Tax
//          is set up in the dashboard (head office address and tax settings), or Stripe refuses checkout.
// The plan itself is only ever changed by stripe-webhook, never here.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SITE = Deno.env.get('SITE_URL') ?? 'https://midconsight.com';

/** Only send people back to our own sites. */
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

async function stripe(path: string, params: Record<string, string>, key: string) {
  const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    const prices: Record<string, string | undefined> = {
      'starter:month': Deno.env.get('STRIPE_PRICE_STARTER_MONTH'),
      'starter:year': Deno.env.get('STRIPE_PRICE_STARTER_YEAR'),
      'pro:month': Deno.env.get('STRIPE_PRICE_PRO_MONTH'),
      'pro:year': Deno.env.get('STRIPE_PRICE_PRO_YEAR'),
    };
    if (!key || Object.values(prices).some((p) => !p)) return json({ error: 'billing_not_configured' }, 503);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
    const { data: auth } = await supabase.auth.getUser(token);
    const user = auth?.user;
    if (!user) return json({ error: 'not_signed_in' }, 401);

    const body = await req.json().catch(() => ({}));
    const tier = body.tier === 'pro' ? 'pro' : body.tier === 'starter' ? 'starter' : null;
    const interval = body.interval === 'year' ? 'year' : 'month';
    if (!tier) return json({ error: 'bad_tier' }, 400);
    const origin = safeOrigin(body.returnOrigin);

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle();

    // Already subscribed: changes go through the billing portal, not a second subscription.
    if (profile?.stripe_subscription_id && profile.plan !== 'free') {
      return json({ error: 'already_subscribed' }, 409);
    }

    let customer = profile?.stripe_customer_id as string | null | undefined;
    if (!customer) {
      const created = await stripe('customers', { email: user.email ?? '', 'metadata[user_id]': user.id }, key);
      customer = created.id as string;
      await supabase.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }

    const automaticTax = Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true';
    const session = await stripe(
      'checkout/sessions',
      {
        ...(automaticTax
          ? {
              'automatic_tax[enabled]': 'true',
              billing_address_collection: 'required',
              'customer_update[address]': 'auto',
              'customer_update[name]': 'auto',
              'tax_id_collection[enabled]': 'true',
            }
          : {}),
        mode: 'subscription',
        customer,
        client_reference_id: user.id,
        'line_items[0][price]': prices[`${tier}:${interval}`]!,
        'line_items[0][quantity]': '1',
        'metadata[user_id]': user.id,
        'metadata[tier]': tier,
        'subscription_data[metadata][user_id]': user.id,
        'subscription_data[metadata][tier]': tier,
        allow_promotion_codes: 'true',
        success_url: `${origin}/app?checkout=success`,
        cancel_url: `${origin}/app?checkout=cancelled`,
      },
      key,
    );
    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout failed:', err);
    return json({ error: err instanceof Error ? err.message : 'checkout_failed' }, 500);
  }
});
