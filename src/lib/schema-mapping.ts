/**
 * Schema Mapping Layer for ITD Excel Format
 * Maps ITD-wells-formations-daily columns to internal data model
 */

// ITD Excel column names → Internal field names
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
 * Maps a raw Excel row to the internal Permit model
 */
export function mapRowToPermit(
  row: Record<string, unknown>,
  rowIndex: number,
  datasetId: string,
  avgPermitValue: number = 50000
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
  
  if (lat === undefined || lon === undefined || lat === 0 || lon === 0) {
    errors.push({
      row: rowIndex,
      field: 'Surf_Lat_Y/Surf_Long_X',
      value: `lat: ${lat}, lon: ${lon}`,
      reason: 'Invalid or missing coordinates'
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
    state: String(getValue('State') ?? '').trim() || undefined,
    zipCode: String(getValue('Zip_Code') ?? '').trim() || undefined,
    
    // Metadata
    imageUrl: String(getValue('IMAGE_URL') ?? '').trim() || undefined,
    remarks: String(getValue('Remarks') ?? '').trim() || undefined,
    dateImported: new Date().toISOString().split('T')[0],
    datasetId,
    
    // Calculated value
    estimatedValue: avgPermitValue
  };
  
  return { permit, errors };
}

/**
 * Validates and transforms raw Excel data to permits
 */
export function processExcelData(
  rawData: Record<string, unknown>[],
  datasetId: string,
  avgPermitValue: number = 50000
): ImportResult {
  const permits: Permit[] = [];
  const allErrors: ValidationError[] = [];
  let skippedRows = 0;
  
  rawData.forEach((row, index) => {
    const { permit, errors } = mapRowToPermit(row, index + 2, datasetId, avgPermitValue);
    
    allErrors.push(...errors);
    
    if (permit) {
      permits.push(permit);
    } else {
      skippedRows++;
    }
  });
  
  return {
    permits,
    errors: allErrors,
    totalRows: rawData.length,
    validRows: permits.length,
    skippedRows
  };
}
