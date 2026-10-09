// New Mexico weekly permit import. Self-contained on purpose: it shares no code with the
// Oklahoma, Kansas or Texas importers, so a failure here cannot touch them.
//
// Source: NM Oil Conservation Division public ArcGIS layer (OCDView/API_Export, layer 0).
// A well with status "New" is a permitted well that has not been drilled yet. Its
// effective_date is the date it became New, which we use as the permit date.
// NM permits are "pending" in the app: shown on the map and lists, not scored yet.
//
// Body options (all optional):
//   { "commit": true }        write to the database. Without it this is a dry run.
//   { "lookback_days": 90 }   how far back to look. Default 90.
//
// Required secrets: STATE_FEED_USER_ID (account that owns non-Oklahoma shared permits),
// plus the Supabase defaults. Cron auth uses the vault secret like the other jobs.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const STATE = 'NM';
const LAYER = 'https://gis.emnrd.nm.gov/arcgis/rest/services/OCDView/API_Export/MapServer/0/query';
const PAGE = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVG_PERMIT_VALUE = 5000;

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

/** NM id like 30-025-57035 (10 digits) to the 14-digit API form used in the permits table. */
function api14(id: string): string {
  const digits = String(id).replace(/\D/g, '');
  return digits.length === 10 ? `${digits}0000` : digits.padEnd(14, '0').slice(0, 14);
}

/** ulstr looks like L-02-26S-34E: unit letter, section, township, range. */
function parseUlstr(u: string | null) {
  const m = /^([A-Z]?)-?(\d{1,2})-(\d{1,2}[NS])-(\d{1,2}[EW])$/i.exec((u ?? '').trim());
  return m ? { section: String(parseInt(m[2], 10)), township: m[3].toUpperCase(), range: m[4].toUpperCase() } : null;
}

function driveType(d: string | null): string | null {
  const t = (d ?? '').trim().toUpperCase();
  if (t === 'H') return 'HH';
  if (t === 'V') return 'SH';
  if (t === 'D') return 'DH';
  return null;
}

async function fetchNewWells(sinceDay: string): Promise<{ rows: Row[]; fetched: number }> {
  const where = `status='New' AND type IN ('Oil','Gas') AND effective_date >= timestamp '${sinceDay} 00:00:00'`;
  const fields = 'id,name,type,directional_status,ogrid,ogrid_name,county,ulstr,latitude,longitude,measured_vertical_depth,effective_date,last_edited_on';
  const byId = new Map<string, Row>();
  let fetched = 0;
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      where, outFields: fields, returnGeometry: 'false', f: 'json',
      orderByFields: 'effective_date DESC,OBJECTID', resultOffset: String(offset), resultRecordCount: String(PAGE),
    });
    const resp = await fetch(`${LAYER}?${params}`, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) throw new Error(`OCD layer returned ${resp.status}`);
    const body = await resp.json();
    if (body.error) throw new Error(`OCD layer error: ${JSON.stringify(body.error)}`);
    const feats: Row[] = body.features ?? [];
    fetched += feats.length;
    for (const f of feats) {
      const a = f.attributes;
      const prev = byId.get(a.id);
      // The layer can list a well twice. Keep the most recently edited copy.
      if (!prev || (a.last_edited_on ?? 0) > (prev.last_edited_on ?? 0)) byId.set(a.id, a);
    }
    if (feats.length < PAGE && !body.exceededTransferLimit) break;
    if (offset > 50000) throw new Error('OCD paging did not end');
  }
  return { rows: [...byId.values()], fetched };
}

function toPermit(a: Row, today: string, datasetId: string, userId: string): Row | null {
  if (!a.id || !a.ogrid_name || a.latitude == null || a.longitude == null || !a.effective_date) return null;
  if (Math.abs(a.latitude) > 90 || Math.abs(a.longitude) > 180 || a.latitude === 0) return null;
  const trs = parseUlstr(a.ulstr);
  const depth = a.measured_vertical_depth > 0 ? Math.round(a.measured_vertical_depth) : null;
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    api: api14(a.id),
    operator: String(a.ogrid_name).trim(),
    operator_number: a.ogrid != null ? String(a.ogrid) : null,
    lat: a.latitude,
    lon: a.longitude,
    county: a.county ?? null,
    section: trs?.section ?? null,
    township: trs?.township ?? null,
    range: trs?.range ?? null,
    well_name: a.name ?? null,
    well_type: a.type ?? null,
    well_status: 'New',
    permit_type: 'APD',
    permit_status: 'Approved',
    drill_type: driveType(a.directional_status),
    total_depth: depth,
    approval_date: ymd(new Date(a.effective_date)),
    date_imported: today,
    dataset_id: datasetId,
    estimated_value: AVG_PERMIT_VALUE,
    is_shared: true,
    permit_state: STATE,
    location_precision: 'exact',
  };
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!(await cronAuthorized(req, supabase))) return new Response('Unauthorized', { status: 401 });

    let opts: Row = {};
    try { opts = await req.json(); } catch { /* empty body */ }
    const commit = opts.commit === true;
    const lookback = Math.min(Math.max(parseInt(opts.lookback_days ?? '90', 10) || 90, 1), 365);

    const userId = Deno.env.get('STATE_FEED_USER_ID') ?? '';
    if (!UUID_RE.test(userId)) throw new Error('STATE_FEED_USER_ID is missing or not a valid UUID');

    const now = new Date();
    const today = ymd(now);
    const since = ymd(new Date(now.getTime() - lookback * 86_400_000));
    const { rows: wells, fetched } = await fetchNewWells(since);

    const datasetId = crypto.randomUUID();
    const mapped = wells.map((w) => toPermit(w, today, datasetId, userId));
    const permits = mapped.filter((p): p is Row => p !== null);
    const skipped = wells.length - permits.length;

    const existing = await fetchAll((a, b) =>
      supabase.from('permits').select('api').eq('user_id', userId).eq('permit_state', STATE).order('id').range(a, b));
    const have = new Set(existing.map((r) => r.api));
    const fresh = permits.filter((p) => !have.has(p.api));

    const summary = {
      state: STATE, commit, lookback_days: lookback, rows_fetched: fetched, distinct_wells: wells.length,
      mappable: permits.length, skipped, already_in_db: permits.length - fresh.length, to_insert: fresh.length,
      newest_permit: fresh.reduce((m, p) => (p.approval_date > m ? p.approval_date : m), ''),
      oldest_permit: fresh.reduce((m, p) => (m === '' || p.approval_date < m ? p.approval_date : m), ''),
    };

    if (!commit) return json({ success: true, dry_run: true, ...summary, sample: fresh.slice(0, 5) });

    if (fresh.length > 0) {
      const { error: dsErr } = await supabase.from('datasets').insert({
        id: datasetId, user_id: userId,
        name: `Week of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} NM (auto)`,
        file_name: 'NM OCD API_Export (New wells)',
        permit_count: fresh.length, valid_rows: permits.length, skipped_rows: skipped, is_active: true,
      });
      if (dsErr) throw dsErr;
      for (let i = 0; i < fresh.length; i += 500) {
        const { error } = await supabase.from('permits').insert(fresh.slice(i, i + 500));
        if (error) throw error;
      }
    }

    await supabase.from('activities').insert({
      user_id: userId, type: 'import',
      description: `Auto-imported ${fresh.length} new NM permits from the OCD feed. ${skipped} skipped, ${permits.length - fresh.length} duplicates.`,
    });
    return json({ success: true, ...summary });
  } catch (err) {
    console.error('import-permits-nm failed:', err);
    return json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});
