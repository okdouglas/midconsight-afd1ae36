/**
 * Advanced Leaflet Map Component for Permit Visualization
 * Features: Satellite/Streets toggle, time slider, operator leaderboard
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Permit } from '@/lib/schema-mapping';
import { getTexasCountyCoordinates } from '@/lib/texas-counties';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Search, MapPin, Satellite, Map as MapIcon, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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

// Tile layer configurations
const TILE_LAYERS = {
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Streets'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    name: 'Satellite'
  }
};

// Custom marker icon based on well type
const getMarkerIcon = (wellType: string, isCentroidMapped: boolean = false): L.DivIcon => {
  let color = '#10b981'; // Default green
  
  // Determine color by well type
  const wellTypeLower = wellType?.toLowerCase() || '';
  if (wellTypeLower.includes('gas')) {
    color = '#3b82f6'; // Blue for gas
  } else if (wellTypeLower.includes('injection')) {
    color = '#f97316'; // Orange for injection
  } else if (wellTypeLower.includes('disposal')) {
    color = '#ef4444'; // Red for disposal
  } else if (wellTypeLower.includes('oil')) {
    color = '#22c55e'; // Green for oil
  }

  // Add border indicator for centroid-mapped
  const borderColor = isCentroidMapped ? '#f97316' : 'white';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border: 2px solid ${borderColor};
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

// Helper to parse date string to year
const getYearFromDate = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  const year = new Date(dateStr).getFullYear();
  return isNaN(year) ? null : year;
};

export function PermitMapAdvanced({ 
  permits, 
  onPermitClick, 
  showFilters = true,
}: PermitMapAdvancedProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const boundsInitialized = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSatellite, setIsSatellite] = useState(false);
  const [dateRange, setDateRange] = useState<[number, number]>([2020, 2025]);
  const [viewportBounds, setViewportBounds] = useState<L.LatLngBounds | null>(null);

  // Compute date range from permits
  const { minYear, maxYear } = useMemo(() => {
    let min = 2020;
    let max = new Date().getFullYear();
    
    permits.forEach(p => {
      const year = getYearFromDate(p.approvalDate);
      if (year) {
        if (year < min) min = year;
        if (year > max) max = year;
      }
    });
    
    return { minYear: min, maxYear: max };
  }, [permits]);

  // Initialize date range on permits change
  useEffect(() => {
    setDateRange([minYear, maxYear]);
  }, [minYear, maxYear]);

  // Filter permits by date range and search
  const filteredPermits = useMemo(() => {
    return permits.filter(p => {
      // Date filter
      const year = getYearFromDate(p.approvalDate);
      if (year && (year < dateRange[0] || year > dateRange[1])) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          p.operator?.toLowerCase().includes(query) ||
          p.wellName?.toLowerCase().includes(query) ||
          p.api?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [permits, dateRange, searchQuery]);

  // Process permits with coordinates
  const processedPermits = useMemo(() => {
    return filteredPermits.map(permit => {
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
    }).filter(p => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon));
  }, [filteredPermits]);

  // Calculate well type counts
  const wellTypeCounts = useMemo(() => {
    const counts = { gas: 0, injection: 0, disposal: 0, other: 0 };
    processedPermits.forEach(p => {
      const type = p.wellType?.toLowerCase() || '';
      if (type.includes('gas')) counts.gas++;
      else if (type.includes('injection')) counts.injection++;
      else if (type.includes('disposal')) counts.disposal++;
      else counts.other++;
    });
    return counts;
  }, [processedPermits]);

  // Calculate operator leaderboard based on viewport
  const operatorLeaderboard = useMemo(() => {
    const visiblePermits = viewportBounds
      ? processedPermits.filter(p => viewportBounds.contains([p.lat!, p.lon!]))
      : processedPermits;

    const operatorCounts: Record<string, number> = {};
    visiblePermits.forEach(p => {
      if (p.operator) {
        operatorCounts[p.operator] = (operatorCounts[p.operator] || 0) + 1;
      }
    });

    return Object.entries(operatorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([operator, count]) => ({ operator, count }));
  }, [processedPermits, viewportBounds]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = L.map(mapContainer.current, {
      center: [35.5, -98.5],
      zoom: 6,
      scrollWheelZoom: true,
    });

    const layerKey = isSatellite ? 'satellite' : 'streets';
    const layer = TILE_LAYERS[layerKey];
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      subdomains: layerKey === 'streets' ? 'abcd' : undefined,
      maxZoom: 19,
    }).addTo(mapRef.current);

    markersRef.current = L.layerGroup().addTo(mapRef.current);

    // Update viewport bounds on move
    mapRef.current.on('moveend', () => {
      if (mapRef.current) {
        setViewportBounds(mapRef.current.getBounds());
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update tile layer when toggled
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    const layerKey = isSatellite ? 'satellite' : 'streets';
    const layer = TILE_LAYERS[layerKey];
    
    tileLayerRef.current.remove();
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      subdomains: layerKey === 'streets' ? 'abcd' : undefined,
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, [isSatellite]);

  // Update markers when processed permits change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    if (processedPermits.length === 0) return;

    processedPermits.forEach(permit => {
      const marker = L.marker([permit.lat!, permit.lon!], {
        icon: getMarkerIcon(permit.wellType || '', permit.isCentroidMapped),
      });

      const sourceLabel = permit.isCentroidMapped 
        ? 'Source: County Estimate' 
        : 'Source: State GPS';
      
      const sourceColor = permit.isCentroidMapped ? '#f97316' : '#16a34a';

      const popupContent = `
        <div style="font-family: system-ui; font-size: 12px; min-width: 200px;">
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
            <div><strong>Drill Type:</strong> ${permit.drillType || 'N/A'}</div>
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

    // Fit bounds on initial load or when there are permits
    if (!boundsInitialized.current && processedPermits.length > 0) {
      const bounds = L.latLngBounds(
        processedPermits.map(p => [p.lat!, p.lon!] as [number, number])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      setViewportBounds(mapRef.current.getBounds());
      boundsInitialized.current = true;
    }
  }, [processedPermits, onPermitClick]);

  const handleDateRangeChange = useCallback((values: number[]) => {
    setDateRange([values[0], values[1]]);
  }, []);

  return (
    <div className="flex gap-4 w-full h-full">
      {/* Operator Leaderboard - Left Panel */}
      <Card className="w-64 shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Operators
          </CardTitle>
          <p className="text-xs text-muted-foreground">In current view</p>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {operatorLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {operatorLeaderboard.map((item, index) => (
                  <div
                    key={item.operator}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-xs font-bold text-muted-foreground w-5">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.operator}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No operators in view
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Map Container */}
      <div className="flex-1 flex flex-col relative rounded-xl overflow-hidden border border-border">
        {/* Top Filter Bar */}
        {showFilters && (
          <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by operator, well name, or API..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card/95 backdrop-blur-sm"
              />
            </div>

            {/* Satellite/Streets Toggle */}
            <div className="flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-md px-3 py-2 border">
              <MapIcon className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={isSatellite}
                onCheckedChange={setIsSatellite}
              />
              <Satellite className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Map */}
        <div ref={mapContainer} className="absolute inset-0" style={{ minHeight: '600px' }} />

        {/* Time Slider - Bottom */}
        <div className="absolute bottom-4 left-20 right-20 z-[1000]">
          <div className="bg-card/95 backdrop-blur-sm rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Approval Date Range</span>
              <span className="text-sm text-muted-foreground">
                {dateRange[0]} — {dateRange[1]}
              </span>
            </div>
            <Slider
              value={dateRange}
              onValueChange={handleDateRangeChange}
              min={minYear}
              max={maxYear}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">{minYear}</span>
              <span className="text-xs text-muted-foreground">{maxYear}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Legend with Counts - Bottom Left */}
        <div className="absolute bottom-24 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000]">
          <div className="font-semibold mb-2 flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            Well Types
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
                <span>Gas</span>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {wellTypeCounts.gas}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500 border border-white" />
                <span>Injection</span>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {wellTypeCounts.injection}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
                <span>Disposal</span>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {wellTypeCounts.disposal}
              </Badge>
            </div>
          </div>
          <div className="border-t border-border mt-2 pt-2">
            <div className="font-semibold mb-1">Location Source</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                <span>GPS Precise</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-orange-500" />
                <span>County Est.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats overlay - Top Right */}
        <div className="absolute top-16 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000]">
          <div className="font-semibold">{processedPermits.length} Permits Mapped</div>
          <div className="text-muted-foreground">of {permits.length} total</div>
        </div>
      </div>
    </div>
  );
}
