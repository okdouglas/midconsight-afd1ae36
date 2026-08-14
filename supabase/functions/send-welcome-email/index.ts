// Called automatically by a Postgres trigger (via pg_net) the moment a new
// row lands in `profiles` — i.e. immediately after signup. Not called
// directly from the frontend, so it fires even if the browser tab closes
// right after clicking "Sign up".
//
// verify_jwt = false (see supabase/config.toml) — Postgres calls this with
// a shared secret, not a user JWT (same pattern as import-itd-weekly).

import { sendEmail } from '../_shared/resend.ts';

Deno.serve(async (req) => {
  try {
    const sharedSecret = Deno.env.get('CRON_SHARED_SECRET');
    if (sharedSecret && req.headers.get('x-cron-secret') !== sharedSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { email, full_name } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const firstName = full_name ? String(full_name).split(' ')[0] : null;

    await sendEmail({
      to: email,
      subject: 'Welcome to MidconSight',
      html: `
        <p>${firstName ? `Hi ${firstName},` : 'Hi,'}</p>
        <p>Your MidconSight account is ready. On the free plan you can browse
        Midcontinent drilling permits (updated with a 30-day delay) on the
        Dashboard and Map.</p>
        <p>When you're ready to work leads instead of just browsing them —
        scoring, company tracking, and a deal pipeline — you can upgrade any
        time from within the app.</p>
        <p><a href="https://midconsight.com/app">Go to your dashboard →</a></p>
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
