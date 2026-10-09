// Kansas weekly permit import. Self-contained on purpose: it shares no code with the
// Oklahoma, New Mexico or Texas importers, so a failure here cannot touch them.
//
// Two sources, in this order of importance:
//   1. KCC "intents to drill" list. Fast (updated daily), has the permit date, operator and
//      section/township/range, but no API number and no coordinates. This creates the permit.
//   2. KGS "Wells Permitted in MON-YYYY" pages. Slower, but have the real API number and well
//      status. Matched to a KCC intent by county + section + township + range + well name.
//      If KGS is down or has not caught up, the KCC permit still imports. A permit that is not
//      matched yet carries a KCC-... placeholder API and is upgraded on a later run.
// Map points come from the BLM section map (centre of the section, with a small spread so
// wells in one section do not stack). Marked location_precision = 'section'.
//
// KS permits are "pending" in the app: shown on the map and lists, not scored yet.
//
// Body options (all optional):
//   { "commit": true }        write to the database. Without it this is a dry run.
//   { "lookback_days": 30 }   how far back the KCC list reaches (15, 30, 90, 180, 365). Default 30.
//
// Required secrets: STATE_FEED_USER_ID, plus the Supabase defaults.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const STATE = 'KS';
const KCC_URL = 'https://www.kcc.ks.gov/intentsSearch.php';
const KGS_URL = 'https://chasm.kgs.ku.edu/ords/qualified.ogw5.PermitDate';
const BLM_SECTIONS = 'https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/2/query';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVG_PERMIT_VALUE = 5000;
const UA = 'MidconSight/1.0 (+https://midconsight.com)';
const FORM = 'application/x-www-form-urlencoded';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
async function cronAuthorized(req: Request, supabase: any): Promise<boolean> {
  const header = req.headers.get('x-cron-secret');
  if (!header) return false;
  const envSecret = Deno.env.get('CRON_SHARED_SECRET');
  if (envSecret && header === envSecret) return true;
  const { data, error } = await supabase.rpc('check_cron_secret', { candidate: header });
  return !error && data === true;
}

// deno-lint-ignore no-explicit-any
async function fetchAll(build: (from: number, to: number) => any): Promise<Row[]> {
  const size = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

const ymd = (d: Date) => d.toISOString().split('T')[0];
const strip = (h: string) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const cells = (tr: string) => [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1]));
const normName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const pad = (n: number, w: number) => String(n).padStart(w, '0');
const trsKey = (county: string, sec: string | number, twp: string | number, rng: string) =>
  `${county.trim().toLowerCase()}|${parseInt(String(sec), 10)}|${parseInt(String(twp), 10)}|${rng.trim().toUpperCase()}`;

async function postForm(url: string, body: string): Promise<string> {
  const resp = await fetch(url, {
    method: 'POST', body, redirect: 'follow', signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': UA, 'Content-Type': FORM },
  });
  if (!resp.ok) throw new Error(`${url} returned ${resp.status}`);
  return await resp.text();
}

// ---------- Source 1: KCC intents ----------

interface Intent {
  file: string; pdf: string; date: string; sec: string; twp: string; rng: string;
  county: string; license: string; company: string;
}

async function fetchIntents(lookback: number): Promise<Intent[]> {
  const range = [15, 30, 90, 180, 365].find((d) => d >= lookback) ?? 365;
  const html = await postForm(KCC_URL,
    `filename=&eastWest=&permitDate=&districtNumber=&section=&county=&township=&license=&range=&dateRange=${range}`);
  const out = new Map<string, Intent>();
  for (const m of html.matchAll(/<tr><td class='filename'>[\s\S]*?<\/tr>/gi)) {
    const href = /href='([^']+)'/.exec(m[0])?.[1];
    const c = cells(m[0]);
    const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(c[1] ?? '');
    if (!href || !d || !c[2] || !c[3] || !c[4] || !c[6] || !c[8]) continue;
    const pdf = new URL(href, KCC_URL).toString();
    out.set(pdf, {
      file: c[0], pdf, date: `${d[3]}-${d[1]}-${d[2]}`, sec: c[2], twp: c[3], rng: c[4],
      county: c[6], license: c[7] ?? '', company: c[8],
    });
  }
  return [...out.values()];
}

// ---------- Source 2: KGS permitted wells ----------

interface KgsWell { api10: string; name: string; status: string; depth: number | null; key: string }

