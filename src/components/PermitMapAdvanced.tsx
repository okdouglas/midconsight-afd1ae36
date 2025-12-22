/**
 * Advanced Leaflet Map Component for Permit Visualization
 * Features: CartoDB/StreetView layers, filtering, search, light mode default
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Permit } from '@/lib/schema-mapping';
import { getTexasCountyCoordinates } from '@/lib/texas-counties';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Layers, Filter } from 'lucide-react';

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
  cartodb_light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'CartoDB Light'
  },
  cartodb_dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'CartoDB Dark'
  },
  osm_street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    name: 'Street View'
  }
};

// Custom marker icon based on well type and centroid status
const getMarkerIcon = (wellType: string, isCentroidMapped: boolean = false): L.DivIcon => {
  let color = '#10b981'; // Default green
  
  // Orange for centroid-mapped pins
  if (isCentroidMapped) {
    color = '#f97316'; // Orange
  } else if (wellType?.toLowerCase().includes('oil')) {
    color = '#22c55e';
  } else if (wellType?.toLowerCase().includes('gas')) {
    color = '#3b82f6';
  } else if (wellType?.toLowerCase().includes('injection')) {
    color = '#f59e0b';
  } else if (wellType?.toLowerCase().includes('disposal')) {
    color = '#ef4444';
  }

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

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

  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_LAYERS>('cartodb_light');
  const [timeFilter, setTimeFilter] = useState<'all' | 'new_this_week'>(defaultFilter);

  // Compute filtered permits
  const filteredPermits = useMemo(() => {
    let filtered = permits;

    // Time filter
    if (timeFilter === 'new_this_week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      filtered = filtered.filter(p => p.dateImported >= sevenDaysAgoStr);
    }

    // Search filter (by operator)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.operator?.toLowerCase().includes(query) ||
        p.wellName?.toLowerCase().includes(query) ||
        p.api?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [permits, timeFilter, searchQuery]);

  // Get unique operators for search suggestions
  const operators = useMemo(() => {
    const opSet = new Set(permits.map(p => p.operator).filter(Boolean));
    return Array.from(opSet).sort();
  }, [permits]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = L.map(mapContainer.current, {
      center: [35.5, -98.5],
      zoom: 6,
      scrollWheelZoom: true,
    });

    const layer = TILE_LAYERS[activeLayer];
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(mapRef.current);

    markersRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update tile layer when changed
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    const layer = TILE_LAYERS[activeLayer];
    tileLayerRef.current.setUrl(layer.url);
  }, [activeLayer]);

  // Update markers when filtered permits change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    // Process permits - use isCentroidMapped flag if present, or apply centroid mapping for those without coordinates
    const processedPermits = filteredPermits.map(permit => {
      let lat = permit.lat;
      let lon = permit.lon;
      // Use the flag from permit data if available
      let isCentroidMapped = permit.isCentroidMapped || false;

      // Fallback: If no valid coordinates but has county, try Texas county centroid
      if ((!lat || !lon || lat === 0 || lon === 0) && permit.county && permit.state?.toUpperCase() === 'TX') {
        const centroidCoords = getTexasCountyCoordinates(permit.county, true);
        if (centroidCoords) {
          [lat, lon] = centroidCoords;
          isCentroidMapped = true;
        }
      }

      return { ...permit, lat, lon, isCentroidMapped };
    });

    const validPermits = processedPermits.filter(
      p => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon)
    );

    if (validPermits.length === 0) return;

    validPermits.forEach(permit => {
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
            <div><strong>Imported:</strong> ${permit.dateImported || 'N/A'}</div>
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

    // Fit bounds if we have permits
    if (validPermits.length > 0) {
      const bounds = L.latLngBounds(
        validPermits.map(p => [p.lat!, p.lon!] as [number, number])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [filteredPermits, onPermitClick]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-border">
      {/* Filter Controls */}
      {showFilters && (
        <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by operator, well name, or API..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card/95 backdrop-blur-sm"
              list="operators"
            />
            <datalist id="operators">
              {operators.slice(0, 10).map(op => (
                <option key={op} value={op} />
              ))}
            </datalist>
          </div>

          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
            <SelectTrigger className="w-[160px] bg-card/95 backdrop-blur-sm">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Permits</SelectItem>
              <SelectItem value="new_this_week">New This Week</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeLayer} onValueChange={(v) => setActiveLayer(v as any)}>
            <SelectTrigger className="w-[140px] bg-card/95 backdrop-blur-sm">
              <Layers className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cartodb_light">Light Map</SelectItem>
              <SelectItem value="cartodb_dark">Dark Map</SelectItem>
              <SelectItem value="osm_street">Street View</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000]">
        <div className="font-semibold mb-2">Location Source</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
            <span>State GPS (Precise)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 border border-white" />
            <span>County Estimate (TX)</span>
          </div>
        </div>
        <div className="font-semibold mt-3 mb-2">Well Types</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
            <span>Gas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 border border-white" />
            <span>Injection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
            <span>Disposal</span>
          </div>
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000]" style={{ marginTop: showFilters ? '52px' : '0' }}>
        <div className="font-semibold">{filteredPermits.filter(p => p.lat && p.lon).length} Permits Mapped</div>
        <div className="text-muted-foreground">of {permits.length} total</div>
        {timeFilter === 'new_this_week' && (
          <div className="text-primary mt-1">Showing new this week</div>
        )}
      </div>
    </div>
  );
}
