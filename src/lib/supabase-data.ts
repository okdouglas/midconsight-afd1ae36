/**
 * Supabase Data Layer for MidconSight
 * Replaces IndexedDB with persistent cloud storage
 */

import { scoreOperator, DEFAULT_WINDOW_DAYS } from '@/lib/scoring';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { processExcelData, generateId, type Permit, type ImportResult } from './schema-mapping';
import type { ImportMetadata, SkippedRow } from '@/components/ImportAddendum';

export const AVG_PERMIT_VALUE = 5000; // Updated to $5k per permit

// Extended import result with metadata for UI
export interface ExtendedImportResult {
  dataset: DbDataset;
  importResult: ImportResult;
  metadata: ImportMetadata;
  skippedRows: SkippedRow[];
}

// Types for database records
export interface DbPermit {
  id: string;
  user_id: string;
  api: string;
  operator: string;
  operator_number?: string;
  lat: number;
  lon: number;
  county?: string;
  section?: string;
  township?: string;
  range?: string;
  well_name?: string;
  well_number?: string;
  well_type?: string;
  well_status?: string;
  well_class?: string;
  formation_name?: string;
  formation_code?: string;
  formation_depth?: number;
  total_depth?: number;
  measured_total_depth?: number;
  true_vertical_depth?: number;
  permit_type?: string;
  permit_status?: string;
  application_type?: string;
  drill_type?: string;
  approval_date?: string;
  expire_date?: string;
  submit_date?: string;
  assigned_to?: string;
  sign_name?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  image_url?: string;
  remarks?: string;
  date_imported: string;
  dataset_id?: string;
  estimated_value: number;
  created_at: string;
  // Map v2.0 — RBDMS enrichment
  rbdms_well_status?: string;
  rbdms_legal_description?: string;
  rbdms_well_records_url?: string;
  rbdms_enriched_at?: string;
}

export interface DbCompany {
  id: string;
  user_id: string;
  name: string;
  operator_number?: string;
  permit_count: number;
  total_value: number;
  score: 'hot' | 'warm' | 'cold';
  last_permit_date?: string;
  city?: string;
  state?: string;
  created_at: string;
  updated_at: string;
  is_current_client?: boolean;
  hq_address?: string;
  primary_contact_id?: string;
}

export interface DbLicensePurchase {
  id: string;
  user_id: string;
  company_id: string;
  selling_option_id?: string;
  purchase_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbContact {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  notes?: string;
  created_at: string;
}

export interface DbDeal {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  stage: 'new_lead' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';
  value: number;
  expected_close_date?: string;
  status: 'open' | 'closed';
  linked_permit_ids?: string[];
  notes?: string;
  selling_option_id?: string;
  probability?: number;
  created_at: string;
}

export interface DbSellingOption {
  id: string;
  user_id: string;
  name: string;
  category: string;
  type: string;
  description?: string;
  default_price: number;
  annual_rental?: number;
  annual_maintenance?: number;
  trigger_type?: string;
  /** Product-fit matching criteria — which permits/wells this product applies to.
   *  Empty/null on any field means "no constraint on this dimension." */
  target_formations?: string[];
  applicable_well_types?: string[];
  min_depth?: number;
  max_depth?: number;
  created_at: string;
  updated_at: string;
}

export interface DbActivity {
  id: string;
  user_id: string;
  type: string;
  description: string;
  company_id?: string;
  created_at: string;
}

export interface DbDataset {
  id: string;
  user_id: string;
  name: string;
  file_name?: string;
  permit_count: number;
  valid_rows: number;
  skipped_rows: number;
  is_active: boolean;
  created_at: string;
}

// Helper to convert DB record to app format
function dbPermitToApp(p: DbPermit): Permit {
  // Check if this permit uses centroid coordinates based on state and coordinate precision
  // Texas RRC imports without GPS use county centroids; OK always has precise GPS
  // We detect centroid mapping by checking if state is TX and coordinates match county patterns
  const state = p.state?.toUpperCase();
  
  // For TX, assume centroid unless we have evidence of precise GPS (from ASCII sync etc)
  // For OK, always use precise GPS (never centroid mapped)
  // This flag is set during import and we preserve it based on state
  const isCentroidMapped = state === 'TX';
  
  return {
    id: p.id,
    api: p.api,
    operator: p.operator,
    operatorNumber: p.operator_number,
    lat: Number(p.lat),
    lon: Number(p.lon),
    county: p.county,
    section: p.section,
    township: p.township,
    range: p.range,
    wellName: p.well_name,
    wellNumber: p.well_number,
    wellType: p.well_type,
    wellStatus: p.well_status,
    wellClass: p.well_class,
    formationName: p.formation_name,
    formationCode: p.formation_code,
    formationDepth: p.formation_depth ? Number(p.formation_depth) : undefined,
    totalDepth: p.total_depth ? Number(p.total_depth) : undefined,
    measuredTotalDepth: p.measured_total_depth ? Number(p.measured_total_depth) : undefined,
    trueVerticalDepth: p.true_vertical_depth ? Number(p.true_vertical_depth) : undefined,
    permitType: p.permit_type,
    permitStatus: p.permit_status,
    applicationType: p.application_type,
    drillType: p.drill_type,
    approvalDate: p.approval_date,
    expireDate: p.expire_date,
    submitDate: p.submit_date,
    assignedTo: p.assigned_to,
    signName: p.sign_name,
    city: p.city,
    state: p.state,
    zipCode: p.zip_code,
    imageUrl: p.image_url,
    remarks: p.remarks,
    dateImported: p.date_imported,
    datasetId: p.dataset_id || '',
    estimatedValue: Number(p.estimated_value),
    isCentroidMapped,
    rbdmsWellStatus: p.rbdms_well_status,
    rbdmsLegalDescription: p.rbdms_legal_description,
    rbdmsWellRecordsUrl: p.rbdms_well_records_url,
    rbdmsEnrichedAt: p.rbdms_enriched_at,
  };
}

// ============ FETCH OPERATIONS ============

// Supabase returns at most 1,000 rows per request. Read every page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

export async function getAllPermits(): Promise<Permit[]> {
  const data = await fetchAllRows((a, b) =>
    supabase.from('permits').select('*').order('created_at', { ascending: false }).order('id').range(a, b));
  return data.map(dbPermitToApp);
}

export async function getAllCompanies(): Promise<DbCompany[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('permit_count', { ascending: false });

  if (error) throw error;
  return (data || []) as DbCompany[];
}

export async function getAllDeals(): Promise<DbDeal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as DbDeal[];
}

