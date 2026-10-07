// Map v2.0 enrichment — matches permits against OCC's live RBDMS_WELLS
// feed by API number, and fills in real well status, precise coordinates,
// legal description, and a link to the scanned well file. See
// docs/map-v2-data-sourcing.md for the field reference and
// docs/map-v2-ui-design.md for how this drives the marker symbol system.
//
// Re-checks permits older than 30 days too (not just unmatched ones) —
// a well's RBDMS status changes over its life (permitted → drilled →
// producing/dry → eventually plugged), so this is genuinely ongoing
// lifecycle tracking, not a one-time lookup.
//
// ⚠️ Not live-tested against the real RBDMS endpoint from the sandbox
// this was built in (network-restricted). Built against standard,
// documented ArcGIS REST API conventions — verify against real data via
// the Edge Function logs after first deploy, particularly whether the
// `api` number format in our `permits` table actually matches RBDMS's
// numeric `api` field once normalized.

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const RBDMS_QUERY_URL = 'https://gis.occ.ok.gov/server/rest/services/Hosted/RBDMS_WELLS/FeatureServer/2/query';
const BATCH_SIZE = 100; // permits per RBDMS query, keeps the IN-clause URL reasonably short
const PERMITS_PER_RUN = 500; // caps total work per invocation

/**
 * Our permits store the 14-digit API (state + county + well + sidetrack + completion,
 * e.g. 35051007260000). OCC RBDMS_WELLS stores the 10-digit well API (3505100726).
 * Matching on the full 14 digits never hits, so match on the first 10.
 */
function normalizeApi(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

function buildLegalDescription(row: Record<string, unknown>): string | null {
  const section = row.section;
  const township = row.township;
  const range = row.range;
  if (!section && !township && !range) return null;
  const qtrs = [row.qtr1, row.qtr2, row.qtr3, row.qtr4].filter(Boolean).join('');
  const qtrPrefix = qtrs ? `${qtrs} ` : '';
  return `${qtrPrefix}Sec ${section ?? '?'}-${township ?? '?'}-${range ?? '?'}`.trim();
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    if (!(await cronAuthorized(req, supabase))) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Permits due for a (re-)lookup: never enriched, or checked 30+ days ago.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: duePermits, error: fetchError } = await supabase
      .from('permits')
      .select('id, api')
      .or(`rbdms_enriched_at.is.null,rbdms_enriched_at.lt.${thirtyDaysAgo.toISOString()}`)
      .limit(PERMITS_PER_RUN);

    if (fetchError) throw fetchError;
    if (!duePermits || duePermits.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, matched: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // api -> [permit ids] — a normalized API can theoretically map to more
    // than one row if duplicates exist, so update all of them.
    const apiToPermitIds = new Map<string, string[]>();
    for (const p of duePermits) {
      const normalized = normalizeApi(p.api);
      if (!normalized) continue; // nothing usable to match on
      const existing = apiToPermitIds.get(normalized) || [];
      existing.push(p.id);
      apiToPermitIds.set(normalized, existing);
    }

    const allApis = Array.from(apiToPermitIds.keys());
    let matched = 0;
    const updatedPermitIds = new Set<string>();

    for (let i = 0; i < allApis.length; i += BATCH_SIZE) {
      const batch = allApis.slice(i, i + BATCH_SIZE);
      const whereClause = `api IN (${batch.join(',')})`;

      const url = new URL(RBDMS_QUERY_URL);
      url.searchParams.set('where', whereClause);
      url.searchParams.set(
        'outFields',
        'api,wellstatus,symbol_class,sh_lat,sh_lon,county,section,township,range,qtr1,qtr2,qtr3,qtr4,pm,well_records_docs'
      );
      url.searchParams.set('f', 'json');

      let resp = await fetch(url.toString());
      let json = resp.ok ? await resp.json() : null;
      if (json?.error) {
        // The layer may not expose symbol_class. Retry once without it.
        console.error('RBDMS query error, retrying without symbol_class:', JSON.stringify(json.error));
        url.searchParams.set('outFields', 'api,wellstatus,sh_lat,sh_lon,county,section,township,range,qtr1,qtr2,qtr3,qtr4,pm,well_records_docs');
        resp = await fetch(url.toString());
        json = resp.ok ? await resp.json() : null;
      }
      if (!resp.ok || !json || json.error) {
        console.error(`RBDMS query failed for batch starting at ${i}: ${resp.status} ${JSON.stringify(json?.error ?? '')}`);
        continue; // don't let one bad batch stop the rest
      }
      const features: Array<{ attributes: Record<string, unknown> }> = json.features || [];

      for (const feature of features) {
        const attrs = feature.attributes;
        const apiKey = String(attrs.api ?? '').replace(/\.0$/, '').slice(0, 10); // ArcGIS doubles sometimes stringify as "123.0"
        const permitIds = apiToPermitIds.get(apiKey);
        if (!permitIds) continue;

        const updates: Record<string, unknown> = {
          // symbol_class is the lifecycle word the map expects (OIL, GAS, PLUGGED, ORPHAN...).
          // wellstatus is a two or three letter code (AC, PA, NE), kept only as a fallback.
          rbdms_well_status: attrs.symbol_class || attrs.wellstatus || null,
          rbdms_legal_description: buildLegalDescription(attrs),
          rbdms_well_records_url: attrs.well_records_docs || null,
          rbdms_enriched_at: new Date().toISOString(),
        };

        // Only overwrite coordinates with RBDMS's precise surface-hole
        // location if it actually returned usable ones.
        if (typeof attrs.sh_lat === 'number' && typeof attrs.sh_lon === 'number' && attrs.sh_lat !== 0) {
          updates.lat = attrs.sh_lat;
          updates.lon = attrs.sh_lon;
        }

        const { error: updateError } = await supabase
          .from('permits')
          .update(updates)
          .in('id', permitIds);

        if (updateError) {
          console.error(`Failed to update permits for api ${apiKey}:`, updateError);
        } else {
          matched += permitIds.length;
          permitIds.forEach((id) => updatedPermitIds.add(id));
        }
      }
    }

    // Mark everything we attempted but didn't get a match for as checked
    // too, so unmatched permits aren't retried every single run — they'll
    // come up again naturally after the 30-day re-check window.
    const unmatchedIds = duePermits.map((p) => p.id).filter((id) => !updatedPermitIds.has(id));
    if (unmatchedIds.length > 0) {
      await supabase
        .from('permits')
        .update({ rbdms_enriched_at: new Date().toISOString() })
        .in('id', unmatchedIds);
    }

    return new Response(
      JSON.stringify({ success: true, checked: duePermits.length, matched }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('enrich-permits-rbdms failed:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