async function fetchKgs(now: Date): Promise<{ byTrs: Map<string, KgsWell[]>; rows: number }> {
  const byTrs = new Map<string, KgsWell[]>();
  let rows = 0;
  const months = [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))];
  for (const mo of months) {
    const label = `${MONTHS[mo.getUTCMonth()]}-${mo.getUTCFullYear()}`;
    let pages = 1;
    for (let pg = 1; pg <= pages && pg <= 8; pg++) {
      const html = await postForm(KGS_URL, `f_dt=${label}&f_pg=${pg}`);
      const total = parseInt(/(\d+) records returned/i.exec(html)?.[1] ?? '0', 10);
      pages = Math.max(1, Math.ceil(total / 50));
      for (const m of html.matchAll(/<tr>\s*<td>\s*<a href="[^"]*f_kid=\d+">[^<]*<\/a>[\s\S]*?<\/tr>/gi)) {
        const c = cells(m[0]);
        const trs = /T(\d+)S R(\d+[EW]), Sec\. (\d+)/.exec(c[0] ?? '');
        const api = /(15-\d{3}-\d{5})(?:-\d{2}-\d{2})?\s*\(([^)]+)\)/.exec(c[3] ?? '');
        if (!trs || !api) continue;
        const key = trsKey(api[2], trs[3], trs[1], trs[2]);
        const depth = parseInt((c[5] ?? '').replace(/\D/g, ''), 10);
        const w: KgsWell = { api10: api[1].replace(/\D/g, ''), name: c[2] ?? '', status: c[9] ?? '', depth: isNaN(depth) ? null : depth, key };
        (byTrs.get(key) ?? byTrs.set(key, []).get(key)!).push(w);
        rows++;
      }
    }
  }
  return { byTrs, rows };
}

/** Match an intent to one KGS well: same county and section, and the same well name. */
function matchKgs(i: Intent, byTrs: Map<string, KgsWell[]>): KgsWell | null {
  const hits = (byTrs.get(trsKey(i.county, i.sec, i.twp, i.rng)) ?? []).filter((w) => normName(w.name) === normName(i.file));
  return hits.length === 1 ? hits[0] : null;
}

// ---------- Map points from the BLM section map ----------

interface Spot { lat: number; lon: number; halfLat: number; halfLon: number }

/** BLM section id. Kansas is the sixth principal meridian. T28S R22E -> KS060280S0220E0 */
function plssId(twp: string, rng: string): string | null {
  const m = /^(\d{1,3})([EW])$/i.exec(rng.trim());
  const t = parseInt(twp, 10);
  if (!m || isNaN(t)) return null;
  return `KS06${pad(t, 3)}0S${pad(parseInt(m[1], 10), 3)}0${m[2].toUpperCase()}0`;
}

