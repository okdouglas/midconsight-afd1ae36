/**
 * Schema Mapping Layer for Multiple State Permit Formats
 * Supports: Oklahoma ITD, Texas RRC
 *
 * ⚠️ SYNC NOTE: This file is duplicated from src/lib/schema-mapping.ts so the
 * import-itd-weekly Edge Function (Deno runtime) can use identical parsing
 * logic to the browser's manual upload flow, without a shared build system
 * between the Vite frontend and Supabase Edge Functions. If you change the
 * Oklahoma ITD or Texas RRC column mapping in src/lib/schema-mapping.ts,
 * copy the same change here — otherwise automated imports will drift from
 * manual imports.
 */

import { getTexasCountyCoordinates } from './texas-counties';

// ITD Excel column names → Internal field names (Oklahoma)
export const ITD_COLUMN_MAP: Record<string, string> = {
  // Core identifiers
  'API_Number': 'api',
  'IMAGE_URL': 'imageUrl',
  
  // Operator/Company info
  'Operator_Number': 'operatorNumber',
  'Entity_Name': 'operator',
  'Address1': 'address1',
  'Address2': 'address2',
  'City': 'city',
  'State': 'state',
  'Zip_Code': 'zipCode',
  
  // Well information
  'Well_Name': 'wellName',
  'Well_Number': 'wellNumber',
  'Well_Type': 'wellType',
  'Well_Status': 'wellStatus',
  'Well_Class': 'wellClass',
  
  // Location data
  'Location_Type': 'locationType',
  'Location_Type_Sub': 'locationTypeSub',
  'Surf_Long_X': 'lon',
  'Surf_Lat_Y': 'lat',
  'County': 'county',
  'Section': 'section',
  'Township': 'township',
  'Range': 'range',
  'PM': 'pm',
  'Q1': 'q1',
  'Q2': 'q2',
  'Q3': 'q3',
  'Q4': 'q4',
  'Footage_NS': 'footageNS',
  'NS': 'ns',
  'Footage_EW': 'footageEW',
  'EW': 'ew',
  
  // Proposed bottom hole location
  'Proposed_Bottom_Hole_Long_X': 'pbhLon',
  'Proposed_Bottom_Hole_Lat_Y': 'pbhLat',
  'PBH_County': 'pbhCounty',
  'PBH_Section': 'pbhSection',
  'PBH_Township': 'pbhTownship',
  'PBH_Range': 'pbhRange',
  
  // Depth and formation
  'Measured_Total_Depth': 'measuredTotalDepth',
  'True_Vertical_Depth': 'trueVerticalDepth',
  'Formation_Code': 'formationCode',
  'Formation_Name': 'formationName',
  'Formation_Depth': 'formationDepth',
  'Total_Depth': 'totalDepth',
  'Depth': 'depth',
  
  // Permit information
  'Permit_Type': 'permitType',
  'Permit_Status': 'permitStatus',
  'Application_Type': 'applicationType',
  'Drill_Type': 'drillType',
  
  // Dates
  'Approval_Date': 'approvalDate',
  'Expire_Date': 'expireDate',
  'Submit_Date': 'submitDate',
  'Create_Date': 'createDate',
  'Modify_Date': 'modifyDate',
  'Hearing_Date': 'hearingDate',
  'Sign_Date': 'signDate',
  'Date_Of_Operation': 'dateOfOperation',
  
  // Personnel
  'Assigned_To': 'assignedTo',
  'Sign_Name': 'signName',
  'Sign_Phone': 'signPhone',
  'Create_User': 'createUser',
  'Modify_User': 'modifyUser',
  
  // Technical details
  'Ground_Elevation': 'groundElevation',
  'Surface_Casing_Depth': 'surfaceCasingDepth',
  'Depth_BTW': 'depthBTW',
  
  // Remarks
  'Remarks': 'remarks',
};

// Texas RRC column names → Internal field names
export const RRC_COLUMN_MAP: Record<string, string> = {
  'API NO.': 'api',
  'Operator Name/Number': 'operatorWithNumber',
  'Lease Name': 'wellName',
  'Well #': 'wellNumber',
  'Dist.': 'district',
  'County': 'county',
  'Wellbore Profile': 'drillType',
  'Filing Purpose': 'applicationType',
  'Amend': 'amend',
  'Total Depth': 'totalDepth',
  'Status Date': 'statusDate',
  'Status #': 'statusNumber',
  'Current Queue': 'permitStatus',
  'Stacked Lateral Parent Well DP #': 'parentWellId',
};

// Internal permit data model
export interface Permit {
  id: string;
  api: string;
  operator: string;
  operatorNumber?: string;
  
  // Location
  lat: number;
  lon: number;
  county?: string;
  section?: string;
  township?: string;
  range?: string;
  
