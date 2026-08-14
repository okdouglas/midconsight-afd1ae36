// Public endpoint called from the landing page's newsletter/waitlist form.
// Inserts the email into `subscribers` and sends a welcome email via Resend.
//
// verify_jwt = false (see supabase/config.toml) — anonymous visitors call
// this, they don't have a Supabase session.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { sendEmail } from '../_shared/resend.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email } = await req.json();

    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: insertError } = await supabase
      .from('subscribers')
      .insert({ email, source: 'landing_page' });

    // Unique violation just means they're already subscribed — treat as
    // success rather than an error the person needs to see.
    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }

    try {
      await sendEmail({
        to: email,
        subject: "You're on the list — MidconSight permit updates",
        html: `
          <p>Thanks for subscribing to MidconSight.</p>
          <p>You'll get a weekly summary of new Midcontinent drilling permits —
          no login required. When you're ready for scored leads, mapped
          filings, and a working deal pipeline, you can
          <a href="https://midconsight.com/auth">create a free account</a> any time.</p>
        `,
      });
    } catch (emailErr) {
      // Don't fail the signup if the welcome email fails to send — the
      // subscription itself already succeeded.
      console.error('Welcome email failed to send:', emailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('subscribe failed:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
