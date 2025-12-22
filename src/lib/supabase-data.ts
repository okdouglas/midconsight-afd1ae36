/**
 * Supabase Data Layer for MidconSight
 * Replaces IndexedDB with persistent cloud storage
 */

import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { processExcelData, generateId, type Permit, type ImportResult } from './schema-mapping';
import type { ImportMetadata, SkippedRow } from '@/components/ImportAddendum';

const AVG_PERMIT_VALUE = 5000; // Updated to $5k per permit

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
    isCentroidMapped
  };
}

// ============ FETCH OPERATIONS ============

export async function getAllPermits(): Promise<Permit[]> {
  const { data, error } = await supabase
    .from('permits')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(dbPermitToApp);
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

  if (error) throw error;
  return data as DbDeal;
}

export async function updateDeal(id: string, updates: Partial<DbDeal>): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .update(updates)
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

function calculateScore(permitCount: number, recentPermits: number): 'hot' | 'warm' | 'cold' {
  if (permitCount >= 5 || recentPermits >= 3) return 'hot';
  if (permitCount >= 3 || recentPermits >= 2) return 'warm';
  return 'cold';
}

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
  const { data: existingPermits } = await supabase
    .from('permits')
    .select('api');
  
  const existingApis = new Set((existingPermits || []).map(p => p.api));
  const newPermits = importResult.permits.filter(p => !existingApis.has(p.api));
  
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
  const { data: permits } = await supabase
    .from('permits')
    .select('*')
    .eq('user_id', userId);

  if (!permits || permits.length === 0) return;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

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
    const recentPermits = operatorPermits.filter(p => p.date_imported >= thirtyDaysAgo).length;

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
      score: calculateScore(operatorPermits.length, recentPermits),
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

  if (error) throw error;
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
