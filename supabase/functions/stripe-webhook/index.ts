// Receives Stripe events and is the ONLY thing that changes a user's plan.
// Stripe signs every request; anything without a valid signature is refused.
//
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_...), plus the four STRIPE_PRICE_* ids.
// Events to send in Stripe: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted.
//
// A cancelled subscription keeps access until the paid period ends: Stripe only sends
// "deleted" at that point, so that is when the plan drops back to free.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const enc = new TextEncoder();

async function validSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts['t'];
  const sig = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  if (!t || sig.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay window: 5 minutes
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sig.some((s) => s.length === expected.length && s === expected);
}

function tierFromPrice(priceId: string | undefined): 'starter' | 'pro' | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get('STRIPE_PRICE_STARTER_MONTH') || priceId === Deno.env.get('STRIPE_PRICE_STARTER_YEAR')) return 'starter';
  if (priceId === Deno.env.get('STRIPE_PRICE_PRO_MONTH') || priceId === Deno.env.get('STRIPE_PRICE_PRO_YEAR')) return 'pro';
  return null;
}

// deno-lint-ignore no-explicit-any
type Obj = any;

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('billing_not_configured', { status: 503 });

  const payload = await req.text();
  if (!(await validSignature(payload, req.headers.get('stripe-signature') ?? '', secret))) {
    return new Response('bad signature', { status: 400 });
  }

  try {
    const event: Obj = JSON.parse(payload);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const obj: Obj = event.data?.object ?? {};

    if (event.type === 'checkout.session.completed') {
      const userId = obj.client_reference_id ?? obj.metadata?.user_id;
      const tier = obj.metadata?.tier === 'pro' ? 'pro' : obj.metadata?.tier === 'starter' ? 'starter' : null;
      if (userId && tier && obj.mode === 'subscription') {
        await supabase
          .from('profiles')
          .update({ plan: tier, stripe_customer_id: obj.customer, stripe_subscription_id: obj.subscription })
          .eq('id', userId);
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const live = ['active', 'trialing', 'past_due'].includes(obj.status) && event.type !== 'customer.subscription.deleted';
      const tier = tierFromPrice(obj.items?.data?.[0]?.price?.id) ?? (obj.metadata?.tier === 'pro' ? 'pro' : obj.metadata?.tier === 'starter' ? 'starter' : null);
      const update = live && tier
        ? { plan: tier, stripe_subscription_id: obj.id }
        : { plan: 'free', stripe_subscription_id: null };
      // Never let an old, replaced subscription downgrade a newer one.
      const { data: profile } = await supabase.from('profiles').select('id, stripe_subscription_id').eq('stripe_customer_id', obj.customer).maybeSingle();
      if (profile && (!profile.stripe_subscription_id || profile.stripe_subscription_id === obj.id || live)) {
        await supabase.from('profiles').update(update).eq('id', profile.id);
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('stripe-webhook failed:', err);
    // 500 makes Stripe retry, which is what we want for a transient database error.
    return new Response('error', { status: 500 });
  }
});
