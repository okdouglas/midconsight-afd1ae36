/**
 * Advanced Leaflet Map Component for Permit Visualization
 * Features: Enterprise-grade sidebar, layer switching, temporal controls, export
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { createBasemapLayer } from '@/lib/basemap';
import 'leaflet/dist/leaflet.css';
import { format, parse, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Permit } from '@/lib/schema-mapping';
import { getTexasCountyCoordinates } from '@/lib/texas-counties';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, Layers, Filter, Download, MapPin, Calendar as CalendarIcon, Users, 
  ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand-colors';

// Fix default marker icons for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PermitMapAdvancedProps {
  permits: Permit[];
  onPermitClick?: (permit: Permit) => void;
  showFilters?: boolean;
  defaultFilter?: 'all' | 'new_this_week';
}

// Base map layers (mutually exclusive)
const TILE_LAYERS = {
  streets: {
    url: '',
    attribution: '',
    name: 'Streetview',
    subdomains: ''
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    name: 'Satellite',
    subdomains: ''
  },
  county: {
    url: '',
    attribution: '',
    name: 'County Borders',
    subdomains: ''
  }
};

// Streets and County come from the self-hosted basemap; Satellite stays Esri.
function buildBaseLayer(key: keyof typeof TILE_LAYERS): L.Layer {
  if (key === 'satellite') {
    const sat = TILE_LAYERS.satellite;
    return L.tileLayer(sat.url, { attribution: sat.attribution, maxZoom: 19 });
  }
  return createBasemapLayer(key);
}

// PLSS Township-Range-Section survey grid — a transparent line overlay,
// not a standalone basemap. Must be layered on top of a real base layer
// (see TILE_LAYERS above), never used as the sole tile source, or it
// renders as an almost-blank map with no geographic context.
const TRS_OVERLAY = {
  url: 'https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/tile/{z}/{y}/{x}',
  attribution: 'BLM PLSS Cadastral Data',
  name: 'Township/Range/Section Grid',
};

// Note: filter options (stage, product type) are computed live from the
// actual data (see stageFilterOptions/productTypeFilterOptions below),
// not hardcoded — Oklahoma's raw status fields are agency codes, not
// predictable words, so a fixed guessed list silently matches nothing
// when the real codes differ.

// Well type colors
// Map v2.0 — lifecycle stage, not raw well type (see docs/map-v2-ui-design.md).
// RBDMS's real wellstatus values split into two questions: what stage of
// life is this well in, and what does it produce if active. This function
// answers only the first — the primary, always-visible signal.
export type LifecycleStage =
  | 'permitted' | 'active' | 'injection' | 'dry'
  | 'temp_abandoned' | 'plugged' | 'orphan' | 'other';

const STAGE_COLORS: Record<LifecycleStage, string> = {
  permitted: BRAND.blue300,   // light blue: filed, not yet resolved
  active: BRAND.blue,         // Dodger blue: producing
  injection: BRAND.navy,      // navy: injection / water
  dry: '#8FA3BC',             // pale slate: non-productive
  temp_abandoned: BRAND.amber, // amber: warm, inactive and unresolved
  plugged: BRAND.muted,       // slate: end of life
  orphan: BRAND.red,          // signal red: the one heat signal, a regulatory / liability flag
  other: '#B4C3D4',           // light slate: unclassified
};

export const STAGE_LABELS: Record<LifecycleStage, string> = {
  permitted: 'Permitted',
  active: 'Active producer',
  injection: 'Injection / water',
  dry: 'Dry hole',
  temp_abandoned: 'Temporarily abandoned',
  plugged: 'Plugged / terminated',
  orphan: 'Orphan',
  other: 'Other/Unclassified',
};

/** Classifies a permit's real lifecycle stage from RBDMS wellstatus if
 *  enriched, otherwise from the raw ITD well type (which for pre-drill
 *  filings is almost always an undifferentiated "OG" — see the
 *  map-v2-data-sourcing.md finding). Unmatched RBDMS values fall into
 *  'other', visibly, rather than being silently dropped. */
