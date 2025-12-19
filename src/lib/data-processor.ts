/**
 * Data Processing Layer
 * Handles Excel file parsing and company score calculation
 */

import * as XLSX from 'xlsx';
import { processExcelData, generateId, type Permit, type ImportResult } from './schema-mapping';
import {
  saveDataset,
  savePermits,
  saveCompanies,
  saveActivity,
  setActiveDataset,
  getPermitsByDataset,
  getAllCompanies,
  type Dataset,
  type Company,
} from './indexeddb';

const AVG_PERMIT_VALUE = 50000;

/**
 * Parse Excel/CSV file and return raw data
 */
export async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with headers
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

/**
 * Calculate company score based on permit activity
 */
export function calculateScore(permitCount: number, recentPermits: number): 'hot' | 'warm' | 'cold' {
  // Hot: 5+ permits OR 3+ in last 30 days
  if (permitCount >= 5 || recentPermits >= 3) return 'hot';
  
  // Warm: 3-4 permits OR 2 in last 30 days  
  if (permitCount >= 3 || recentPermits >= 2) return 'warm';
  
  // Cold: <3 permits
  return 'cold';
}

/**
 * Build/update companies from permits
 */
export async function buildCompaniesFromPermits(permits: Permit[]): Promise<Company[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
  
  // Group permits by operator
  const operatorMap = new Map<string, Permit[]>();
  
  permits.forEach(permit => {
    const existing = operatorMap.get(permit.operator) || [];
    existing.push(permit);
    operatorMap.set(permit.operator, existing);
  });
  
  // Get existing companies for merging
  const existingCompanies = await getAllCompanies();
  const existingCompanyMap = new Map(existingCompanies.map(c => [c.name, c]));
  
  // Build company records
  const companies: Company[] = [];
  
  operatorMap.forEach((operatorPermits, operatorName) => {
    const existingCompany = existingCompanyMap.get(operatorName);
    const recentPermits = operatorPermits.filter(p => p.dateImported >= thirtyDaysAgo).length;
    
    const lastPermitDate = operatorPermits.reduce((latest, p) => {
      const date = p.approvalDate || p.dateImported;
      return date > latest ? date : latest;
    }, '1900-01-01');
    
    const totalValue = operatorPermits.reduce((sum, p) => sum + (p.estimatedValue || AVG_PERMIT_VALUE), 0);
    
    companies.push({
      id: existingCompany?.id || generateId('company'),
      name: operatorName,
      operatorNumber: operatorPermits[0]?.operatorNumber,
      permitCount: operatorPermits.length,
      totalValue,
      score: calculateScore(operatorPermits.length, recentPermits),
      lastPermitDate,
      createdDate: existingCompany?.createdDate || new Date().toISOString(),
      city: operatorPermits[0]?.city,
      state: operatorPermits[0]?.state,
    });
  });
  
  return companies;
}

/**
 * Import a file and save to IndexedDB
 */
export async function importFile(
  file: File,
  datasetName?: string
): Promise<{
  dataset: Dataset;
  importResult: ImportResult;
  companies: Company[];
}> {
  // Parse the file
  const rawData = await parseFile(file);
  
  // Create dataset record
  const datasetId = generateId('dataset');
  const name = datasetName || `Import ${new Date().toLocaleDateString()}`;
  
  // Process and validate data
  const importResult = processExcelData(rawData, datasetId, AVG_PERMIT_VALUE);
  
  // Create dataset metadata
  const dataset: Dataset = {
    id: datasetId,
    name,
    uploadedAt: new Date().toISOString(),
    fileName: file.name,
    permitCount: importResult.validRows,
    validRows: importResult.validRows,
    skippedRows: importResult.skippedRows,
    errors: importResult.errors,
    isActive: true
  };
  
  // Save to IndexedDB
  await saveDataset(dataset);
  await setActiveDataset(datasetId);
  await savePermits(importResult.permits);
  
  // Build and save companies
  const companies = await buildCompaniesFromPermits(importResult.permits);
  await saveCompanies(companies);
  
  // Log activity
  await saveActivity({
    id: generateId('activity'),
    type: 'import',
    description: `Imported ${importResult.validRows} permits from ${file.name}. ${importResult.skippedRows} rows skipped due to validation errors.`,
    date: new Date().toISOString()
  });
  
  return { dataset, importResult, companies };
}

/**
 * Compare two datasets and return differences
 */
export async function compareDatasets(
  datasetId1: string,
  datasetId2: string
): Promise<{
  newPermits: Permit[];
  removedPermits: Permit[];
  commonCount: number;
}> {
  const permits1 = await getPermitsByDataset(datasetId1);
  const permits2 = await getPermitsByDataset(datasetId2);
  
  const apiSet1 = new Set(permits1.map(p => p.api));
  const apiSet2 = new Set(permits2.map(p => p.api));
  
  const newPermits = permits2.filter(p => !apiSet1.has(p.api));
  const removedPermits = permits1.filter(p => !apiSet2.has(p.api));
  const commonCount = permits2.filter(p => apiSet1.has(p.api)).length;
  
  return { newPermits, removedPermits, commonCount };
}