export async function getAllDatasets(): Promise<DbDataset[]> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as DbDataset[];
}

export async function getContactsByCompany(companyId: string): Promise<DbContact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as DbContact[];
}

export async function getDealsByCompany(companyId: string): Promise<DbDeal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as DbDeal[];
}

// ============ SAVE OPERATIONS ============

export async function saveContact(contact: Omit<DbContact, 'id' | 'user_id' | 'created_at'>): Promise<DbContact> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      ...contact,
      user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data as DbContact;
}

export async function updateContact(
  id: string,
  updates: Partial<Omit<DbContact, 'id' | 'user_id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function saveDeal(deal: Omit<DbDeal, 'id' | 'user_id' | 'created_at'>): Promise<DbDeal> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('deals')
    .insert({
      ...deal,
      user_id: user.id
    })
    .select()
    .single();

  if (error) {
    announceFreeLimit(error);
    throw error;
  }
  return data as DbDeal;
}

export async function updateDeal(id: string, updates: Partial<DbDeal>): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteDataset(datasetId: string): Promise<void> {
  // Delete permits associated with the dataset
  const { error: permitsError } = await supabase
    .from('permits')
    .delete()
    .eq('dataset_id', datasetId);

  if (permitsError) throw permitsError;

  // Delete the dataset
  const { error } = await supabase
    .from('datasets')
    .delete()
    .eq('id', datasetId);

  if (error) throw error;
}

// ============ IMPORT OPERATIONS ============

interface ParsedFileResult {
  data: Record<string, unknown>[];
  metadata: ImportMetadata;
  headerSkippedRows: SkippedRow[];
}

