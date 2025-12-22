import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MFT_URL = "https://mft.rrc.texas.gov/link/0ad92a65-4212-49a1-98a7-d667a55fb497";

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

function parseAsciiFile(content: string): Map<string, Record<string, string>> {
  const lines = content.split('\n').filter(line => line.trim());
  const results = new Map<string, Record<string, string>>();
  
  // First line is usually the header
  if (lines.length < 2) return results;
  
  const headerLine = lines[0];
  
  // Detect delimiter (tab or fixed-width)
  const isTabDelimited = headerLine.includes('\t');
  
  if (isTabDelimited) {
    const headers = headerLine.split('\t').map(h => h.trim());
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const record: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index]?.trim() || '';
      });
      
      // Use UNIVERSAL_DOC_NO or first field as key
      const key = record['UNIVERSAL_DOC_NO'] || record[headers[0]] || String(i);
      results.set(key, record);
    }
  } else {
    // Try to parse as fixed-width based on common RRC format
    console.log('Parsing as fixed-width file, first 200 chars:', headerLine.substring(0, 200));
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 20) continue;
      
      const record: Record<string, string> = {
        raw: line
      };
      
      // Use line index as fallback key
      results.set(String(i), record);
    }
  }
  
  return results;
}

function parsePermitFile(content: string): Map<string, Record<string, string>> {
  const lines = content.split('\n').filter(line => line.trim());
  const results = new Map<string, Record<string, string>>();
  
  console.log(`Parsing permit file with ${lines.length} lines`);
  
  if (lines.length < 2) return results;
  
  // Detect format
  const firstDataLine = lines[1] || '';
  const isTabDelimited = firstDataLine.includes('\t');
  
  if (isTabDelimited) {
    const headers = lines[0].split('\t').map(h => h.trim().toUpperCase());
    console.log('Permit file headers:', headers.slice(0, 10));
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const record: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index]?.trim() || '';
      });
      
      const key = record['UNIVERSAL_DOC_NO'] || record['UNI_DOC_NO'] || String(i);
      if (key) {
        results.set(key, record);
      }
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
  
  const headers = lines[0].split('\t').map(h => h.trim().toUpperCase());
  console.log('LatLong file headers:', headers);
  
  const docNoIdx = headers.findIndex(h => h.includes('UNIVERSAL_DOC') || h.includes('UNI_DOC'));
  const latIdx = headers.findIndex(h => h.includes('LAT') || h === 'LATITUDE' || h === 'SURF_LAT');
  const lonIdx = headers.findIndex(h => h.includes('LONG') || h === 'LONGITUDE' || h === 'SURF_LONG');
  
  console.log(`Column indices - DocNo: ${docNoIdx}, Lat: ${latIdx}, Lon: ${lonIdx}`);
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    const docNo = values[docNoIdx]?.trim();
    const latStr = values[latIdx]?.trim();
    const lonStr = values[lonIdx]?.trim();
    
    if (docNo && latStr && lonStr) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        results.set(docNo, { lat, lon });
      }
    }
  }
  
  console.log(`Parsed ${results.size} lat/long records`);
  return results;
}

