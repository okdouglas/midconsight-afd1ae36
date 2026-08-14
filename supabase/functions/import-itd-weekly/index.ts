// Auto-imports Oklahoma's "Intent to Drill - Last 7 Days" file every Monday
// morning (Central time), using the exact same parsing/mapping logic as the
// manual upload flow (see supabase/functions/_shared/schema-mapping.ts).
//
// Scheduling: pg_cron fires this function at both 12:00 and 13:00 UTC every
// Monday (covering CST and CDT), and the function itself checks the true
// America/Chicago local hour before doing any work — so it always runs at
// 7am Central regardless of daylight saving, and no-ops on the "wrong" UTC
// slot for the current time of year, rather than silently drifting an hour
// twice a year.
//
// Required secrets (set via `supabase secrets set`):
//   AUTO_IMPORT_USER_ID   — the Supabase auth user ID that automated
//                           datasets/permits should be attributed to
//                           (find it in Supabase Dashboard > Authentication > Users)
//   CRON_SHARED_SECRET    — a random string; must match the header the
//                           pg_cron job sends (see the migration file)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — already present by default
//                           in every Supabase Edge Function environment

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import * as XLSX from 'npm:xlsx@0.18.5';
import { processExcelData } from '../_shared/schema-mapping.ts';

const ITD_URL =
  'https://oklahoma.gov/content/dam/ok/en/occ/documents/og/ogdatafiles/ITD-wells-formations-daily.xlsx';
const AVG_PERMIT_VALUE = 5000; // keep in sync with src/lib/supabase-data.ts

function currentChicagoHour(): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  return parseInt(formatted, 10) % 24;
}

