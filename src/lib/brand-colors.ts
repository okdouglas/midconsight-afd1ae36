/**
 * Brand colors for places Tailwind classes cannot reach (Leaflet marker HTML,
 * popups, chart series). Keep in sync with src/index.css and tailwind.config.ts.
 * Rule: signal red means heat. It is never used for well types.
 */
export const BRAND = {
  blue: '#005A9C',      // Dodger blue, primary
  blue700: '#00467A',
  blue500: '#1F6DB0',
  blue300: '#6FA3D3',
  blue200: '#A9C8E8',
  blue100: '#D3E4F4',
  navy: '#0B2545',
  slate: '#2B3F5C',
  muted: '#5B6F8A',
  line: '#D5DFEA',
  mist: '#EEF4FA',
  red: '#C4262A',       // signal red: hot only
  amber: '#C98A2E',     // warm, injection, unresolved
  amberTint: '#F6E3BF',
  amberText: '#7A4B00',
} as const;

/** Well-type dots on the dashboard map, the legend and the new-permits list. */
export const WELL_TYPE_COLORS = {
  oil: BRAND.blue,
  gas: BRAND.blue300,
  injection: BRAND.amber,
  disposal: BRAND.muted,
  other: '#9DB4CE',
} as const;

export type WellTypeKey = keyof typeof WELL_TYPE_COLORS;

export function wellTypeKey(wellType?: string): WellTypeKey {
  const t = (wellType || '').toLowerCase();
  if (t.includes('oil')) return 'oil';
  if (t.includes('gas')) return 'gas';
  if (t.includes('inj')) return 'injection';
  if (t.includes('disp')) return 'disposal';
  return 'other';
}
