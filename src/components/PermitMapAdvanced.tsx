/**
 * Advanced Leaflet Map Component for Permit Visualization
 * Features: Enterprise-grade sidebar, layer switching, temporal controls, export
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, Layers, Filter, Download, MapPin, Calendar as CalendarIcon, Users, 
  ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Streetview',
    subdomains: 'abcd'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    name: 'Satellite',
    subdomains: ''
  },
  county: {
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    name: 'County Borders',
    subdomains: 'abcd'
  }
};

// PLSS Township-Range-Section survey grid — a transparent line overlay,
// not a standalone basemap. Must be layered on top of a real base layer
// (see TILE_LAYERS above), never used as the sole tile source, or it
// renders as an almost-blank map with no geographic context.
const TRS_OVERLAY = {
  url: 'https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/tile/{z}/{y}/{x}',
  attribution: 'BLM PLSS Cadastral Data',
  name: 'Township/Range/Section Grid',
};

// Note: well status filter options are computed live from the actual data
// (see statusOptions below), not hardcoded — Oklahoma's raw Well_Status /
// Permit_Status fields are agency codes, not predictable words, so a fixed
// guessed list silently matches nothing when the real codes differ.

// Well type colors
const WELL_TYPE_COLORS = {
  gas: '#3b82f6',      // Blue
  injection: '#f59e0b', // Orange/Amber
  disposal: '#ef4444',  // Red
  oil: '#22c55e',       // Green
  default: '#10b981'    // Teal/Green
};

// Custom marker icon based on well type
const getMarkerIcon = (wellType: string, isCentroidMapped: boolean = false): L.DivIcon => {
  const raw = (wellType || '').toLowerCase().trim();
  let color = WELL_TYPE_COLORS.default;

  if (/^(gw|gas)/.test(raw) || raw.includes('gas')) {
    color = WELL_TYPE_COLORS.gas;
  } else if (/^(inj|iw)/.test(raw) || raw.includes('injection')) {
    color = WELL_TYPE_COLORS.injection;
  } else if (/^(swd|sw|dw)/.test(raw) || raw.includes('disposal') || raw.includes('saltwater')) {
    color = WELL_TYPE_COLORS.disposal;
  } else if (/^ow$/.test(raw) || raw.includes('oil')) {
    color = WELL_TYPE_COLORS.oil;
  }

  // Location precision is a separate dimension from well type — shown as a
  // dashed border instead of a second color, so it never gets confused
  // with (or visually collides with) the well-type color coding above.
  const border = isCentroidMapped ? '2px dashed white' : '2px solid white';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 14px;
      height: 14px;
      background: ${color};
      border: ${border};
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

export function PermitMapAdvanced({ 
  permits, 
  onPermitClick, 
  showFilters = true,
  defaultFilter = 'all'
}: PermitMapAdvancedProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trsLayerRef = useRef<L.TileLayer | null>(null);

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_LAYERS>('streets');
  const [showTrsGrid, setShowTrsGrid] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(getDefaultStartDate());
  const [endDate, setEndDate] = useState<Date | undefined>(getDefaultEndDate());
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
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
  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    processedPermits.forEach((p) => {
      const status = (p.wellStatus || p.permitStatus || '').trim();
      if (!status) return;
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
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

    // Status filter — exact match against real observed values now
    // (selectedStatuses are populated from statusOptions, not guessed keywords)
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(p => {
        const status = (p.wellStatus || p.permitStatus || '').trim();
        return selectedStatuses.includes(status);
      });
    }

    return filtered;
  }, [processedPermits, startDate, endDate, searchQuery, selectedStatuses]);

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
  const wellTypeCounts = useMemo(() => {
    const counts = { gas: 0, injection: 0, disposal: 0, oil: 0, other: 0 };
    const otherSamples = new Set<string>();
    validPermits.forEach(p => {
      const raw = (p.wellType || '').toLowerCase().trim();
      if (/^(gw|gas)/.test(raw) || raw.includes('gas')) counts.gas++;
      else if (/^(inj|iw)/.test(raw) || raw.includes('injection')) counts.injection++;
      else if (/^(swd|sw|dw)/.test(raw) || raw.includes('disposal') || raw.includes('saltwater')) counts.disposal++;
      else if (/^ow$/.test(raw) || raw.includes('oil')) counts.oil++;
      else {
        counts.other++;
        if (raw && otherSamples.size < 6) otherSamples.add(p.wellType || raw);
      }
    });
    return { ...counts, otherSamples: Array.from(otherSamples) };
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

    const layer = TILE_LAYERS[activeLayer];
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      subdomains: layer.subdomains || undefined,
      maxZoom: 19,
    }).addTo(mapRef.current);

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
    
    const layer = TILE_LAYERS[activeLayer];
    
    // Remove old layer if it exists
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    
    // Create new layer with proper configuration
    const tileOptions: L.TileLayerOptions = {
      attribution: layer.attribution,
      maxZoom: 19,
    };
    
    // Only add subdomains if they exist
    if (layer.subdomains) {
      tileOptions.subdomains = layer.subdomains;
    }
    
    tileLayerRef.current = L.tileLayer(layer.url, tileOptions).addTo(mapRef.current);
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
        icon: getMarkerIcon(permit.wellType || '', permit.isCentroidMapped),
      });

      const sourceLabel = permit.isCentroidMapped 
        ? 'Source: County Estimate' 
        : 'Source: State GPS';
      
      const sourceColor = permit.isCentroidMapped ? '#f97316' : '#16a34a';

      const popupContent = `
        <div style="font-family: system-ui; font-size: 12px; min-width: 220px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: ${sourceColor};">
            ${permit.wellName || 'Unknown Well'}
          </div>
          <div style="display: grid; gap: 4px;">
            <div><strong>Operator:</strong> ${permit.operator || 'N/A'}</div>
            <div><strong>API:</strong> ${permit.api || 'N/A'}</div>
            <div><strong>County:</strong> ${permit.county || 'N/A'}</div>
            <div><strong>State:</strong> ${permit.state || 'N/A'}</div>
            <div><strong>Formation:</strong> ${permit.formationName || 'N/A'}</div>
            <div><strong>Well Type:</strong> ${permit.wellType || 'N/A'}</div>
            <div><strong>Status:</strong> ${permit.wellStatus || permit.permitStatus || 'N/A'}</div>
            <div><strong>Approval Date:</strong> ${permit.approvalDate || 'N/A'}</div>
          </div>
          <div style="background: ${permit.isCentroidMapped ? '#fef3c7' : '#dcfce7'}; color: ${permit.isCentroidMapped ? '#92400e' : '#166534'}; padding: 4px 8px; border-radius: 4px; margin-top: 8px; font-size: 11px;">
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
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `permits_export_${dateStamp}.csv`;
    link.click();
  };

  // Toggle status filter
  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
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

        <ScrollArea className="flex-1">
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
                      <span className="truncate flex-1">{idx + 1}. {op.name}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">{op.count}</Badge>
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
                <span className="text-xs text-muted-foreground">Well Status</span>
                {statusOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No status data in current permits</p>
                ) : (
                  <div className="space-y-1.5">
                    {statusOptions.map(status => (
                      <div key={status.value} className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Checkbox
                            id={status.value}
                            checked={selectedStatuses.includes(status.value)}
                            onCheckedChange={() => toggleStatus(status.value)}
                          />
                          <label htmlFor={status.value} className="text-xs cursor-pointer truncate">
                            {status.value}
                          </label>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{status.count}</Badge>
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
        </ScrollArea>

        {/* E. Coordinate Readout */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Lat/Lon:</span>
            {cursorPosition ? (
              <span className="font-mono">
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
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-4 border border-border text-xs z-[1000] shadow-lg">
          <div className="font-semibold mb-3">Well Types</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: WELL_TYPE_COLORS.gas }} />
                <span>Gas</span>
              </div>
              <Badge variant="secondary" className="text-xs">{wellTypeCounts.gas}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: WELL_TYPE_COLORS.injection }} />
                <span>Injection</span>
              </div>
              <Badge variant="secondary" className="text-xs">{wellTypeCounts.injection}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: WELL_TYPE_COLORS.disposal }} />
                <span>Disposal</span>
              </div>
              <Badge variant="secondary" className="text-xs">{wellTypeCounts.disposal}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: WELL_TYPE_COLORS.oil }} />
                <span>Oil</span>
              </div>
              <Badge variant="secondary" className="text-xs">{wellTypeCounts.oil}</Badge>
            </div>
            {wellTypeCounts.other > 0 && (
              <div className="flex items-center justify-between gap-4" title={wellTypeCounts.otherSamples.join(', ')}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: WELL_TYPE_COLORS.default }} />
                  <span>Other/Unclassified</span>
                </div>
                <Badge variant="secondary" className="text-xs">{wellTypeCounts.other}</Badge>
              </div>
            )}
            {wellTypeCounts.other > 0 && wellTypeCounts.otherSamples.length > 0 && (
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Unrecognized values: {wellTypeCounts.otherSamples.join(', ')}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-border flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full border border-dashed border-muted-foreground" />
              Dashed border = approximate location (county centroid)
            </p>
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="absolute top-28 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000] shadow-lg">
          <div className="font-semibold">{validPermits.length} Permits Mapped</div>
          <div className="text-muted-foreground">of {permits.length} total</div>
          {(selectedStatuses.length > 0 || searchQuery) && (
            <div className="text-primary mt-1 text-xs">Filters active</div>
          )}
        </div>
      </div>
    </div>
  );
}