async function sectionSpot(twp: string, rng: string, sec: string): Promise<Spot | null> {
  const id = plssId(twp, rng);
  if (!id) return null;
  const params = new URLSearchParams({
    where: `PLSSID='${id}' AND FRSTDIVNO='${pad(parseInt(sec, 10), 2)}'`,
    outFields: 'FRSTDIVID', returnGeometry: 'true', outSR: '4326', f: 'json',
  });
  const resp = await fetch(`${BLM_SECTIONS}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
  if (!resp.ok) return null;
  const ring: number[][] | undefined = (await resp.json()).features?.[0]?.geometry?.rings?.[0];
  if (!ring?.length) return null;
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { lon: (x0 + x1) / 2, lat: (y0 + y1) / 2, halfLon: (x1 - x0) / 2, halfLat: (y1 - y0) / 2 };
}

/** Same intent always lands on the same spot, spread inside the middle of its section. */
function spread(spot: Spot, seed: string): { lat: number; lon: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const u = ((h >>> 0) % 1000) / 1000 - 0.5;
  const v = (((h >>> 10) >>> 0) % 1000) / 1000 - 0.5;
  return { lon: spot.lon + u * spot.halfLon * 0.8, lat: spot.lat + v * spot.halfLat * 0.8 };
}

// ---------- Build rows ----------

const api14 = (api10: string) => `${api10}0000`;
const placeholderApi = (pdf: string) => `KCC-${pdf.split('/').pop()!.replace(/\.pdf$/i, '').slice(0, 56)}`;
const titleCase = (s: string) => s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function toPermit(i: Intent, kgs: KgsWell | null, spot: { lat: number; lon: number }, today: string, datasetId: string, userId: string): Row {
  const firstWord = kgs?.status.split(' ')[0]?.toUpperCase() ?? '';
  return {
    id: crypto.randomUUID(), user_id: userId,
    api: kgs ? api14(kgs.api10) : placeholderApi(i.pdf),
    operator: i.company.trim(), operator_number: i.license || null,
    lat: spot.lat, lon: spot.lon, county: i.county,
    section: String(parseInt(i.sec, 10)), township: `${parseInt(i.twp, 10)}S`, range: i.rng.toUpperCase(),
    well_name: kgs?.name ? kgs.name : titleCase(i.file),
    well_type: firstWord && firstWord !== 'INTENT' ? firstWord : null,
    well_status: kgs ? kgs.status : null,
    permit_type: 'Intent to Drill', permit_status: kgs ? 'Approved' : 'Intent filed',
    total_depth: kgs?.depth ?? null,
    approval_date: i.date, image_url: i.pdf,
    date_imported: today, dataset_id: datasetId, estimated_value: AVG_PERMIT_VALUE, is_shared: true,
    permit_state: STATE, location_precision: 'section',
  };
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!(await cronAuthorized(req, supabase))) return new Response('Unauthorized', { status: 401 });

    let opts: Row = {};
    try { opts = await req.json(); } catch { /* empty body */ }
    const commit = opts.commit === true;
    const lookback = parseInt(opts.lookback_days ?? '30', 10) || 30;

    const userId = Deno.env.get('STATE_FEED_USER_ID') ?? '';
    if (!UUID_RE.test(userId)) throw new Error('STATE_FEED_USER_ID is missing or not a valid UUID');

    const now = new Date();
    const today = ymd(now);

    // Source 1 must work. Source 2 is a bonus.
    const intents = await fetchIntents(lookback);
    let kgsError: string | null = null;
    let kgs = { byTrs: new Map<string, KgsWell[]>(), rows: 0 };
    try { kgs = await fetchKgs(now); } catch (e) { kgsError = e instanceof Error ? e.message : String(e); }

    const existing = await fetchAll((a, b) =>
      supabase.from('permits').select('id,api,image_url').eq('user_id', userId).eq('permit_state', STATE).order('id').range(a, b));
    const haveByPdf = new Map(existing.map((r) => [r.image_url, r]));
    const haveApi = new Set(existing.map((r) => r.api));

    // Upgrade older placeholder rows once KGS has the real API.
    const upgrades: { id: string; api: string; kgs: KgsWell }[] = [];
    const fresh: Intent[] = [];
    for (const i of intents) {
      const prior = haveByPdf.get(i.pdf);
      const hit = matchKgs(i, kgs.byTrs);
      if (prior) {
        if (hit && String(prior.api).startsWith('KCC-') && !haveApi.has(api14(hit.api10))) upgrades.push({ id: prior.id, api: api14(hit.api10), kgs: hit });
      } else {
        fresh.push(i);
      }
    }

    // Look up each distinct section once.
    const spots = new Map<string, Spot | null>();
    const need = [...new Set(fresh.map((i) => `${i.twp}|${i.rng}|${i.sec}`))];
    for (let n = 0; n < need.length; n += 5) {
      await Promise.all(need.slice(n, n + 5).map(async (k) => {
        const [t, r, s] = k.split('|');
        try { spots.set(k, await sectionSpot(t, r, s)); } catch { spots.set(k, null); }
      }));
    }

    const datasetId = crypto.randomUUID();
    const rows: Row[] = [];
    let unlocated = 0;
    for (const i of fresh) {
      const spot = spots.get(`${i.twp}|${i.rng}|${i.sec}`);
      if (!spot) { unlocated++; continue; }
      const hit = matchKgs(i, kgs.byTrs);
      const apiTaken = hit && haveApi.has(api14(hit.api10));
      rows.push(toPermit(i, apiTaken ? null : hit, spread(spot, i.pdf), today, datasetId, userId));
    }

    const summary = {
      state: STATE, commit, lookback_days: lookback, kcc_intents: intents.length,
      kgs_rows_read: kgs.rows, kgs_error: kgsError,
      already_in_db: intents.length - fresh.length, to_insert: rows.length,
      with_real_api: rows.filter((r) => !String(r.api).startsWith('KCC-')).length,
      placeholder_api: rows.filter((r) => String(r.api).startsWith('KCC-')).length,
      no_map_point: unlocated, to_upgrade: upgrades.length,
      newest_permit: rows.reduce((m, p) => (p.approval_date > m ? p.approval_date : m), ''),
    };

    if (!commit) return json({ success: true, dry_run: true, ...summary, sample: rows.slice(0, 4) });

    if (rows.length > 0) {
      const { error: dsErr } = await supabase.from('datasets').insert({
        id: datasetId, user_id: userId,
        name: `Week of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} KS (auto)`,
        file_name: 'KS KCC intents + KGS permitted wells',
        permit_count: rows.length, valid_rows: rows.length, skipped_rows: unlocated, is_active: true,
      });
      if (dsErr) throw dsErr;
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('permits').insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
    }
    for (const u of upgrades) {
      const { error } = await supabase.from('permits').update({
        api: u.api, well_name: u.kgs.name || undefined, well_status: u.kgs.status || null,
        permit_status: 'Approved', total_depth: u.kgs.depth,
      }).eq('id', u.id);
      if (error) console.error(`KS upgrade failed for ${u.id}: ${error.message}`);
    }

    await supabase.from('activities').insert({
      user_id: userId, type: 'import',
      description: `Auto-imported ${rows.length} new KS permits from the KCC feed. ${upgrades.length} upgraded with KGS API numbers. ${unlocated} waiting on a map point.`,
    });
    return json({ success: true, ...summary });
  } catch (err) {
    console.error('import-permits-ks failed:', err);
    return json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});
