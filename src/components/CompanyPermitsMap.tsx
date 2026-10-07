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
import { permitDate, windowStart, windowLabel, ageInDays, permitHeat } from '@/lib/scoring';
import { classifyLifecycleStage, STAGE_LABELS } from '@/components/PermitMapAdvanced';
import type { Permit } from '@/lib/schema-mapping';
import { useProfile } from '@/hooks/useProfile';
import { promptUpgrade } from '@/lib/supabase-data';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

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
  const { isPaid, loading: planLoading } = useProfile();
  const locked = !isPaid && !planLoading;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const located = permits.filter((p) => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon));
  const start = windowStart(windowDays);
  const recentCount = located.filter((p) => permitDate(p) >= start).length;
  const stageCounts = located.reduce<Record<string, number>>((acc, p) => {
    const label = STAGE_LABELS[classifyLifecycleStage(p)];
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const stageLine = Object.entries(stageCounts).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ');

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
      // Free users see where the permits are, but not the detail.
      if (!locked) {
        marker.bindPopup(
          `<div style="font-size:12px;min-width:180px">
            <div style="font-weight:600;color:${BRAND.navy};margin-bottom:4px">${esc(p.wellName || 'Unnamed well')}${p.wellNumber ? ' ' + esc(p.wellNumber) : ''}</div>
            <div>API ${esc(p.api)}</div>
            <div>${esc(p.county)} County</div>
            <div>${esc(p.drillType || p.wellType || '')}</div>
            <div>Permit date ${esc(permitDate(p) || 'n/a')}${permitDate(p) ? ' (' + ageInDays(permitDate(p)) + ' days ago)' : ''}</div>
            <div>OCC status: ${esc(STAGE_LABELS[classifyLifecycleStage(p)])}</div>
            <div>Heat now: ${permitHeat(p, windowDays).toFixed(2)}</div>
          </div>`,
        );
      }
      layer.addLayer(marker);
      points.push([p.lat, p.lon]);
    });
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 11 });
  }, [located, start, windowDays, locked]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="text-sm font-medium">Permit map</div>
          <div className="text-xs text-muted-foreground">
            {located.length} tracked permit{located.length === 1 ? '' : 's'} · {recentCount} in last {windowLabel(windowDays)}
          </div>
          {stageLine && <div className="text-xs text-muted-foreground">OCC status: {stageLine}</div>}
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
      <div className="relative" style={{ height: 288 }}>
        <div
          ref={el}
          style={{ height: 288, width: '100%' }}
          className={locked ? 'pointer-events-none [&_.leaflet-tile-pane]:blur-[3px] [&_.leaflet-tile-pane]:grayscale [&_.leaflet-control-container]:hidden' : ''}
          role="img"
          aria-label="Map of this company's tracked permits"
        />
        {located.length === 0 && !locked && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-card/80 text-sm text-muted-foreground">
            No mapped permits tracked for this company yet.
          </div>
        )}
        {locked && (
          <div className="absolute inset-x-0 bottom-0 z-[500] flex items-center justify-center gap-3 bg-card/90 px-4 py-3 text-center">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="text-sm font-medium">Permit details and the street map are on the paid plans</div>
            <Button size="sm" onClick={() => promptUpgrade('company_map')}>Upgrade</Button>
          </div>
        )}
      </div>
    </div>
  );
}