Deno.serve(async (req) => {
  try {
    // Auth: shared secret set by the pg_cron job (defense in depth on top
    // of the service role key already required to reach this function).
    const sharedSecret = Deno.env.get('CRON_SHARED_SECRET');
    if (sharedSecret && req.headers.get('x-cron-secret') !== sharedSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Only actually import at 7am Central — see scheduling note above.
    // Pass ?force=true to bypass this when testing manually.
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';
    if (!force && currentChicagoHour() !== 7) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Not 7am Central yet at this UTC slot' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const autoImportUserId = Deno.env.get('AUTO_IMPORT_USER_ID');
    if (!autoImportUserId) {
      throw new Error('AUTO_IMPORT_USER_ID secret is not set');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch the file
    const fileResp = await fetch(ITD_URL);
    if (!fileResp.ok) {
      throw new Error(`Failed to fetch ITD file: ${fileResp.status} ${fileResp.statusText}`);
    }
    const arrayBuffer = await fileResp.arrayBuffer();

    // 2. Parse with the same SheetJS logic the browser uses
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    // 3. Map rows using the shared Oklahoma ITD mapping logic
    const datasetId = crypto.randomUUID();
    const importResult = processExcelData(rawRows, datasetId, AVG_PERMIT_VALUE, 'OK');

    // 4. Dedupe against existing permits for this account
    const { data: existingPermits, error: existingErr } = await supabase
      .from('permits')
      .select('api')
      .eq('user_id', autoImportUserId);
    if (existingErr) throw existingErr;

    const existingApis = new Set((existingPermits || []).map((p: { api: string }) => p.api));
    const newPermits = importResult.permits.filter((p) => !existingApis.has(p.api));

    // 5. Insert dataset record (shows up in Dataset Manager automatically)
    const today = new Date();
    const datasetName = `Week of ${today.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} (auto)`;

    const { data: datasetData, error: datasetError } = await supabase
      .from('datasets')
      .insert({
        id: datasetId,
        user_id: autoImportUserId,
        name: datasetName,
        file_name: 'ITD-wells-formations-daily.xlsx',
        permit_count: newPermits.length,
        valid_rows: importResult.validRows,
        skipped_rows: importResult.skippedRows,
        is_active: true,
      })
      .select()
      .single();
    if (datasetError) throw datasetError;

    // 6. Insert new permits
    if (newPermits.length > 0) {
      const permitsToInsert = newPermits.map((p) => ({
        id: crypto.randomUUID(),
        user_id: autoImportUserId,
        api: p.api,
        operator: p.operator,
        operator_number: p.operatorNumber,
        lat: p.lat,
        lon: p.lon,
        county: p.county,
        section: p.section,
        township: p.township,
        range: p.range,
        well_name: p.wellName,
        well_number: p.wellNumber,
        well_type: p.wellType,
        well_status: p.wellStatus,
        well_class: p.wellClass,
        formation_name: p.formationName,
        formation_code: p.formationCode,
        formation_depth: p.formationDepth,
        total_depth: p.totalDepth,
        measured_total_depth: p.measuredTotalDepth,
        true_vertical_depth: p.trueVerticalDepth,
        permit_type: p.permitType,
        permit_status: p.permitStatus,
        application_type: p.applicationType,
        drill_type: p.drillType,
        approval_date: p.approvalDate,
        expire_date: p.expireDate,
        submit_date: p.submitDate,
        assigned_to: p.assignedTo,
        sign_name: p.signName,
        city: p.city,
        state: p.state,
        zip_code: p.zipCode,
        image_url: p.imageUrl,
        remarks: p.remarks,
        date_imported: p.dateImported,
        dataset_id: datasetId,
        estimated_value: AVG_PERMIT_VALUE,
        is_shared: true,
      }));

      const { error: permitsError } = await supabase.from('permits').insert(permitsToInsert);
      if (permitsError) throw permitsError;
    }

    // 7. Rebuild companies from all permits (same as manual import)
    await rebuildCompanies(supabase, autoImportUserId, AVG_PERMIT_VALUE);

    // 8. Log activity
    await supabase.from('activities').insert({
      user_id: autoImportUserId,
      type: 'import',
      description: `Auto-imported ${newPermits.length} new permits from the OCC weekly ITD feed. ${importResult.skippedRows} rows skipped, ${importResult.permits.length - newPermits.length} duplicates.`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        dataset: datasetData,
        newPermits: newPermits.length,
        skipped: importResult.skippedRows,
        duplicates: importResult.permits.length - newPermits.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('import-itd-weekly failed:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function rebuildCompanies(supabase: any, userId: string, avgPermitValue: number) {
  const { data: permits } = await supabase.from('permits').select('*').eq('user_id', userId);
  if (!permits || permits.length === 0) return;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // deno-lint-ignore no-explicit-any
  const operatorMap = new Map<string, any[]>();
  // deno-lint-ignore no-explicit-any
  permits.forEach((permit: any) => {
    const existing = operatorMap.get(permit.operator) || [];
    existing.push(permit);
    operatorMap.set(permit.operator, existing);
  });

  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId);
  // deno-lint-ignore no-explicit-any
  const existingCompanyMap = new Map((existingCompanies || []).map((c: any) => [c.name, c]));

  function calculateScore(permitCount: number, recentPermits: number): 'hot' | 'warm' | 'cold' {
    if (permitCount >= 5 || recentPermits >= 3) return 'hot';
    if (permitCount >= 3 || recentPermits >= 2) return 'warm';
    return 'cold';
  }

  // deno-lint-ignore no-explicit-any
  const companiesToUpsert: any[] = [];
  operatorMap.forEach((operatorPermits, operatorName) => {
    const existingCompany = existingCompanyMap.get(operatorName) as { id: string } | undefined;
    const recentPermits = operatorPermits.filter((p) => p.date_imported >= thirtyDaysAgoStr).length;
    const lastPermitDate = operatorPermits.reduce((latest, p) => {
      const date = p.approval_date || p.date_imported;
      return date > latest ? date : latest;
    }, '1900-01-01');
    const totalValue = operatorPermits.length * avgPermitValue;

    companiesToUpsert.push({
      id: existingCompany?.id || crypto.randomUUID(),
      user_id: userId,
      name: operatorName,
      operator_number: operatorPermits[0]?.operator_number,
      permit_count: operatorPermits.length,
      total_value: totalValue,
      score: calculateScore(operatorPermits.length, recentPermits),
      last_permit_date: lastPermitDate,
      city: operatorPermits[0]?.city,
      state: operatorPermits[0]?.state,
    });
  });

  for (const company of companiesToUpsert) {
    await supabase.from('companies').upsert(company, { onConflict: 'id' });
  }
}