  // Well info
  wellName?: string;
  wellNumber?: string;
  wellType?: string;
  wellStatus?: string;
  wellClass?: string;
  
  // Formation
  formationName?: string;
  formationCode?: string;
  formationDepth?: number;
  totalDepth?: number;
  measuredTotalDepth?: number;
  trueVerticalDepth?: number;
  
  // Permit info
  permitType?: string;
  permitStatus?: string;
  applicationType?: string;
  drillType?: string;
  
  // Dates
  approvalDate?: string;
  expireDate?: string;
  submitDate?: string;
  
  // Contact
  assignedTo?: string;
  signName?: string;
  
  // Address
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Metadata
  imageUrl?: string;
  remarks?: string;
  dateImported: string;
  datasetId: string;
  
  // Calculated
  estimatedValue: number;
  
  // Flag for centroid-mapped coordinates (Texas permits without exact location)
  isCentroidMapped?: boolean;
}

export interface ValidationError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

export interface ImportResult {
  permits: Permit[];
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
  sourceFormat?: 'itd' | 'rrc' | 'unknown';
}

/**
 * Normalizes a date string from various formats to ISO date format
 */
export function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined;
  
  const strValue = String(value).trim();
  if (!strValue || strValue === '1900-01-00 00:00:00') return undefined;
  
  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Handle ISO format with time
  if (strValue.includes('T') || strValue.includes(' ')) {
    const date = new Date(strValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Handle other date formats
  const date = new Date(strValue);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return undefined;
}

/**
 * Parses a numeric value safely
 */
export function parseNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = parseFloat(String(value));
  return isNaN(num) ? undefined : num;
}

/**
 * Generates a unique ID
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Detects the data format based on column headers
 */
export function detectDataFormat(row: Record<string, unknown>): 'itd' | 'rrc' | 'unknown' {
  const keys = Object.keys(row);
  
  // Check for Texas RRC format indicators
  if (keys.some(k => k === 'API NO.' || k === 'Operator Name/Number' || k === 'Lease Name')) {
    return 'rrc';
  }
  
  // Check for Oklahoma ITD format indicators
  if (keys.some(k => k === 'API_Number' || k === 'Entity_Name' || k === 'Surf_Lat_Y')) {
    return 'itd';
  }
  
  return 'unknown';
}

/**
 * Parse Texas RRC "Status Date" field to extract submit and approval dates
 * Format: "Submitted 04/23/2025 Approved 12/17/2025"
 */
function parseRrcStatusDate(statusDate: string): { submitDate?: string; approvalDate?: string } {
  const result: { submitDate?: string; approvalDate?: string } = {};
  
  const submitMatch = statusDate.match(/Submitted\s+(\d{2}\/\d{2}\/\d{4})/);
  if (submitMatch) {
    const [month, day, year] = submitMatch[1].split('/');
    result.submitDate = `${year}-${month}-${day}`;
  }
  
  const approvedMatch = statusDate.match(/Approved\s+(\d{2}\/\d{2}\/\d{4})/);
  if (approvedMatch) {
    const [month, day, year] = approvedMatch[1].split('/');
    result.approvalDate = `${year}-${month}-${day}`;
  }
  
  return result;
}

/**
 * Parse Texas RRC "Operator Name/Number" field
 * Format: "WPX ENERGY PERMIAN, LLC (942623)"
 */
function parseRrcOperator(operatorField: string): { operator: string; operatorNumber?: string } {
  const match = operatorField.match(/^(.+?)\s*\((\d+)\)\s*$/);
  if (match) {
    return {
      operator: match[1].trim(),
      operatorNumber: match[2]
    };
  }
  return { operator: operatorField.trim() };
}

/**
 * Maps a Texas RRC row to the internal Permit model
 * Uses county centroids with jitter for coordinates (TX RRC has no GPS)
 */