export async function parseFile(file: File): Promise<ParsedFileResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get all data as array of arrays to detect Texas RRC format
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false
        });
        
        const metadata: ImportMetadata = {};
        const headerSkippedRows: SkippedRow[] = [];
        
        // Detect Texas RRC format: first row contains "Search Criteria"
        const isTexasRRC = rawRows.length > 0 && 
          String(rawRows[0]?.[0] || '').includes('Search Criteria');
        
        if (isTexasRRC) {
          // Find the header row (contains "Status Date")
          let headerRowIndex = -1;
          const rawHeaderRows: string[] = [];
          
          for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
            const row = rawRows[i] as unknown[];
            const rowText = row ? row.map(cell => String(cell || '')).join(' | ') : '';
            
            if (row && row.some(cell => String(cell) === 'Status Date')) {
              headerRowIndex = i;
              break;
            }
            
            // Capture metadata rows
            if (rowText.trim()) {
              rawHeaderRows.push(rowText);
              
              // Extract search criteria info
              const firstCell = String(row[0] || '');
              if (firstCell.includes('Search Criteria')) {
                metadata.searchCriteria = rowText;
              }
              if (firstCell.includes('Date') || rowText.toLowerCase().includes('date range')) {
                // Try to extract date range from metadata
                const dateMatch = rowText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
                if (dateMatch && dateMatch.length >= 2) {
                  metadata.dateRange = `${dateMatch[0]} to ${dateMatch[1]}`;
                } else if (dateMatch && dateMatch.length === 1) {
                  metadata.dateRange = dateMatch[0];
                }
              }
              
              // Add as skipped header row
              headerSkippedRows.push({
                rowNumber: i + 1,
                reason: 'Header/Metadata',
                rawContent: rowText.substring(0, 200) // Limit length
              });
            }
          }
          
          metadata.rawHeaderRows = rawHeaderRows;
          
          if (headerRowIndex === -1) {
            throw new Error('Could not find header row in Texas RRC file');
          }
          
          // Add header row itself as skipped
          const headerRow = rawRows[headerRowIndex] as unknown[];
          headerSkippedRows.push({
            rowNumber: headerRowIndex + 1,
            reason: 'Header/Metadata',
            rawContent: headerRow.map(cell => String(cell || '')).join(' | ').substring(0, 200)
          });
          
          // Use the header row as column names
          const headers = (rawRows[headerRowIndex] as unknown[]).map(h => String(h).trim());
          const dataRows: Record<string, unknown>[] = [];
          
          // Process data rows (after header)
          for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const row = rawRows[i] as unknown[];
            if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows
            
            const record: Record<string, unknown> = {};
            headers.forEach((header, idx) => {
              if (header) {
                record[header] = row[idx] ?? '';
              }
            });
            
            // Only add rows that have an API number
            if (record['API NO.']) {
              dataRows.push(record);
            }
          }
          
          metadata.totalRecords = dataRows.length;
          
          resolve({ data: dataRows, metadata, headerSkippedRows });
        } else {
          // Standard Excel/CSV format (Oklahoma ITD)
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            defval: '',
            raw: false
          });
          
          metadata.totalRecords = jsonData.length;
          
          resolve({ data: jsonData, metadata, headerSkippedRows: [] });
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

export async function importFile(
  file: File,
  datasetName?: string,
  selectedState?: string
): Promise<ExtendedImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: rawData, metadata, headerSkippedRows } = await parseFile(file);
  const datasetId = crypto.randomUUID();
  const name = datasetName || `Import ${new Date().toLocaleDateString()}`;
  
  // Pass selected state to processing for proper coordinate handling
  const importResult = processExcelData(rawData, datasetId, AVG_PERMIT_VALUE, selectedState);

  // Collect all skipped rows: headers + validation errors
  const allSkippedRows: SkippedRow[] = [...headerSkippedRows];
  
  // Convert validation errors to skipped rows
  for (const error of importResult.errors) {
    // Determine reason based on error field/reason
    let reason: SkippedRow['reason'] = 'Invalid Data';
    if (error.reason.toLowerCase().includes('coordinate') || error.reason.toLowerCase().includes('gps')) {
      reason = 'Missing Coordinates';
    } else if (error.reason.toLowerCase().includes('mapping') || error.reason.toLowerCase().includes('county')) {
      reason = 'Mapping Failed';
    }
    
    allSkippedRows.push({
      rowNumber: error.row + 1, // Convert to 1-indexed
      reason,
      rawContent: `${error.field}: ${error.value} - ${error.reason}`.substring(0, 200)
    });
  }

  // Check for existing permits by API to avoid duplicates
  const existingPermits = await fetchAllRows<{ api: string }>((a, b) =>
    supabase.from('permits').select('api').order('id').range(a, b));

  const existingApis = new Set(existingPermits.map(p => p.api));
  const newPermits = importResult.permits.filter(p => !existingApis.has(p.api));
  
  // Free accounts can import a small file to try the workflow.
  if (newPermits.length > FREE_IMPORT_ROW_LIMIT) {
    const { data: prof } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    if ((prof?.plan ?? 'free') === 'free') {
      window.dispatchEvent(new CustomEvent('midconsight:free-limit'));
      throw new Error(`The free plan imports up to ${FREE_IMPORT_ROW_LIMIT} permits at a time. This file has ${newPermits.length}.`);
    }
  }

  // Track duplicates as skipped rows
  const duplicatePermits = importResult.permits.filter(p => existingApis.has(p.api));
  for (const dup of duplicatePermits) {
    allSkippedRows.push({
      rowNumber: 0, // We don't track original row number for permits
      reason: 'Duplicate',
      rawContent: `API: ${dup.api} - ${dup.operator}`.substring(0, 200)
    });
  }

  // Insert dataset
  const { data: datasetData, error: datasetError } = await supabase
    .from('datasets')
    .insert({
      id: datasetId,
      user_id: user.id,
      name,
      file_name: file.name,
      permit_count: newPermits.length,
      valid_rows: importResult.validRows,
      skipped_rows: importResult.skippedRows,
      is_active: true
    })
    .select()
    .single();

  if (datasetError) throw datasetError;

  // Insert new permits (skip duplicates)
  if (newPermits.length > 0) {
    const permitsToInsert = newPermits.map(p => ({
      id: crypto.randomUUID(),
      user_id: user.id,
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
      estimated_value: AVG_PERMIT_VALUE
    }));

    const { error: permitsError } = await supabase
      .from('permits')
      .insert(permitsToInsert);

    if (permitsError) throw permitsError;
  }

  // Rebuild companies from all permits
  await rebuildCompanies(user.id);

  // Log activity
  await supabase.from('activities').insert({
    user_id: user.id,
    type: 'import',
    description: `Imported ${newPermits.length} new permits from ${file.name}. ${importResult.skippedRows} rows skipped, ${duplicatePermits.length} duplicates.`
  });

  return { 
    dataset: datasetData as DbDataset, 
    importResult: {
      ...importResult,
      validRows: newPermits.length,
      skippedRows: importResult.skippedRows + duplicatePermits.length
    },
    metadata,
    skippedRows: allSkippedRows
  };
}

