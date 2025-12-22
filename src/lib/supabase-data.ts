/**
 * Supabase Data Layer for MidconSight
 * Replaces IndexedDB with persistent cloud storage
 */

import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { processExcelData, generateId, type Permit, type ImportResult } from './schema-mapping';
import { parseTexasZipFile, type TexasPermit as ParsedTexasPermit } from './texas-parser';

const AVG_PERMIT_VALUE = 5000; // Updated to $5k per permit

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
  created_at: string;
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
    estimatedValue: Number(p.estimated_value)
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

export async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
          raw: false
        });
        resolve(jsonData);
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
  datasetName?: string
): Promise<{ dataset: DbDataset; importResult: ImportResult }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rawData = await parseFile(file);
  const datasetId = crypto.randomUUID();
  const name = datasetName || `Import ${new Date().toLocaleDateString()}`;
  
  const importResult = processExcelData(rawData, datasetId, AVG_PERMIT_VALUE);

  // Check for existing permits by API to avoid duplicates
  const { data: existingPermits } = await supabase
    .from('permits')
    .select('api');
  
  const existingApis = new Set((existingPermits || []).map(p => p.api));
  const newPermits = importResult.permits.filter(p => !existingApis.has(p.api));

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
    description: `Imported ${newPermits.length} new permits from ${file.name}. ${importResult.skippedRows} rows skipped, ${importResult.validRows - newPermits.length} duplicates.`
  });

  return { 
    dataset: datasetData as DbDataset, 
    importResult: {
      ...importResult,
      validRows: newPermits.length,
      skippedRows: importResult.skippedRows + (importResult.validRows - newPermits.length)
    }
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

// ============ TEXAS RRC IMPORT ============

interface TexasPermit {
  universalDocNo: string;
  api: string;
  operator: string;
  operatorNumber: string;
  county: string;
  wellName: string;
  wellNumber: string;
  totalDepth: number;
  approvalDate: string;
  lat: number | null;
  lon: number | null;
  districtCode: string;
  leaseNumber: string;
  permitType: string;
}

interface TexasSyncResponse {
  success: boolean;
  permits?: TexasPermit[];
  error?: string;
  hint?: string;
  stats?: {
    total: number;
    withGps: number;
    withoutGps: number;
  };
}

export async function importTexasPermits(
  datasetName: string,
  onStatusUpdate?: (status: string) => void
): Promise<{ validRows: number; skippedRows: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  onStatusUpdate?.('Fetching data from Texas RRC...');

  // Call the edge function
  const { data, error } = await supabase.functions.invoke<TexasSyncResponse>('texas-rrc-sync');

  if (error) {
    throw new Error(`Failed to sync: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Unknown error from Texas RRC sync');
  }

  if (!data.permits || data.permits.length === 0) {
    throw new Error('No permits returned from Texas RRC');
  }

  onStatusUpdate?.(`Parsing ${data.permits.length} permits...`);

  // Check for existing permits by API to avoid duplicates
  const { data: existingPermits } = await supabase
    .from('permits')
    .select('api');
  
  const existingApis = new Set((existingPermits || []).map(p => p.api));
  
  // Filter to only permits with valid coordinates and new APIs
  const validPermits = data.permits.filter(p => 
    p.lat !== null && 
    p.lon !== null && 
    p.operator &&
    !existingApis.has(p.api)
  );

  const skippedCount = data.permits.length - validPermits.length;

  onStatusUpdate?.(`Importing ${validPermits.length} new permits...`);

  if (validPermits.length === 0) {
    return { validRows: 0, skippedRows: skippedCount };
  }

  // Create dataset
  const datasetId = crypto.randomUUID();
  const { error: datasetError } = await supabase
    .from('datasets')
    .insert({
      id: datasetId,
      user_id: user.id,
      name: datasetName,
      file_name: 'Texas RRC Sync',
      permit_count: validPermits.length,
      valid_rows: validPermits.length,
      skipped_rows: skippedCount,
      is_active: true
    });

  if (datasetError) throw datasetError;

  // Insert permits
  const permitsToInsert = validPermits.map(p => ({
    id: crypto.randomUUID(),
    user_id: user.id,
    api: p.api,
    operator: p.operator,
    operator_number: p.operatorNumber,
    lat: p.lat!,
    lon: p.lon!,
    county: p.county,
    well_name: p.wellName,
    well_number: p.wellNumber,
    total_depth: p.totalDepth,
    approval_date: p.approvalDate,
    permit_type: p.permitType,
    state: 'TX',
    date_imported: new Date().toISOString().split('T')[0],
    dataset_id: datasetId,
    estimated_value: AVG_PERMIT_VALUE
  }));

  const { error: permitsError } = await supabase
    .from('permits')
    .insert(permitsToInsert);

  if (permitsError) throw permitsError;

  // Rebuild companies
  onStatusUpdate?.('Updating company records...');
  await rebuildCompanies(user.id);

  // Log activity
  await supabase.from('activities').insert({
    user_id: user.id,
    type: 'import',
    description: `Synced ${validPermits.length} Texas RRC permits. ${skippedCount} skipped (duplicates or missing GPS).`
  });

  return { validRows: validPermits.length, skippedRows: skippedCount };
}

// ============ TEXAS ZIP FILE IMPORT ============

export async function importTexasPermitsFromZip(
  file: File,
  datasetName: string
): Promise<{ validRows: number; skippedRows: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Parse the ZIP file client-side
  const parseResult = await parseTexasZipFile(file);

  if (!parseResult.success) {
    throw new Error(parseResult.error || 'Failed to parse Texas ZIP file');
  }

  if (!parseResult.permits || parseResult.permits.length === 0) {
    throw new Error('No permits found in the ZIP file. Make sure you downloaded the correct file from RRC.');
  }

  console.log(`Parsed ${parseResult.permits.length} permits from ZIP`);

  // Check for existing permits by API to avoid duplicates
  const { data: existingPermits } = await supabase
    .from('permits')
    .select('api');
  
  const existingApis = new Set((existingPermits || []).map(p => p.api));
  
  // Filter to only permits with valid coordinates and new APIs
  const validPermits = parseResult.permits.filter(p => 
    p.lat !== null && 
    p.lon !== null && 
    p.operator &&
    !existingApis.has(p.api)
  );

  const skippedCount = parseResult.permits.length - validPermits.length;

  console.log(`Valid new permits: ${validPermits.length}, Skipped: ${skippedCount}`);

  if (validPermits.length === 0) {
    return { validRows: 0, skippedRows: skippedCount };
  }

  // Create dataset
  const datasetId = crypto.randomUUID();
  const { error: datasetError } = await supabase
    .from('datasets')
    .insert({
      id: datasetId,
      user_id: user.id,
      name: datasetName,
      file_name: file.name,
      permit_count: validPermits.length,
      valid_rows: validPermits.length,
      skipped_rows: skippedCount,
      is_active: true
    });

  if (datasetError) throw datasetError;

  // Insert permits
  const permitsToInsert = validPermits.map(p => ({
    id: crypto.randomUUID(),
    user_id: user.id,
    api: p.api,
    operator: p.operator,
    operator_number: p.operatorNumber,
    lat: p.lat!,
    lon: p.lon!,
    county: p.county,
    well_name: p.wellName,
    well_number: p.wellNumber,
    total_depth: p.totalDepth,
    approval_date: p.approvalDate,
    permit_type: p.permitType,
    state: 'TX',
    date_imported: new Date().toISOString().split('T')[0],
    dataset_id: datasetId,
    estimated_value: AVG_PERMIT_VALUE
  }));

  const { error: permitsError } = await supabase
    .from('permits')
    .insert(permitsToInsert);

  if (permitsError) throw permitsError;

  // Rebuild companies
  await rebuildCompanies(user.id);

  // Log activity
  await supabase.from('activities').insert({
    user_id: user.id,
    type: 'import',
    description: `Imported ${validPermits.length} Texas RRC permits from ${file.name}. ${skippedCount} skipped (duplicates or missing GPS).`
  });

  return { validRows: validPermits.length, skippedRows: skippedCount };
}