export function mapRrcRowToPermit(
  row: Record<string, unknown>,
  rowIndex: number,
  datasetId: string,
  avgPermitValue: number = 50000
): { permit: Permit | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  const getValue = (rrcColumn: string): unknown => {
    return row[rrcColumn];
  };
  
  // Parse API - it's numeric in RRC format
  const apiRaw = getValue('API NO.');
  const api = apiRaw ? String(apiRaw).trim() : '';
  
  // Parse operator name/number
  const operatorField = String(getValue('Operator Name/Number') ?? '').trim();
  const { operator, operatorNumber } = parseRrcOperator(operatorField);
  
  // Parse dates from status field
  const statusDate = String(getValue('Status Date') ?? '');
  const { submitDate, approvalDate } = parseRrcStatusDate(statusDate);
  
  // Get county for coordinate lookup
  const county = String(getValue('County') ?? '').trim();
  
  // Texas RRC doesn't provide lat/lon, so we use county centroids with jitter
  let lat: number | undefined;
  let lon: number | undefined;
  
  if (county) {
    const coords = getTexasCountyCoordinates(county, true); // Apply jitter for clustering
    if (coords) {
      [lat, lon] = coords;
    }
  }
  
  // Validate required fields
  if (!api) {
    errors.push({
      row: rowIndex,
      field: 'API NO.',
      value: String(apiRaw ?? ''),
      reason: 'Missing API number'
    });
  }
  
  if (!operator) {
    errors.push({
      row: rowIndex,
      field: 'Operator Name/Number',
      value: operatorField,
      reason: 'Missing operator name'
    });
  }
  
  if (!lat || !lon) {
    errors.push({
      row: rowIndex,
      field: 'County',
      value: county || 'empty',
      reason: `Could not determine coordinates for county: ${county || 'unknown'}`
    });
    return { permit: null, errors };
  }
  
  const permit: Permit = {
    id: generateId('permit'),
    api: api || generateId('temp'),
    operator: operator || 'Unknown Operator',
    operatorNumber,
    
    // Location (from county centroid with jitter)
    lat,
    lon,
    county,
    
    // Well info
    wellName: String(getValue('Lease Name') ?? '').trim() || undefined,
    wellNumber: String(getValue('Well #') ?? '').trim() || undefined,
    
    // Depth
    totalDepth: parseNumeric(getValue('Total Depth')),
    
    // Permit info
    permitStatus: String(getValue('Current Queue') ?? '').trim() || undefined,
    applicationType: String(getValue('Filing Purpose') ?? '').trim() || undefined,
    drillType: String(getValue('Wellbore Profile') ?? '').trim() || undefined,
    
    // Dates
    approvalDate,
    submitDate,
    
    // Set state to Texas
    state: 'TX',
    
    // Metadata
    dateImported: new Date().toISOString().split('T')[0],
    datasetId,
    
    // Calculated value
    estimatedValue: avgPermitValue,
    
    // Flag that coordinates are from county centroid (TX RRC only)
    isCentroidMapped: true
  };
  
  return { permit, errors };
}

/**
 * Maps an Oklahoma ITD row to the internal Permit model
 * Uses precise GPS coordinates directly from the file
 */
/**
 * Maps an Oklahoma ITD row to the internal Permit model
 * Uses precise GPS coordinates directly from the file (no jitter)
 */
export function mapRowToPermit(
  row: Record<string, unknown>,
  rowIndex: number,
  datasetId: string,
  avgPermitValue: number = 50000,
  forceState?: string
): { permit: Permit | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  // Get value using the column map
  const getValue = (itdColumn: string): unknown => {
    return row[itdColumn] ?? row[ITD_COLUMN_MAP[itdColumn]];
  };
  
  // Extract core fields
  const api = String(getValue('API_Number') ?? '').trim();
  const operator = String(getValue('Entity_Name') ?? '').trim();
  const lat = parseNumeric(getValue('Surf_Lat_Y'));
  const lon = parseNumeric(getValue('Surf_Long_X'));
  
  // Validate required fields
  if (!api) {
    errors.push({
      row: rowIndex,
      field: 'API_Number',
      value: String(getValue('API_Number') ?? ''),
      reason: 'Missing API number'
    });
  }
  
  if (!operator || operator === 'Unknown Operator') {
    errors.push({
      row: rowIndex,
      field: 'Entity_Name',
      value: String(getValue('Entity_Name') ?? ''),
      reason: 'Missing operator/entity name'
    });
  }
  
  // Oklahoma requires precise GPS - skip if missing
  if (lat === undefined || lon === undefined || lat === 0 || lon === 0) {
    errors.push({
      row: rowIndex,
      field: 'Surf_Lat_Y/Surf_Long_X',
      value: `lat: ${lat}, lon: ${lon}`,
      reason: 'Missing or invalid coordinates - Oklahoma data requires precise GPS'
    });
    return { permit: null, errors };
  }
  
  // Validate coordinate ranges (Oklahoma approximate bounds)
  if (lat < 33 || lat > 37 || lon < -103 || lon > -94) {
    errors.push({
      row: rowIndex,
      field: 'Surf_Lat_Y/Surf_Long_X',
      value: `lat: ${lat}, lon: ${lon}`,
      reason: 'Coordinates outside expected range (Oklahoma area)'
    });
    // Still allow import but flag as warning
  }
  
  const permit: Permit = {
    id: generateId('permit'),
    api: api || generateId('temp'),
    operator: operator || 'Unknown Operator',
    operatorNumber: String(getValue('Operator_Number') ?? '').trim() || undefined,
    
    // Location
    lat,
    lon,
    county: String(getValue('County') ?? '').trim() || undefined,
    section: String(getValue('Section') ?? '').trim() || undefined,
    township: String(getValue('Township') ?? '').trim() || undefined,
    range: String(getValue('Range') ?? '').trim() || undefined,
    
    // Well info
    wellName: String(getValue('Well_Name') ?? '').trim() || undefined,
    wellNumber: String(getValue('Well_Number') ?? '').trim() || undefined,
    wellType: String(getValue('Well_Type') ?? '').trim() || undefined,
    wellStatus: String(getValue('Well_Status') ?? '').trim() || undefined,
    wellClass: String(getValue('Well_Class') ?? '').trim() || undefined,
    
    // Formation
    formationName: String(getValue('Formation_Name') ?? '').trim() || undefined,
    formationCode: String(getValue('Formation_Code') ?? '').trim() || undefined,
    formationDepth: parseNumeric(getValue('Formation_Depth')),
    totalDepth: parseNumeric(getValue('Total_Depth')),
    measuredTotalDepth: parseNumeric(getValue('Measured_Total_Depth')),
    trueVerticalDepth: parseNumeric(getValue('True_Vertical_Depth')),
    
    // Permit info
    permitType: String(getValue('Permit_Type') ?? '').trim() || undefined,
    permitStatus: String(getValue('Permit_Status') ?? '').trim() || undefined,
    applicationType: String(getValue('Application_Type') ?? '').trim() || undefined,
    drillType: String(getValue('Drill_Type') ?? '').trim() || undefined,
    
    // Dates
    approvalDate: normalizeDate(getValue('Approval_Date')),
    expireDate: normalizeDate(getValue('Expire_Date')),
    submitDate: normalizeDate(getValue('Submit_Date')),
    
    // Contact
    assignedTo: String(getValue('Assigned_To') ?? '').trim() || undefined,
    signName: String(getValue('Sign_Name') ?? '').trim() || undefined,
    
    // Address
    city: String(getValue('City') ?? '').trim() || undefined,
    state: String(getValue('State') ?? '').trim() || forceState || 'OK',
    zipCode: String(getValue('Zip_Code') ?? '').trim() || undefined,
    
    // Metadata
    imageUrl: String(getValue('IMAGE_URL') ?? '').trim() || undefined,
    remarks: String(getValue('Remarks') ?? '').trim() || undefined,
    dateImported: new Date().toISOString().split('T')[0],
    datasetId,
    
    // Calculated value
    estimatedValue: avgPermitValue,
    
    // Oklahoma uses precise GPS - never centroid mapped
    isCentroidMapped: false
  };
  
  return { permit, errors };
}

