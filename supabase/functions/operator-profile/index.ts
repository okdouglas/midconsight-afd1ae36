// Builds a public-data profile for each operator from OCC's live RBDMS_WELLS
// layer: how many wells it holds by lifecycle class, how many are active,
// plugged or orphaned, and where. One ArcGIS statistics query per operator,
// so nothing statewide is stored. Matches on the OPERATOR name, which is how
// the OCC well file and our ITD permits both name operators (checked: all 45
// operators in the current shared feed match exactly).
//
// Each run handles a small batch: operators with no profile first, then the
// oldest profiles past 7 days. Guarded by the shared secret like the other
// cron functions. Pass {"operators":["NAME"]} to refresh specific names.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const RBDMS_QUERY_URL = 'https://gis.occ.ok.gov/server/rest/services/Hosted/RBDMS_WELLS/FeatureServer/2/query';
const PER_RUN = 25;
const STALE_DAYS = 7;
const SKIP = new Set(['OTC/OCC NOT ASSIGNED', 'STATE FUND PLUGGING']);
const ACTIVE = new Set(['OIL', 'GAS', 'OIL/GAS']);

const key = (name: string) => name.trim().toUpperCase();
const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function queryStats(name: string, classField: string) {
  const url = new URL(RBDMS_QUERY_URL);
  url.searchParams.set('where', `operator=${sqlString(name)}`);
  url.searchParams.set('groupByFieldsForStatistics', `${classField},county`);
  url.searchParams.set(
    'outStatistics',
    JSON.stringify([{ statisticType: 'count', onStatisticField: 'api', outStatisticFieldName: 'n' }]),
  );
  url.searchParams.set('f', 'json');
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`RBDMS ${resp.status}`);
  const json = await resp.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return (json.features ?? []) as Array<{ attributes: Record<string, unknown> }>;
}

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

    const body = await req.json().catch(() => ({}));

    // Candidate operators: the shared feed plus every company name.
    const names = new Map<string, string>();
    if (Array.isArray(body.operators) && body.operators.length) {
      for (const n of body.operators) if (typeof n === 'string' && n.trim()) names.set(key(n), n.trim());
    } else {
      const { data: permits, error: e1 } = await supabase.from('permits').select('operator').eq('is_shared', true);
      if (e1) throw e1;
      for (const p of permits ?? []) if (p.operator) names.set(key(p.operator), p.operator.trim());
      const { data: companies, error: e2 } = await supabase.from('companies').select('name');
      if (e2) throw e2;
      for (const c of companies ?? []) if (c.name) names.set(key(c.name), c.name.trim());
    }
    for (const k of [...names.keys()]) if (SKIP.has(k)) names.delete(k);

    const { data: existing, error: e3 } = await supabase.from('operator_profiles').select('operator_key, refreshed_at');
    if (e3) throw e3;
    const refreshed = new Map((existing ?? []).map((r) => [r.operator_key, new Date(r.refreshed_at).getTime()]));
    const cutoff = Date.now() - STALE_DAYS * 86400000;
    const forced = Array.isArray(body.operators) && body.operators.length > 0;

    const due = [...names.entries()]
      .filter(([k]) => forced || !refreshed.has(k) || (refreshed.get(k) ?? 0) < cutoff)
      .sort((a, b) => (refreshed.get(a[0]) ?? 0) - (refreshed.get(b[0]) ?? 0))
      .slice(0, PER_RUN);

    let classField = 'symbol_class';
    let done = 0;
    let matched = 0;
    const unmatched: string[] = [];
    const failed: string[] = [];

    for (const [k, name] of due) {
      try {
        let rows;
        try {
          rows = await queryStats(name, classField);
        } catch (err) {
          if (classField === 'symbol_class') {
            console.error('symbol_class query failed, falling back to wellstatus:', String(err));
            classField = 'wellstatus';
            rows = await queryStats(name, classField);
          } else {
            throw err;
          }
        }

        const byClass: Record<string, number> = {};
        const byCounty = new Map<string, number>();
        for (const r of rows) {
          const n = Number(r.attributes.n ?? 0);
          const cls = String(r.attributes[classField] ?? 'UNKNOWN');
          const county = String(r.attributes.county ?? '').trim();
          byClass[cls] = (byClass[cls] ?? 0) + n;
          if (county) byCounty.set(county, (byCounty.get(county) ?? 0) + n);
        }
        const total = Object.values(byClass).reduce((a, b) => a + b, 0);
        const active = Object.entries(byClass).filter(([c]) => ACTIVE.has(c)).reduce((a, [, n]) => a + n, 0);
        const plugged = (byClass['PLUGGED'] ?? 0) + (byClass['STATE_FUNDS_PLUGGING'] ?? 0);
        const topCounties = [...byCounty.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([county, wells]) => ({ county, wells }));

        const { error } = await supabase.from('operator_profiles').upsert({
          operator_key: k,
          operator_name: name,
          wells_total: total,
          wells_by_class: byClass,
          wells_active: active,
          wells_plugged: plugged,
          wells_orphan: byClass['ORPHAN'] ?? 0,
          county_count: byCounty.size,
          top_counties: topCounties,
          matched: total > 0,
          refreshed_at: new Date().toISOString(),
        });
        if (error) throw error;
        done++;
        if (total > 0) matched++;
        else unmatched.push(name);
      } catch (err) {
        console.error(`operator-profile failed for ${name}:`, String(err));
        failed.push(name);
      }
    }

    return new Response(
      JSON.stringify({ success: true, candidates: names.size, processed: done, matched, unmatched, failed, classField }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('operator-profile failed:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
