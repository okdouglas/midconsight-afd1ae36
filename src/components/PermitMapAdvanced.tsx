/**
 * Advanced Leaflet Map Component for Permit Visualization
 * Features: Enterprise-grade sidebar, layer switching, temporal controls, export
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format, parse, isValid } from 'date-fns';
import type { Permit } from '@/lib/schema-mapping';
import { getTexasCountyCoordinates } from '@/lib/texas-counties';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
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

// Tile layer configurations with proper sources
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

// Well status options
const WELL_STATUS_OPTIONS = [
  { value: 'permitted', label: 'Permitted' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' }
];

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
  let color = WELL_TYPE_COLORS.default;
  
  if (isCentroidMapped) {
    color = '#f97316'; // Orange for centroid-mapped
  } else if (wellType?.toLowerCase().includes('gas')) {
    color = WELL_TYPE_COLORS.gas;
  } else if (wellType?.toLowerCase().includes('injection')) {
    color = WELL_TYPE_COLORS.injection;
  } else if (wellType?.toLowerCase().includes('disposal')) {
    color = WELL_TYPE_COLORS.disposal;
  } else if (wellType?.toLowerCase().includes('oil')) {
    color = WELL_TYPE_COLORS.oil;
  }

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 14px;
      height: 14px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

// Date range bounds
const MIN_YEAR = 2015;
const MAX_YEAR = 2025;

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

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_LAYERS>('streets');
  const [dateRange, setDateRange] = useState<[number, number]>([2020, 2025]);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(2020, 0, 1));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date(2025, 11, 31));
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [viewportOperators, setViewportOperators] = useState<{ name: string; count: number }[]>([]);

  // Sync date inputs with slider
  const handleSliderChange = (values: [number, number]) => {
    setDateRange(values);
    setStartDate(new Date(values[0], 0, 1));
    setEndDate(new Date(values[1], 11, 31));
  };

  // Handle start date input change
  const handleStartDateChange = (date: Date | undefined) => {
    if (date && isValid(date)) {
      setStartDate(date);
      const year = date.getFullYear();
      if (year >= MIN_YEAR && year <= MAX_YEAR) {
        setDateRange([year, dateRange[1]]);
      }
    }
  };

  // Handle end date input change
  const handleEndDateChange = (date: Date | undefined) => {
    if (date && isValid(date)) {
      setEndDate(date);
      const year = date.getFullYear();
      if (year >= MIN_YEAR && year <= MAX_YEAR) {
        setDateRange([dateRange[0], year]);
      }
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

  // Compute filtered permits
  const filteredPermits = useMemo(() => {
    let filtered = processedPermits;

    // Date range filter (based on approval date year)
    filtered = filtered.filter(p => {
      if (!p.approvalDate) return true;
      const year = new Date(p.approvalDate).getFullYear();
      return year >= dateRange[0] && year <= dateRange[1];
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

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(p => {
        const status = (p.wellStatus || p.permitStatus || '').toLowerCase();
        return selectedStatuses.some(s => status.includes(s));
      });
    }

    return filtered;
  }, [processedPermits, dateRange, searchQuery, selectedStatuses]);

  // Valid permits (with coordinates)
  const validPermits = useMemo(() => 
    filteredPermits.filter(p => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon)),
    [filteredPermits]
  );

  // Well type counts
  const wellTypeCounts = useMemo(() => {
    const counts = { gas: 0, injection: 0, disposal: 0, oil: 0, other: 0 };
    validPermits.forEach(p => {
      const type = (p.wellType || '').toLowerCase();
      if (type.includes('gas')) counts.gas++;
      else if (type.includes('injection')) counts.injection++;
      else if (type.includes('disposal')) counts.disposal++;
      else if (type.includes('oil')) counts.oil++;
      else counts.other++;
    });
    return counts;
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

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `permits_export_${new Date().toISOString().split('T')[0]}.csv`;
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
    <div className="w-full min-h-[750px] bg-slate-100/50 dark:bg-slate-900/30 py-4">
      <div className="flex max-w-[1400px] w-[70%] mx-auto h-[calc(100vh-140px)] min-h-[700px]">
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

              {/* Slider */}
              <div className="px-2 pt-2">
                <Slider
                  value={dateRange}
                  onValueChange={(v) => handleSliderChange(v as [number, number])}
                  min={MIN_YEAR}
                  max={MAX_YEAR}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{dateRange[0]}</span>
                  <span>{dateRange[1]}</span>
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
                <div className="grid grid-cols-2 gap-2">
                  {WELL_STATUS_OPTIONS.map(status => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={status.value}
                        checked={selectedStatuses.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                      />
                      <label htmlFor={status.value} className="text-xs cursor-pointer">
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
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
        <div className="absolute top-4 right-4 z-[1000]">
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
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="absolute top-16 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000] shadow-lg">
          <div className="font-semibold">{validPermits.length} Permits Mapped</div>
          <div className="text-muted-foreground">of {permits.length} total</div>
          {(selectedStatuses.length > 0 || searchQuery) && (
            <div className="text-primary mt-1 text-xs">Filters active</div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