function joinPermitsWithCoords(
  permits: Map<string, Record<string, string>>,
  coords: Map<string, { lat: number; lon: number }>
): TexasPermit[] {
  const results: TexasPermit[] = [];
  
  permits.forEach((permit, docNo) => {
    const coord = coords.get(docNo);
    
    // Build API number from district and permit components
    const districtCode = permit['DISTRICT_CODE'] || permit['DIST_CODE'] || '';
    const leaseNo = permit['LEASE_NO'] || permit['LEASE_NUMBER'] || '';
    
    // Texas API format: 42-XXX-XXXXX (state-county-sequence)
    const countyCode = permit['COUNTY_CODE'] || permit['CNTY_CODE'] || '';
    const api = `42${countyCode.padStart(3, '0')}${leaseNo.padStart(5, '0')}`;
    
    const texasPermit: TexasPermit = {
      universalDocNo: docNo,
      api: api,
      operator: permit['OPERATOR_NAME'] || permit['OPER_NAME'] || permit['OPERATOR'] || '',
      operatorNumber: permit['OPERATOR_NO'] || permit['OPER_NO'] || '',
      county: permit['COUNTY_NAME'] || permit['COUNTY'] || '',
      wellName: permit['LEASE_NAME'] || permit['WELL_NAME'] || '',
      wellNumber: permit['WELL_NO'] || permit['WELL_NUMBER'] || '',
      totalDepth: parseInt(permit['TOTAL_DEPTH'] || permit['PROPOSED_DEPTH'] || '0') || 0,
      approvalDate: formatDate(permit['APPROVAL_DATE'] || permit['APPROVED_DATE'] || ''),
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

function formatDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Try different date formats
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        return `${match[3]}-${match[1]}-${match[2]}`;
      }
    }
  }
  
  return dateStr;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Texas RRC data sync...');
    console.log('Fetching from MFT URL:', MFT_URL);
    
    // Fetch the ZIP file from the MFT link
    const response = await fetch(MFT_URL, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MidconSight/1.0)',
      }
    });
    
    if (!response.ok) {
      console.error('MFT fetch failed:', response.status, response.statusText);
      
      // Check if it's an expired link or redirect issue
      if (response.status === 404 || response.status === 410) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'The Texas RRC data link appears to be expired. Please check for an updated link.',
            status: response.status
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    console.log('Response content-type:', contentType);
    
    // Get the response as array buffer
    const buffer = await response.arrayBuffer();
    console.log('Downloaded file size:', buffer.byteLength, 'bytes');
    
    // Check if it's a ZIP file (magic bytes: PK)
    const bytes = new Uint8Array(buffer);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;
    
    if (!isZip) {
      console.log('Response is not a ZIP file, first bytes:', bytes.slice(0, 20));
      
      // Try to read as text to see if it's an error page
      const text = new TextDecoder().decode(bytes.slice(0, 500));
      console.log('Response preview:', text);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'The MFT link did not return a ZIP file. The link may be expired or the service is temporarily unavailable.',
          preview: text.substring(0, 200)
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Valid ZIP file detected, extracting...');
    
    // Extract the ZIP file
    const zip = new JSZip();
    await zip.loadAsync(buffer);
    
    const fileNames = Object.keys(zip.files);
    console.log('ZIP contains files:', fileNames);
    
    // Find the permit and latlong files
    let permitFileName = fileNames.find(f => 
      f.toLowerCase().includes('drilling_permit_pending') && 
      !f.toLowerCase().includes('latlong') &&
      f.endsWith('.txt')
    );
    
    let latlongFileName = fileNames.find(f => 
      f.toLowerCase().includes('latlong') && 
      f.endsWith('.txt')
    );
    
    console.log('Permit file:', permitFileName);
    console.log('LatLong file:', latlongFileName);
    
    if (!permitFileName) {
      // Try alternative patterns
      permitFileName = fileNames.find(f => 
        f.endsWith('.txt') && !f.toLowerCase().includes('latlong')
      );
    }
    
    if (!permitFileName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not find permit data file in the ZIP archive.',
          files: fileNames
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Extract and parse the permit file
    const permitFile = zip.file(permitFileName);
    if (!permitFile) {
      throw new Error('Could not read permit file from ZIP');
    }
    const permitContent = await permitFile.async('string');
    console.log('Permit file size:', permitContent.length, 'chars');
    console.log('Permit file preview:', permitContent.substring(0, 500));
    
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
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        permits: texasPermits,
        stats: {
          total: texasPermits.length,
          withGps: withCoords,
          withoutGps: withoutCoords,
          files: fileNames
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in Texas RRC sync:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        hint: 'If this persists, try downloading the data manually from the RRC website.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
