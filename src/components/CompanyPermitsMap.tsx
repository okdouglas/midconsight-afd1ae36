/**
 * Map card for the company view. Plots every permit we track for one operator.
 * Permits inside the score window are solid blue. Older ones are pale, so the
 * map shows at a glance whether the activity is current.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createBasemapLayer } from '@/lib/basemap';
import { BRAND } from '@/lib/brand-colors';
import { permitDate, windowStart, windowLabel } from '@/lib/scoring';
import type { Permit } from '@/lib/schema-mapping';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function dot(color: string, border: string, size: number) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid ${border};border-radius:50%;box-shadow:0 1px 3px rgba(11,37,69,.35)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Props {
  permits: Permit[];
  windowDays: number;
}

export function CompanyPermitsMap({ permits, windowDays }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const located = permits.filter((p) => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon));
  const start = windowStart(windowDays);
  const recentCount = located.filter((p) => permitDate(p) >= start).length;

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { center: [35.5, -98.5], zoom: 6, scrollWheelZoom: false });
    createBasemapLayer('streets').addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The dialog animates open, so the container size is wrong at first.
    const t = window.setTimeout(() => map.invalidateSize(), 250);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (located.length === 0) return;

    const points: L.LatLngTuple[] = [];
    located.forEach((p) => {
      const recent = permitDate(p) >= start;
      const marker = L.marker([p.lat, p.lon], {
        icon: recent ? dot(BRAND.blue, '#fff', 14) : dot(BRAND.blue200, BRAND.blue500, 11),
        zIndexOffset: recent ? 500 : 0,
      });
      marker.bindPopup(
        `<div style="font-size:12px;min-width:180px">
          <div style="font-weight:600;color:${BRAND.navy};margin-bottom:4px">${esc(p.wellName || 'Unnamed well')}${p.wellNumber ? ' ' + esc(p.wellNumber) : ''}</div>
          <div>API ${esc(p.api)}</div>
          <div>${esc(p.county)} County</div>
          <div>${esc(p.drillType || p.wellType || '')}</div>
          <div>Permit date ${esc(permitDate(p) || 'n/a')}</div>
        </div>`,
      );
      layer.addLayer(marker);
      points.push([p.lat, p.lon]);
    });
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 11 });
  }, [located, start]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="text-sm font-medium">Permit map</div>
          <div className="text-xs text-muted-foreground">
            {located.length} tracked permit{located.length === 1 ? '' : 's'} · {recentCount} in last {windowLabel(windowDays)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BRAND.blue }} /> In window
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: BRAND.blue200, borderColor: BRAND.blue500 }} /> Older
          </span>
        </div>
      </div>
      {located.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No mapped permits tracked for this company yet.
        </div>
      ) : (
        <div ref={el} className="h-64 w-full" role="img" aria-label="Map of this company's tracked permits" />
      )}
    </div>
  );
}
