/**
 * Leaflet Map Component for Permit Visualization
 * Displays permit locations with clustering and popup details
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Permit } from '@/lib/schema-mapping';

// Fix default marker icons for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PermitMapProps {
  permits: Permit[];
  onPermitClick?: (permit: Permit) => void;
}

// Custom marker icon based on well type
const getMarkerIcon = (wellType: string): L.DivIcon => {
  let color = '#10b981'; // Default green
  if (wellType?.toLowerCase().includes('oil')) color = '#22c55e';
  if (wellType?.toLowerCase().includes('gas')) color = '#3b82f6';
  if (wellType?.toLowerCase().includes('injection')) color = '#f59e0b';
  if (wellType?.toLowerCase().includes('disposal')) color = '#ef4444';

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

export function PermitMap({ permits, onPermitClick }: PermitMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Create map centered on Oklahoma/Texas Midcontinent region
    mapRef.current = L.map(mapContainer.current, {
      center: [35.5, -98.5],
      zoom: 6,
      scrollWheelZoom: true,
    });

    // Add tile layer (dark theme to match app)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Create markers layer group
    markersRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when permits change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Filter permits with valid coordinates
    const validPermits = permits.filter(
      p => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon)
    );

    if (validPermits.length === 0) return;

    // Add markers for each permit
    validPermits.forEach(permit => {
      const marker = L.marker([permit.lat!, permit.lon!], {
        icon: getMarkerIcon(permit.wellType),
      });

      // Create popup content
      const popupContent = `
        <div style="font-family: system-ui; font-size: 12px; min-width: 200px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #16a34a;">
            ${permit.wellName || 'Unknown Well'}
          </div>
          <div style="display: grid; gap: 4px;">
            <div><strong>Operator:</strong> ${permit.operator || 'N/A'}</div>
            <div><strong>API:</strong> ${permit.api || 'N/A'}</div>
            <div><strong>County:</strong> ${permit.county || 'N/A'}</div>
            <div><strong>Formation:</strong> ${permit.formationName || 'N/A'}</div>
            <div><strong>Well Type:</strong> ${permit.wellType || 'N/A'}</div>
            <div><strong>Approval Date:</strong> ${permit.approvalDate || 'N/A'}</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'permit-popup',
      });

      marker.on('click', () => {
        if (onPermitClick) onPermitClick(permit);
      });

      markersRef.current?.addLayer(marker);
    });

    // Fit bounds to show all markers
    if (validPermits.length > 0) {
      const bounds = L.latLngBounds(
        validPermits.map(p => [p.lat!, p.lon!] as [number, number])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [permits, onPermitClick]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000]">
        <div className="font-semibold mb-2">Well Types</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
            <span>Oil</span>
          </div>
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
      <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border text-xs z-[1000]">
        <div className="font-semibold">{permits.filter(p => p.lat && p.lon).length} Permits Mapped</div>
        <div className="text-muted-foreground">of {permits.length} total</div>
      </div>
    </div>
  );
}
