// Monday email: the operators with new permits this week, with their tier.
// Runs after import-itd-weekly and score-operators (see cron in the migration).
// Sends only to people who ticked the email box (profiles.marketing_consent) and
// skips anyone emailed in the last 5 days, so a double run never double-sends.
//
// Auth: same shared secret as the other cron functions (x-cron-secret, checked
// against the Vault through check_cron_secret).
// Body: {"dry_run": true} returns the recipients and the email text, sends nothing.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { sendEmail } from '../_shared/resend.ts';

const SITE = Deno.env.get('SITE_URL') ?? 'https://midconsight.com';
const NON_NEW_DRILL = new Set(['AM', 'RC', 'RE', 'DP']);
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// deno-lint-ignore no-explicit-any
async function authorized(req: Request, supabase: any): Promise<boolean> {
  const header = req.headers.get('x-cron-secret');
  if (!header) return false;
  const envSecret = Deno.env.get('CRON_SHARED_SECRET');
  if (envSecret && header === envSecret) return true;
  const { data, error } = await supabase.rpc('check_cron_secret', { candidate: header });
  return !error && data === true;
}

interface Row { operator: string | null; county: string | null; application_type: string | null; approval_date: string | null }

Deno.serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!(await authorized(req, supabase))) return new Response('Unauthorized', { status: 401 });
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;

    // New permits approved in the last 7 days (new drills only, like the score).
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data: permits, error } = await supabase
      .from('permits')
      .select('operator, county, application_type, approval_date')
      .eq('is_shared', true)
      .gte('approval_date', since)
      .limit(5000);
    if (error) throw error;

    const byOp = new Map<string, { name: string; n: number; counties: Set<string> }>();
    for (const p of (permits ?? []) as Row[]) {
      if (!p.operator) continue;
      if (NON_NEW_DRILL.has((p.application_type ?? '').trim().toUpperCase())) continue;
      const k = p.operator.trim().toUpperCase();
      const e = byOp.get(k) ?? { name: p.operator.trim(), n: 0, counties: new Set<string>() };
      e.n += 1;
      if (p.county) e.counties.add(p.county);
      byOp.set(k, e);
    }
    const total = Array.from(byOp.values()).reduce((s, e) => s + e.n, 0);

    const { data: scores } = await supabase.from('operator_scores').select('operator_key, tier');
    const tierOf = new Map<string, string>((scores ?? []).map((s: { operator_key: string; tier: string }) => [s.operator_key.toUpperCase(), s.tier]));
    const rank = { hot: 0, warm: 1, cold: 2 } as Record<string, number>;

    const top = Array.from(byOp.entries())
      .map(([k, e]) => ({ ...e, tier: tierOf.get(k) ?? 'cold' }))
      .sort((a, b) => (rank[a.tier] ?? 3) - (rank[b.tier] ?? 3) || b.n - a.n)
      .slice(0, 8);

    const rowsHtml = top
      .map((o) => `<tr>
        <td style="padding:6px 12px 6px 0"><strong>${esc(o.name)}</strong></td>
        <td style="padding:6px 12px 6px 0">${esc(o.tier.toUpperCase())}</td>
        <td style="padding:6px 12px 6px 0">${o.n} new permit${o.n === 1 ? '' : 's'}</td>
        <td style="padding:6px 0">${esc(Array.from(o.counties).slice(0, 3).join(', '))}</td></tr>`)
      .join('');

    const subject = total === 0
      ? 'MidconSight: a quiet week for new permits'
      : `MidconSight: ${total} new permits from ${byOp.size} operators this week`;
    const html = (name: string | null) => `
      <p>${name ? `Hi ${esc(name)},` : 'Hi,'}</p>
      <p>${total === 0
        ? 'No new drilling permits were approved this week.'
        : `${total} new drilling permits were approved this week. Hot operators come first.`}</p>
      ${top.length ? `<table style="border-collapse:collapse;font-size:14px">${rowsHtml}</table>` : ''}
      <p><a href="${SITE}/app">Open your dashboard</a></p>
      <p style="color:#5b6f8a;font-size:12px">You get this because you ticked the email box. Turn it off any time under Account in the app.</p>`;

    // Recipients: people who opted in and were not emailed in the last 5 days.
    const cutoff = new Date(Date.now() - 5 * 86400000).toISOString();
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, last_digest_sent_at')
      .eq('marketing_consent', true);
    if (pErr) throw pErr;
    const due = (profiles ?? []).filter((p: { last_digest_sent_at: string | null }) => !p.last_digest_sent_at || p.last_digest_sent_at < cutoff);

    const recipients: Array<{ id: string; email: string; name: string | null }> = [];
    for (const p of due as Array<{ id: string; full_name: string | null }>) {
      const { data: u } = await supabase.auth.admin.getUserById(p.id);
      if (u?.user?.email) recipients.push({ id: p.id, email: u.user.email, name: p.full_name ? p.full_name.split(' ')[0] : null });
    }

    if (dryRun) {
      return Response.json({ dry_run: true, subject, total, operators: top.map((o) => ({ name: o.name, tier: o.tier, n: o.n })), recipients: recipients.map((r) => r.email), sample_html: html(recipients[0]?.name ?? null) });
    }

    let sent = 0;
    const failed: string[] = [];
    for (const r of recipients) {
      try {
        await sendEmail({ to: r.email, subject, html: html(r.name) });
        await supabase.from('profiles').update({ last_digest_sent_at: new Date().toISOString() }).eq('id', r.id);
        sent += 1;
      } catch (err) {
        console.error('digest send failed', r.email, err);
        failed.push(r.email);
      }
    }
    return Response.json({ sent, failed: failed.length, total, operators: top.length });
  } catch (err) {
    console.error('send-weekly-digest failed:', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});