async function rebuildCompanies(userId: string): Promise<void> {
  // Get all permits
  const permits = await fetchAllRows((a, b) =>
    supabase.from('permits').select('*').eq('user_id', userId).order('id').range(a, b));

  if (permits.length === 0) return;

  // Group permits by operator
  const operatorMap = new Map<string, typeof permits>();
  permits.forEach(permit => {
    const existing = operatorMap.get(permit.operator) || [];
    existing.push(permit);
    operatorMap.set(permit.operator, existing);
  });

  // Get existing companies
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId);

  const existingCompanyMap = new Map((existingCompanies || []).map(c => [c.name, c]));

  // Build company records
  const companiesToUpsert: any[] = [];

  operatorMap.forEach((operatorPermits, operatorName) => {
    const existingCompany = existingCompanyMap.get(operatorName);
    const lastPermitDate = operatorPermits.reduce((latest, p) => {
      const date = p.approval_date || p.date_imported;
      return date > latest ? date : latest;
    }, '1900-01-01');

    const totalValue = operatorPermits.length * AVG_PERMIT_VALUE;

    companiesToUpsert.push({
      id: existingCompany?.id || crypto.randomUUID(),
      user_id: userId,
      name: operatorName,
      operator_number: operatorPermits[0]?.operator_number,
      permit_count: operatorPermits.length,
      total_value: totalValue,
      // Same rule the app shows live (src/lib/scoring.ts, v4.1).
      score: scoreOperator(operatorPermits.map((p) => dbPermitToApp(p as DbPermit)), DEFAULT_WINDOW_DAYS).score,
      last_permit_date: lastPermitDate,
      city: operatorPermits[0]?.city,
      state: operatorPermits[0]?.state
    });
  });

  // Upsert companies
  for (const company of companiesToUpsert) {
    const { error } = await supabase
      .from('companies')
      .upsert(company, { onConflict: 'id' });
    
    if (error) console.error('Failed to upsert company:', error);
  }
}

// ============ SELLING OPTIONS ============

export async function getSellingOptions(): Promise<DbSellingOption[]> {
  const { data, error } = await supabase
    .from('selling_options')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as DbSellingOption[];
}

/** Raised by the database when a free account tries to go past its limit (3 deals, 3 products). */
export function isFreeLimitError(err: unknown): boolean {
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  return msg.includes('FREE_LIMIT');
}

function announceFreeLimit(err: unknown) {
  if (isFreeLimitError(err) && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('midconsight:free-limit'));
  }
}

