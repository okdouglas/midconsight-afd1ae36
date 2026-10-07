// Called automatically by a Postgres trigger (via pg_net) the moment a new
// row lands in `profiles` — i.e. immediately after signup. Not called
// directly from the frontend, so it fires even if the browser tab closes
// right after clicking "Sign up".
//
// verify_jwt = false (see supabase/config.toml) — Postgres calls this with
// a shared secret, not a user JWT (same pattern as import-itd-weekly).

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { sendEmail } from '../_shared/resend.ts';

Deno.serve(async (req) => {
  try {
    // The trigger sends the secret stored in Vault, so check against the Vault
    // (the env value drifted from it once and made every call fail with 401).
    const header = req.headers.get('x-cron-secret');
    const envSecret = Deno.env.get('CRON_SHARED_SECRET');
    let ok = !!header && !!envSecret && header === envSecret;
    if (!ok && header) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data, error } = await supabase.rpc('check_cron_secret', { candidate: header });
      ok = !error && data === true;
    }
    if (!ok) return new Response('Unauthorized', { status: 401 });

    const { email, full_name } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const esc = (v: unknown) =>
      String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const firstName = full_name ? String(full_name).split(' ')[0] : null;

    await sendEmail({
      to: email,
      subject: 'Welcome to MidconSight',
      html: `
        <p>${firstName ? `Hi ${esc(firstName)},` : 'Hi,'}</p>
        <p>Your MidconSight account is ready. The free plan shows every Oklahoma
        drilling permit from the last 30 days on the Dashboard and Map, with
        company records, Lead Research and up to 3 deals.</p>
        <p>Start with the Companies tab. Hot operators are the ones with new
        permits this month. Open one, add a contact, and start a deal.</p>
        <p>Paid plans add the full permit history and operator scores. You can
        upgrade any time from the Account page.</p>
        <p><a href="https://midconsight.com/app">Go to your dashboard</a></p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-welcome-email failed:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
