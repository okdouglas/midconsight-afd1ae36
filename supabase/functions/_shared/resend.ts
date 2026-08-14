// Thin wrapper around Resend's REST API. Used by every Edge Function that
// sends email, so the API key handling and error shape stay consistent.
//
// Required secret: RESEND_API_KEY (set via `supabase secrets set`)

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string; // defaults to FROM_EMAIL secret, falls back to onboarding@resend.dev
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new Error('RESEND_API_KEY secret is not set');
  }

  const fromAddress = from || Deno.env.get('FROM_EMAIL') || 'MidconSight <onboarding@resend.dev>';

  const resp = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress, to: [to], subject, html }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend API error (${resp.status}): ${body}`);
  }
}