export const FREE_IMPORT_ROW_LIMIT = 100;

export async function saveSellingOption(
  option: Omit<DbSellingOption, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<DbSellingOption> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('selling_options')
    .insert({
      ...option,
      user_id: user.id
    })
    .select()
    .single();

  if (error) {
    announceFreeLimit(error);
    throw error;
  }
  return data as DbSellingOption;
}

export async function updateSellingOption(
  id: string,
  updates: Partial<DbSellingOption>
): Promise<void> {
  const { error } = await supabase
    .from('selling_options')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSellingOption(id: string): Promise<void> {
  const { error } = await supabase
    .from('selling_options')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getSellingOptionById(id: string): Promise<DbSellingOption | null> {
  const { data, error } = await supabase
    .from('selling_options')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as DbSellingOption;
}

// ============ PRODUCT-FIT MATCHING ============
// The connective tissue between "what's this operator drilling" (real
// permit fields already captured on import) and "what do I sell" (the
// catalog above). Single source of truth — used by Research Desk today,
// and the Map/Company views once they surface product fit too.

export interface ProductFitMatch {
  product: DbSellingOption;
  /** 0 = no signal either way (product has no criteria set, or nothing to compare).
   *  Higher = more criteria matched. Never negative — a mismatch on one
   *  dimension doesn't disqualify a product that matches on others. */
  score: number;
  reasons: string[];
}

/**
 * Scores every product in the catalog against a permit's actual
 * characteristics (formation, well type, depth). Returns matches sorted
 * best-first. A product with zero criteria set on every field is treated
 * as "general purpose" and included with score 0, not excluded — an
 * empty catalog shouldn't silently show nothing.
 */
export function matchProductsToPermit(
  permit: { formationName?: string; wellType?: string; totalDepth?: number },
  catalog: DbSellingOption[]
): ProductFitMatch[] {
  const permitFormation = (permit.formationName || '').toLowerCase().trim();
  const permitWellType = (permit.wellType || '').toLowerCase().trim();
  const permitDepth = permit.totalDepth;

  const matches = catalog.map((product) => {
    let score = 0;
    const reasons: string[] = [];

    const formations = (product.target_formations || []).map((f) => f.toLowerCase().trim());
    if (formations.length > 0 && permitFormation) {
      if (formations.some((f) => permitFormation.includes(f) || f.includes(permitFormation))) {
        score += 2;
        reasons.push(`Targets ${permit.formationName}`);
      }
    }

    const wellTypes = (product.applicable_well_types || []).map((t) => t.toLowerCase().trim());
    if (wellTypes.length > 0 && permitWellType) {
      if (wellTypes.some((t) => permitWellType.includes(t) || t.includes(permitWellType))) {
        score += 1;
        reasons.push(`Applies to ${permit.wellType} wells`);
      }
    }

    if (permitDepth && (product.min_depth || product.max_depth)) {
      const min = product.min_depth ?? -Infinity;
      const max = product.max_depth ?? Infinity;
      if (permitDepth >= min && permitDepth <= max) {
        score += 1;
        reasons.push(`Fits ${permitDepth.toLocaleString()} ft depth range`);
      }
    }

    return { product, score, reasons };
  });

  return matches.sort((a, b) => b.score - a.score);
}

/** Convenience wrapper: best single match, or null if the catalog is empty. */
export function suggestBestProduct(
  permit: { formationName?: string; wellType?: string; totalDepth?: number },
  catalog: DbSellingOption[]
): ProductFitMatch | null {
  if (catalog.length === 0) return null;
  const matches = matchProductsToPermit(permit, catalog);
  return matches[0] || null;
}

// ============ COMPANY UPDATES ============

export async function updateCompany(
  id: string,
  updates: Partial<Pick<DbCompany, 'is_current_client' | 'hq_address' | 'primary_contact_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

/**
 * Turns a preview company (id like `preview-OperatorName`, computed
 * client-side from the shared permit feed — see useSupabaseData's
 * buildCompanyRollups) into a real row in the `companies` table.
 *
 * Call this before any write that needs a real company_id foreign key
 * (creating a deal, marking as a client) if the company you're acting on
 * has `isPreview: true`. Returns the real company with its new UUID.
 */
export async function promoteCompanyPreview(preview: {
  name: string;
  operatorNumber?: string;
  permitCount: number;
  totalValue: number;
  score: 'hot' | 'warm' | 'cold';
  lastPermitDate: string;
  city?: string;
  state?: string;
}): Promise<DbCompany> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('companies')
    .upsert(
      {
        user_id: user.id,
        name: preview.name,
        operator_number: preview.operatorNumber,
        permit_count: preview.permitCount,
        total_value: preview.totalValue,
        score: preview.score,
        last_permit_date: preview.lastPermitDate,
        city: preview.city,
        state: preview.state,
      },
      { onConflict: 'user_id,name' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as DbCompany;
}

// ============ LICENSE PURCHASES ============

export async function getLicensePurchases(companyId: string): Promise<DbLicensePurchase[]> {
  const { data, error } = await supabase
    .from('license_purchases')
    .select('*')
    .eq('company_id', companyId)
    .order('purchase_date', { ascending: false });

  if (error) throw error;
  return (data || []) as DbLicensePurchase[];
}

export async function saveLicensePurchase(
  license: Omit<DbLicensePurchase, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<DbLicensePurchase> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('license_purchases')
    .insert({
      ...license,
      user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data as DbLicensePurchase;
}

export async function deleteLicensePurchase(id: string): Promise<void> {
  const { error } = await supabase
    .from('license_purchases')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ OPERATOR RESEARCH STATUS ============
// Replaces the old localStorage-based persistence (device-local, not
// synced across team members). Statuses now live in Supabase, scoped
// per-user via RLS just like everything else in this file.

export type OperatorResearchStatus = 'new' | 'researching' | 'verified' | 'current_client' | 'archived';

export interface DbOperatorResearchStatus {
  id: string;
  user_id: string;
  operator: string;
  status: OperatorResearchStatus;
  created_at: string;
  updated_at: string;
}

/** Fetch all research statuses for the current user, keyed by operator name. */
export async function getAllResearchStatuses(): Promise<Record<string, OperatorResearchStatus>> {
  const { data, error } = await supabase
    .from('operator_research_status')
    .select('operator, status');

  if (error) throw error;

  const map: Record<string, OperatorResearchStatus> = {};
  for (const row of data || []) {
    map[row.operator] = row.status as OperatorResearchStatus;
  }
  return map;
}

/** Upsert a single operator's research status. */
export async function setResearchStatus(
  operator: string,
  status: OperatorResearchStatus
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('operator_research_status')
    .upsert(
      { user_id: user.id, operator, status },
      { onConflict: 'user_id,operator' }
    );

  if (error) throw error;
}

// ============ PROFILE / PLAN ============

export interface DbProfile {
  id: string;
  plan: 'free' | 'starter' | 'pro';
  full_name: string | null;
  company_name: string | null;
  marketing_consent: boolean;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  activated_at: string | null;
  paywall_hits: number;
  last_digest_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProfile(): Promise<DbProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as DbProfile | null;
}

/** Call when a free-plan user clicks into a gated tab. Returns the new count. */
export async function incrementPaywallHits(): Promise<number> {
  const { data, error } = await supabase.rpc('increment_paywall_hits');
  if (error) throw error;
  return data as number;
}

/** Call the first time a user views a permit. Safe to call repeatedly — no-ops after the first time. */
export async function markActivated(): Promise<void> {
  const { error } = await supabase.rpc('mark_activated');
  if (error) throw error;
}

/** Result of asking the server for a Stripe page. `notConfigured` means billing is not switched on yet. */
export type BillingResult = { url: string } | { notConfigured: true } | { error: string };

async function callBilling(fn: 'create-checkout' | 'billing-portal', body: Record<string, unknown>): Promise<BillingResult> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body: { ...body, returnOrigin: window.location.origin },
  });
  if (error) {
    // supabase-js hides the response body in `error.context`; read it to see our own error code.
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'billing_not_configured') return { notConfigured: true };
    return { error: payload?.error ?? error.message };
  }
  if (data?.url) return { url: data.url as string };
  return { error: data?.error ?? 'No checkout link came back.' };
}

/** Starts Stripe Checkout for a plan. The plan itself is only changed by the server after Stripe confirms payment. */
export function startCheckout(tier: 'starter' | 'pro', interval: 'month' | 'year'): Promise<BillingResult> {
  return callBilling('create-checkout', { tier, interval });
}

/** Opens Stripe's billing portal (card, plan change, cancel). */
export function openBillingPortal(): Promise<BillingResult> {
  return callBilling('billing-portal', {});
}

/** Records upgrade intent. Used only while Stripe billing is not switched on yet. */
export async function requestUpgrade(source: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('upgrade_requests')
    .insert({ user_id: user.id, source });

  if (error) throw error;
}