/**
 * Validates and transforms raw Excel data to permits
 * Auto-detects the format (Oklahoma ITD or Texas RRC)
 * @param selectedState - User-selected state for proper coordinate handling
 */
export function processExcelData(
  rawData: Record<string, unknown>[],
  datasetId: string,
  avgPermitValue: number = 50000,
  selectedState?: string
): ImportResult {
  const permits: Permit[] = [];
  const allErrors: ValidationError[] = [];
  let skippedRows = 0;
  
  // Skip empty rows or header rows (Texas RRC has metadata rows at top)
  const dataRows = rawData.filter(row => {
    const keys = Object.keys(row);
    // Skip rows that are search criteria or empty
    if (keys.length < 3) return false;
    // Skip the "Search Criteria" header row from Texas RRC
    if (Object.values(row).some(v => String(v).includes('Search Criteria'))) return false;
    return true;
  });
  
  if (dataRows.length === 0) {
    return {
      permits: [],
      errors: [{ row: 0, field: 'file', value: '', reason: 'No valid data rows found' }],
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
      sourceFormat: 'unknown'
    };
  }
  
  // Detect format from first valid row OR use selected state to determine format
  let format = detectDataFormat(dataRows[0]);
  
  // If user selected TX and format is unknown, treat as RRC
  if (selectedState === 'TX' && format === 'unknown') {
    format = 'rrc';
  }
  // If user selected OK and format is unknown, treat as ITD
  if (selectedState === 'OK' && format === 'unknown') {
    format = 'itd';
  }
  
  dataRows.forEach((row, index) => {
    let result: { permit: Permit | null; errors: ValidationError[] };
    
    if (format === 'rrc') {
      // Texas RRC: Use county centroids with jitter
      result = mapRrcRowToPermit(row, index + 2, datasetId, avgPermitValue);
    } else {
      // Oklahoma ITD: Use precise GPS coordinates (no jitter)
      result = mapRowToPermit(row, index + 2, datasetId, avgPermitValue, selectedState);
    }
    
    allErrors.push(...result.errors);
    
    if (result.permit) {
      permits.push(result.permit);
    } else {
      skippedRows++;
    }
  });
  
  return {
    permits,
    errors: allErrors,
    totalRows: dataRows.length,
    validRows: permits.length,
    skippedRows,
    sourceFormat: format
  };
}
