import L from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';

// Self-hosted basemap. A single Protomaps PMTiles file lives in Cloudflare R2
// and the browser reads it with HTTP range requests. No third-party tile
// service, no API key. Set VITE_BASEMAP_PMTILES_URL to the public file URL.
// See docs/BASEMAP.md for how the file is built and uploaded.
const PMTILES_URL = import.meta.env.VITE_BASEMAP_PMTILES_URL as string | undefined;

// Highest zoom stored in the PMTiles file. Zooms above this are stretched
// from the last stored level. Keep in sync with --maxzoom in docs/BASEMAP.md.
const MAX_DATA_ZOOM = 13;

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://protomaps.com">Protomaps</a>';

export type BasemapStyle = 'streets' | 'county';

export function createBasemapLayer(style: BasemapStyle): L.Layer {
  if (!PMTILES_URL) {
    // Stopgap until the R2 file is live: plain OpenStreetMap raster tiles.
    // Fine for light traffic, not for production scale.
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });
  }

  return leafletLayer({
    url: PMTILES_URL,
    flavor: 'light',
    lang: 'en',
    attribution: ATTRIBUTION,
    maxDataZoom: MAX_DATA_ZOOM,
    maxZoom: 19,
    // County view: same base, no place or road labels.
    ...(style === 'county' ? { labelRules: [] } : {}),
  }) as unknown as L.Layer;
}