export function classifyLifecycleStage(permit: {
  rbdmsWellStatus?: string;
  wellType?: string;
}): LifecycleStage {
  const status = (permit.rbdmsWellStatus || '').toUpperCase().trim();

  if (status) {
    if (['OIL', 'GAS', 'OIL/GAS', 'GAS_STORAGE'].includes(status)) return 'active';
    if (['WATER_INJECTION', 'UIC', 'WATER_SUPPLY'].includes(status)) return 'injection';
    if (status === 'DRY') return 'dry';
    if (status === 'TEMPORARILY_ABANDONED') return 'temp_abandoned';
    if (['PLUGGED', 'TERMINATED', 'STATE_FUNDS_PLUGGING'].includes(status)) return 'plugged';
    if (status === 'ORPHAN') return 'orphan';
    return 'other'; // enriched, but an RBDMS value not yet mapped — visible, not hidden
  }

  // Not enriched yet — still an ITD-only filing.
  return 'permitted';
}

// Custom marker icon: color = lifecycle stage, border style = location
// precision (existing), fill = whether this permit has been matched
// against RBDMS yet at all. Three independent channels, each answering a
// different question — deliberately not a fourth, to keep it scannable.
const getMarkerIcon = (
  permit: { rbdmsWellStatus?: string; wellType?: string; rbdmsEnrichedAt?: string },
  isCentroidMapped: boolean = false
): L.DivIcon => {
  const stage = classifyLifecycleStage(permit);
  const color = STAGE_COLORS[stage];
  const isEnriched = !!permit.rbdmsEnrichedAt;

  const border = isCentroidMapped ? '2px dashed white' : '2px solid white';
  const background = isEnriched ? color : 'white';
  const dotStyle = isEnriched
    ? `background: ${background}; border: ${border};`
    : `background: white; border: 2px solid ${color};`;

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 14px;
      height: 14px;
      ${dotStyle}
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

// Date range bounds
const getDefaultStartDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
};
const getDefaultEndDate = () => new Date();

const escHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function PermitMapAdvanced({ 
  permits, 
  onPermitClick, 
  showFilters = true,
  defaultFilter = 'all'
}: PermitMapAdvancedProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.Layer | null>(null);
  const trsLayerRef = useRef<L.TileLayer | null>(null);

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_LAYERS>('streets');
  const [showTrsGrid, setShowTrsGrid] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(getDefaultStartDate());
  const [endDate, setEndDate] = useState<Date | undefined>(getDefaultEndDate());
  const [selectedStages, setSelectedStages] = useState<LifecycleStage[]>([]);
  const [cursorPosition, setCursorPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [viewportOperators, setViewportOperators] = useState<{ name: string; count: number }[]>([]);

  // Handle start date input change
  const handleStartDateChange = (date: Date | undefined) => {
    if (date && isValid(date)) {
      setStartDate(date);
    }
  };

  // Handle end date input change
  const handleEndDateChange = (date: Date | undefined) => {
    if (date && isValid(date)) {
      setEndDate(date);
    }
  };

  // Handle text input for start date
  const handleStartDateText = (value: string) => {
    const parsed = parse(value, 'MM/dd/yyyy', new Date());
    if (isValid(parsed)) {
      handleStartDateChange(parsed);
    }
  };

  // Handle text input for end date
  const handleEndDateText = (value: string) => {
    const parsed = parse(value, 'MM/dd/yyyy', new Date());
    if (isValid(parsed)) {
      handleEndDateChange(parsed);
    }
  };

  // Process permits with coordinates
  const processedPermits = useMemo(() => {
    return permits.map(permit => {
      let lat = permit.lat;
      let lon = permit.lon;
      let isCentroidMapped = permit.isCentroidMapped || false;

      if ((!lat || !lon || lat === 0 || lon === 0) && permit.county && permit.state?.toUpperCase() === 'TX') {
        const centroidCoords = getTexasCountyCoordinates(permit.county, true);
        if (centroidCoords) {
          [lat, lon] = centroidCoords;
          isCentroidMapped = true;
        }
      }

      return { ...permit, lat, lon, isCentroidMapped };
    });
  }, [permits]);

  // Live status filter options — every distinct wellStatus/permitStatus
  // value actually present in the data, with counts, sorted by frequency.
  // Never a hardcoded guess, since Oklahoma's raw status fields are agency
  // codes that don't follow a predictable word list.
  // Map v2.0 — two filter facets, replacing the old single raw-code
  // "Well Status" filter. Computed from processedPermits (pre-filter) so
  // the checkbox list itself doesn't shrink as filters get applied —
  // same pattern the old statusOptions used.
  const stageFilterOptions = useMemo(() => {
    const counts = new Map<LifecycleStage, number>();
    processedPermits.forEach((p) => {
      const stage = classifyLifecycleStage(p);
      counts.set(stage, (counts.get(stage) || 0) + 1);
    });
    return (Object.keys(STAGE_LABELS) as LifecycleStage[])
      .map((stage) => ({ value: stage, label: STAGE_LABELS[stage], count: counts.get(stage) || 0 }))
      .filter((opt) => opt.count > 0);
  }, [processedPermits]);


  // Compute filtered permits
  const filteredPermits = useMemo(() => {
    let filtered = processedPermits;

    // Date range filter — based on approval date where present, falling
    // back to submit/import date. "Intent to Drill" filings are often
    // pre-approval, so approvalDate being empty is normal, not exceptional;
    // excluding those permits outright (as this used to) can silently hide
    // most or all of a fresh import.
    filtered = filtered.filter(p => {
      const effectiveDate = p.approvalDate || p.submitDate || p.dateImported;
      if (!effectiveDate) return true; // never hide a permit for lacking any date at all
      const dateObj = new Date(effectiveDate);
      const startOk = !startDate || dateObj >= startDate;
      const endOk = !endDate || dateObj <= endDate;
      return startOk && endOk;
    });

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.operator?.toLowerCase().includes(query) ||
        p.wellName?.toLowerCase().includes(query) ||
        p.api?.toLowerCase().includes(query)
      );
    }

    // Stage filter — the lifecycle-stage facet (permitted/active/dry/etc.)
    if (selectedStages.length > 0) {
      filtered = filtered.filter((p) => selectedStages.includes(classifyLifecycleStage(p)));
    }

    return filtered;
  }, [processedPermits, startDate, endDate, searchQuery, selectedStages]);

  // Valid permits (with coordinates)
  const validPermits = useMemo(() => 
    filteredPermits.filter(p => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon)),
    [filteredPermits]
  );

  // Well type counts. Oklahoma's raw Well_Type field is frequently a short
  // code (e.g. "OW", "GW", "SWD") rather than a full word, so this checks
  // both. Anything still unmatched goes into `other` — which is shown in
  // the legend rather than silently dropped, so a classification gap is
  // visible and debuggable instead of just looking like undercounting.
  // Map v2.0 lifecycle-stage counts, replacing the old ITD-only well-type
  // breakdown — see classifyLifecycleStage above and docs/map-v2-ui-design.md.
  const stageCounts = useMemo(() => {
    const counts: Record<LifecycleStage, number> = {
      permitted: 0, active: 0, injection: 0, dry: 0,
      temp_abandoned: 0, plugged: 0, orphan: 0, other: 0,
    };
    const otherSamples = new Set<string>();
    validPermits.forEach((p) => {
      const stage = classifyLifecycleStage(p);
      counts[stage]++;
      if (stage === 'other' && p.rbdmsWellStatus && otherSamples.size < 6) {
        otherSamples.add(p.rbdmsWellStatus);
      }
    });
    const enrichedCount = validPermits.filter((p) => !!p.rbdmsEnrichedAt).length;
    return { counts, otherSamples: Array.from(otherSamples), enrichedCount, total: validPermits.length };
  }, [validPermits]);

  // Initialize map - centered on Oklahoma
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Oklahoma-centered viewport
    mapRef.current = L.map(mapContainer.current, {
      center: [35.5, -97.5], // Oklahoma City area
      zoom: 7,
      scrollWheelZoom: true,
    });

    tileLayerRef.current = buildBaseLayer(activeLayer).addTo(mapRef.current);

    markersRef.current = L.layerGroup().addTo(mapRef.current);

    // Mouse move handler for coordinate display
    mapRef.current.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current.on('mouseout', () => {
      setCursorPosition(null);
    });

    // Update viewport operators on move
    mapRef.current.on('moveend', updateViewportOperators);

    // Fix viewport initialization - ensure map tiles render properly
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 100);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update tile layer when changed
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Remove old layer if it exists
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = buildBaseLayer(activeLayer).addTo(mapRef.current);
  }, [activeLayer]);

  // Toggle the TRS survey grid overlay independently of the base layer,
  // so it always renders on top of real map context instead of replacing it.
  useEffect(() => {
    if (!mapRef.current) return;

    if (showTrsGrid) {
      trsLayerRef.current = L.tileLayer(TRS_OVERLAY.url, {
        attribution: TRS_OVERLAY.attribution,
        maxZoom: 19,
        opacity: 0.65,
      }).addTo(mapRef.current);
    } else if (trsLayerRef.current) {
      mapRef.current.removeLayer(trsLayerRef.current);
      trsLayerRef.current = null;
    }

    return () => {
      if (trsLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(trsLayerRef.current);
      }
    };
  }, [showTrsGrid]);

  // Update viewport operators
  const updateViewportOperators = useCallback(() => {
    if (!mapRef.current) return;
    
    const bounds = mapRef.current.getBounds();
    const inViewport = validPermits.filter(p => 
      p.lat && p.lon && bounds.contains([p.lat, p.lon])
    );
    
    const operatorCounts: Record<string, number> = {};
    inViewport.forEach(p => {
      if (p.operator) {
        operatorCounts[p.operator] = (operatorCounts[p.operator] || 0) + 1;
      }
    });

    const sorted = Object.entries(operatorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setViewportOperators(sorted);
  }, [validPermits]);

  // Update markers when filtered permits change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    validPermits.forEach(permit => {
      const marker = L.marker([permit.lat!, permit.lon!], {
        icon: getMarkerIcon(permit, permit.isCentroidMapped),
      });

      const sourceLabel = permit.isCentroidMapped 
        ? 'Source: County Estimate' 
        : 'Source: State GPS';
      
      const sourceColor = BRAND.navy;

      const stage = classifyLifecycleStage(permit);
      const stageColor = STAGE_COLORS[stage];
      const isEnriched = !!permit.rbdmsEnrichedAt;

      const filedLine = permit.approvalDate
        ? `Filed ${permit.approvalDate} (ITD)`
        : permit.submitDate
          ? `Submitted ${permit.submitDate} (ITD)`
          : 'Filing date unknown';

      const statusLine = isEnriched
        ? `<div style="margin-top: 6px; padding: 6px 8px; background: ${stageColor}1a; border-left: 3px solid ${stageColor}; border-radius: 2px;">
             <div style="font-weight: 600; color: ${stageColor};">${STAGE_LABELS[stage]}</div>
             <div style="font-size: 10px; color: #5B6F8A;">RBDMS, checked ${permit.rbdmsEnrichedAt?.split('T')[0]}</div>
           </div>`
        : `<div style="margin-top: 6px; padding: 6px 8px; background: #EEF4FA; border-left: 3px solid #9DB4CE; border-radius: 2px; color: #5B6F8A;">
             Not yet matched to a well record
           </div>`;

      const legalLine = permit.rbdmsLegalDescription
        ? `<div><strong>Legal:</strong> ${permit.rbdmsLegalDescription}, ${permit.county || ''}</div>`
        : '';

      const wellFileLink = permit.rbdmsWellRecordsUrl
        ? `<div style="margin-top: 6px;"><a href="${permit.rbdmsWellRecordsUrl}" target="_blank" rel="noopener noreferrer" style="color: #005A9C;">View well file →</a></div>`
        : '';

      const popupContent = `
        <div style="font-family: system-ui; font-size: 12px; min-width: 240px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: ${sourceColor};">
            ${escHtml(permit.wellName || 'Unknown Well')}
          </div>
          <div style="font-size: 11px; color: #5B6F8A; margin-bottom: 8px;">${filedLine}</div>
          <div style="display: grid; gap: 4px;">
            <div><strong>Operator:</strong> ${escHtml(permit.operator || 'N/A')}</div>
            <div><strong>API:</strong> ${escHtml(permit.api || 'N/A')}</div>
            ${legalLine}
            <div><strong>County:</strong> ${escHtml(permit.county || 'N/A')}</div>
            <div><strong>Formation:</strong> ${escHtml(permit.formationName || 'N/A')}</div>
          </div>
          ${statusLine}
          ${wellFileLink}
          <div style="background: ${permit.isCentroidMapped ? BRAND.amberTint : BRAND.blue100}; color: ${permit.isCentroidMapped ? BRAND.amberText : BRAND.blue700}; padding: 4px 8px; border-radius: 4px; margin-top: 8px; font-size: 11px;">
            ${permit.isCentroidMapped ? '⚠️' : '📍'} ${sourceLabel}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { className: 'permit-popup' });
      marker.on('click', () => {
        if (onPermitClick) onPermitClick(permit);
      });

      markersRef.current?.addLayer(marker);
    });

    // Update viewport operators after markers update
    updateViewportOperators();
  }, [validPermits, onPermitClick, updateViewportOperators]);

  // Export current view
  const handleExport = (format: 'csv' | 'excel') => {
    const headers = ['API', 'Well Name', 'Operator', 'County', 'State', 'Well Type', 'Status', 'Approval Date', 'Lat', 'Lon'];
    const rows = validPermits.map(p => [
      p.api || '',
      p.wellName || '',
      p.operator || '',
      p.county || '',
      p.state || '',
      p.wellType || '',
      p.wellStatus || p.permitStatus || '',
      p.approvalDate || '',
      p.lat?.toString() || '',
      p.lon?.toString() || ''
    ]);

    const dateStamp = new Date().toISOString().split('T')[0];

    if (format === 'excel') {
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Permits');
      XLSX.writeFile(workbook, `permits_export_${dateStamp}.xlsx`);
      return;
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `permits_export_${dateStamp}.csv`;
    link.click();
  };

  // Toggle status filter
  const toggleStage = (stage: LifecycleStage) => {
    setSelectedStages(prev =>
      prev.includes(stage)
        ? prev.filter(s => s !== stage)
        : [...prev, stage]
    );
  };


  // Handle layer change
  const handleLayerChange = (value: string) => {
    setActiveLayer(value as keyof typeof TILE_LAYERS);
  };

  return (
    <div className="flex w-full h-[calc(100vh-120px)] min-h-[750px]">
      {/* Left Sidebar - Operation Dashboard with 16px right margin */}
      <div 
        className={cn(
          "bg-card border border-border rounded-l-xl transition-all duration-300 flex flex-col shrink-0",
          sidebarCollapsed ? 'w-0 overflow-hidden border-0' : 'w-80 mr-4'
        )}
      >
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Operation Dashboard
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="p-4 space-y-6">
            {/* A. Enhanced Temporal Control with Date Pickers */}
            <div className="space-y-3">
              <Label className="text-xs font-medium flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                Issue Date Range
              </Label>
              
              {/* Date Input Fields */}
              <div className="grid grid-cols-2 gap-2">
                {/* Start Date */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Start Date</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal h-8 text-xs",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1.5 h-3 w-3" />
                        {startDate ? format(startDate, "MM/dd/yyyy") : "Start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card z-[1100]" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={handleStartDateChange}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">End Date</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal h-8 text-xs",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1.5 h-3 w-3" />
                        {endDate ? format(endDate, "MM/dd/yyyy") : "End"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card z-[1100]" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={handleEndDateChange}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Date range summary */}
              <div className="px-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{startDate ? format(startDate, 'MMM d, yyyy') : 'Start'}</span>
                  <span>to</span>
                  <span>{endDate ? format(endDate, 'MMM d, yyyy') : 'End'}</span>
                </div>
              </div>
            </div>

            {/* B. Dynamic Leaderboard */}
            <div className="space-y-3">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Top Operators in View
              </Label>
              <div className="space-y-1.5">
                {viewportOperators.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Pan/zoom to see operators</p>
                ) : (
                  viewportOperators.map((op, idx) => (
                    <div 
                      key={op.name}
                      className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => setSearchQuery(op.name)}
                    >
                      <span className="truncate flex-1 min-w-0">{idx + 1}. {op.name}</span>
                      <Badge variant="secondary" className="ml-2 text-xs shrink-0">{op.count}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* C. Advanced Search & Filter */}
            <div className="space-y-3">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                Search & Filter
              </Label>
              <Input
                placeholder="API Number or Operator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-sm"
              />
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Lifecycle stage</span>
                {stageFilterOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No permits loaded yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {stageFilterOptions.map(opt => (
                      <div key={opt.value} className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Checkbox
                            id={`stage-${opt.value}`}
                            checked={selectedStages.includes(opt.value)}
                            onCheckedChange={() => toggleStage(opt.value)}
                          />
                          <label htmlFor={`stage-${opt.value}`} className="text-xs cursor-pointer truncate flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: STAGE_COLORS[opt.value] }} />
                            {opt.label}
                          </label>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{opt.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* D. Export Engine */}
            <div className="space-y-3">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Download className="h-3.5 w-3.5" />
                Export Current View
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleExport('csv')}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleExport('excel')}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                  Excel
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* E. Coordinate Readout */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Lat/Lon:</span>
            {cursorPosition ? (
              <span className="tabular-nums">
                {cursorPosition.lat.toFixed(5)}, {cursorPosition.lng.toFixed(5)}
              </span>
            ) : (
              <span className="text-muted-foreground">Hover over map</span>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="bg-card border-y border-r border-border p-1.5 hover:bg-muted transition-colors self-center shrink-0 rounded-r"
      >
        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {/* Map Container - Fluid width to fill remaining space */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-border ml-2">
        {/* Layer Switcher - Top Right */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
          <Select value={activeLayer} onValueChange={handleLayerChange}>
            <SelectTrigger className="w-[180px] bg-card/95 backdrop-blur-sm shadow-lg border-border">
              <Layers className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select layer" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-[1100]">
              <SelectItem value="streets">Streetview</SelectItem>
              <SelectItem value="satellite">Satellite</SelectItem>
              <SelectItem value="county">County Borders Only</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 bg-card/95 backdrop-blur-sm shadow-lg border border-border rounded-md px-3 py-2 text-xs cursor-pointer select-none">
            <Checkbox checked={showTrsGrid} onCheckedChange={(c) => setShowTrsGrid(c === true)} />
            Township/Range/Section grid
          </label>
        </div>

        {/* Map */}
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Dynamic Legend with Counts - Always Visible */}
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-4 border border-border text-xs z-[1000] shadow-lg max-w-[220px]">
          <div className="font-semibold mb-3">Lifecycle stage</div>
          <div className="space-y-2">
            {(Object.keys(STAGE_LABELS) as LifecycleStage[])
              .filter((stage) => stage !== 'other' || stageCounts.counts.other > 0)
              .map((stage) => (
                <div key={stage} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: STAGE_COLORS[stage] }} />
                    <span>{STAGE_LABELS[stage]}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stageCounts.counts[stage]}</Badge>
                </div>
              ))}
            {stageCounts.otherSamples.length > 0 && (
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Unrecognized RBDMS values: {stageCounts.otherSamples.join(', ')}
              </p>
            )}
            <div className="pt-2 mt-1 border-t border-border space-y-1.5">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-dashed border-muted-foreground" />
                Dashed border = approximate location
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-white border-2 border-muted-foreground" />
                Hollow fill = not yet matched to a real well ({stageCounts.total - stageCounts.enrichedCount} of {stageCounts.total})
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="absolute top-28 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000] shadow-lg">
          <div className="font-semibold">{validPermits.length} Permits Mapped</div>
          <div className="text-muted-foreground">of {permits.length} total</div>
          {(selectedStages.length > 0 || searchQuery) && (
            <div className="text-primary mt-1 text-xs">Filters active</div>
          )}
        </div>
      </div>
    </div>
  );
}
