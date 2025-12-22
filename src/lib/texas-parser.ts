/**
 * Texas RRC ZIP File Parser
 * Parses the drilling permit ZIP files from RRC containing:
 * - dp_drilling_permit_pending_*.txt (permit data)
 * - dp_latlongs_pending_*.txt (GPS coordinates)
 */

import JSZip from 'jszip';

export interface TexasPermit {
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

interface ParseResult {
  success: boolean;
  permits: TexasPermit[];
  stats: {
    total: number;
    withGps: number;
    withoutGps: number;
    files: string[];
  };
  error?: string;
}

function parsePermitFile(content: string): Map<string, Record<string, string>> {
  const lines = content.split('\n').filter(line => line.trim());
  const results = new Map<string, Record<string, string>>();
  
  console.log(`Parsing permit file with ${lines.length} lines`);
  
  if (lines.length < 2) return results;
  
  // Detect format - tab or pipe delimited
  const headerLine = lines[0];
  const isTabDelimited = headerLine.includes('\t');
  const isPipeDelimited = headerLine.includes('|');
  const delimiter = isTabDelimited ? '\t' : isPipeDelimited ? '|' : '\t';
  
  const headers = headerLine.split(delimiter).map(h => h.trim().toUpperCase().replace(/"/g, ''));
  console.log('Permit file headers:', headers.slice(0, 15));
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
    const record: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    // Find the document number key
    const key = record['UNIVERSAL_DOC_NO'] || 
                record['UNI_DOC_NO'] || 
                record['UNIV_DOC_NO'] ||
                record['DOC_NO'] ||
                String(i);
    
    if (key && key !== String(i)) {
      results.set(key, record);
    }
  }
  
  console.log(`Parsed ${results.size} permit records`);
  return results;
}

function parseLatLongFile(content: string): Map<string, { lat: number; lon: number }> {
  const lines = content.split('\n').filter(line => line.trim());
  const results = new Map<string, { lat: number; lon: number }>();
  
  console.log(`Parsing lat/long file with ${lines.length} lines`);
  
  if (lines.length < 2) return results;
  
  const headerLine = lines[0];
  const isTabDelimited = headerLine.includes('\t');
  const isPipeDelimited = headerLine.includes('|');
  const delimiter = isTabDelimited ? '\t' : isPipeDelimited ? '|' : '\t';
  
  const headers = headerLine.split(delimiter).map(h => h.trim().toUpperCase().replace(/"/g, ''));
  console.log('LatLong file headers:', headers);
  
  // Find relevant column indices
  const docNoIdx = headers.findIndex(h => 
    h.includes('UNIVERSAL_DOC') || h.includes('UNI_DOC') || h.includes('UNIV_DOC') || h === 'DOC_NO'
  );
  const latIdx = headers.findIndex(h => 
    h.includes('SURF_LAT') || h.includes('LATITUDE') || h === 'LAT' || h.includes('_LAT')
  );
  const lonIdx = headers.findIndex(h => 
    h.includes('SURF_LONG') || h.includes('LONGITUDE') || h === 'LONG' || h === 'LON' || h.includes('_LONG')
  );
  
  console.log(`Column indices - DocNo: ${docNoIdx}, Lat: ${latIdx}, Lon: ${lonIdx}`);
  
  if (docNoIdx === -1 || latIdx === -1 || lonIdx === -1) {
    console.warn('Could not find all required columns in lat/long file');
    return results;
  }
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
    const docNo = values[docNoIdx];
    const latStr = values[latIdx];
    const lonStr = values[lonIdx];
    
    if (docNo && latStr && lonStr) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      
      // Validate coordinates are in Texas range
      if (!isNaN(lat) && !isNaN(lon) && 
          lat >= 25 && lat <= 37 && 
          lon >= -107 && lon <= -93) {
        results.set(docNo, { lat, lon });
      }
    }
  }
  
  console.log(`Parsed ${results.size} lat/long records`);
  return results;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Clean the date string
  const cleaned = dateStr.trim().replace(/"/g, '');
  
  // Try different date formats
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /^(\d{4})(\d{2})(\d{2})$/,  // YYYYMMDD
    /^(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const match = cleaned.match(patterns[i]);
    if (match) {
      if (i === 0) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else if (i === 1) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        return `${match[3]}-${match[1]}-${match[2]}`;
      }
    }
  }
  
  return new Date().toISOString().split('T')[0];
}

function joinPermitsWithCoords(
  permits: Map<string, Record<string, string>>,
  coords: Map<string, { lat: number; lon: number }>
): TexasPermit[] {
  const results: TexasPermit[] = [];
  
  permits.forEach((permit, docNo) => {
    const coord = coords.get(docNo);
    
    // Build API number from components
    const districtCode = permit['DISTRICT_CODE'] || permit['DIST_CODE'] || permit['DISTRICT'] || '';
    const countyCode = permit['COUNTY_CODE'] || permit['CNTY_CODE'] || permit['COUNTY_NO'] || '';
    const leaseNo = permit['LEASE_NO'] || permit['LEASE_NUMBER'] || permit['LEASE'] || '';
    
    // Texas API format: 42-XXX-XXXXX
    const api = `42${countyCode.padStart(3, '0')}${leaseNo.padStart(5, '0')}`;
    
    const texasPermit: TexasPermit = {
      universalDocNo: docNo,
      api: api,
      operator: permit['OPERATOR_NAME'] || permit['OPER_NAME'] || permit['OPERATOR'] || '',
      operatorNumber: permit['OPERATOR_NO'] || permit['OPER_NO'] || permit['OP_NO'] || '',
      county: permit['COUNTY_NAME'] || permit['COUNTY'] || '',
      wellName: permit['LEASE_NAME'] || permit['WELL_NAME'] || permit['LEASE'] || '',
      wellNumber: permit['WELL_NO'] || permit['WELL_NUMBER'] || permit['WELL'] || '',
      totalDepth: parseInt(permit['TOTAL_DEPTH'] || permit['PROPOSED_DEPTH'] || permit['DEPTH'] || '0') || 0,
      approvalDate: formatDate(permit['APPROVAL_DATE'] || permit['APPROVED_DATE'] || permit['STATUS_DATE'] || ''),
      lat: coord?.lat || null,
      lon: coord?.lon || null,
      districtCode: districtCode,
      leaseNumber: leaseNo,
      permitType: permit['PERMIT_TYPE'] || permit['TYPE_PERMIT'] || 'W-1'
    };
    
    // Only include permits with valid operator name
    if (texasPermit.operator) {
      results.push(texasPermit);
    }
  });
  
  return results;
}

export async function parseTexasZipFile(file: File): Promise<ParseResult> {
  try {
    console.log('Parsing Texas RRC ZIP file:', file.name);
    
    // Read the file as array buffer
    const buffer = await file.arrayBuffer();
    
    // Load the ZIP
    const zip = await JSZip.loadAsync(buffer);
    
    const fileNames = Object.keys(zip.files);
    console.log('ZIP contains files:', fileNames);
    
    // Find the permit and latlong files
    let permitFileName = fileNames.find(f => 
      (f.toLowerCase().includes('drilling_permit') || f.toLowerCase().includes('dp_')) && 
      !f.toLowerCase().includes('latlong') &&
      !f.toLowerCase().includes('lat_long') &&
      (f.endsWith('.txt') || f.endsWith('.csv'))
    );
    
    let latlongFileName = fileNames.find(f => 
      (f.toLowerCase().includes('latlong') || f.toLowerCase().includes('lat_long')) && 
      (f.endsWith('.txt') || f.endsWith('.csv'))
    );
    
    console.log('Permit file:', permitFileName);
    console.log('LatLong file:', latlongFileName);
    
    if (!permitFileName) {
      // Try finding any txt file that's not the latlong
      permitFileName = fileNames.find(f => 
        (f.endsWith('.txt') || f.endsWith('.csv')) && 
        !f.toLowerCase().includes('latlong') &&
        !f.toLowerCase().includes('lat_long')
      );
    }
    
    if (!permitFileName) {
      return {
        success: false,
        permits: [],
        stats: { total: 0, withGps: 0, withoutGps: 0, files: fileNames },
        error: `Could not find permit data file in the ZIP. Found files: ${fileNames.join(', ')}`
      };
    }
    
    // Extract and parse the permit file
    const permitFile = zip.file(permitFileName);
    if (!permitFile) {
      throw new Error('Could not read permit file from ZIP');
    }
    const permitContent = await permitFile.async('string');
    console.log('Permit file size:', permitContent.length, 'chars');
    
    const permits = parsePermitFile(permitContent);
    
    // Extract and parse the latlong file if present
    let coords = new Map<string, { lat: number; lon: number }>();
    if (latlongFileName) {
      const latlongFile = zip.file(latlongFileName);
      if (latlongFile) {
        const latlongContent = await latlongFile.async('string');
        console.log('LatLong file size:', latlongContent.length, 'chars');
        coords = parseLatLongFile(latlongContent);
      }
    }
    
    // Join the data
    const texasPermits = joinPermitsWithCoords(permits, coords);
    console.log(`Processed ${texasPermits.length} Texas permits`);
    
    // Stats
    const withCoords = texasPermits.filter(p => p.lat !== null && p.lon !== null).length;
    const withoutCoords = texasPermits.length - withCoords;
    
    console.log(`Permits with GPS: ${withCoords}, without GPS: ${withoutCoords}`);
    
    return {
      success: true,
      permits: texasPermits,
      stats: {
        total: texasPermits.length,
        withGps: withCoords,
        withoutGps: withoutCoords,
        files: fileNames
      }
    };
    
  } catch (error) {
    console.error('Error parsing Texas ZIP:', error);
    return {
      success: false,
      permits: [],
      stats: { total: 0, withGps: 0, withoutGps: 0, files: [] },
      error: error instanceof Error ? error.message : 'Failed to parse ZIP file'
    };
  }
}
