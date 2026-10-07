/**
 * Live lead scoring (rule v2).
 *
 * The score is computed in the browser from the permits you can see, for a
 * time window you choose. Nothing is frozen. Move the window and every score
 * on every screen moves with it.
 *
 *   Hot    3 or more permits in the window. Actively permitting.
 *   Warm   1 or 2 permits in the window.
 *   Cold   No permits in the window. The activity is old.
 *
 * A permit's date is its approval date. If that is missing, the date it was
 * imported.
 */
import type { Permit } from '@/lib/schema-mapping';

export type LeadScore = 'hot' | 'warm' | 'cold';

export const HOT_MIN = 3;
export const WARM_MIN = 1;

export const SCORE_WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 365, label: '12 months' },
] as const;

export const DEFAULT_WINDOW_DAYS = 30;

export function permitDate(p: Pick<Permit, 'approvalDate' | 'dateImported'>): string {
  return p.approvalDate || p.dateImported || '';
}

export function scoreForCount(inWindow: number): LeadScore {
  if (inWindow >= HOT_MIN) return 'hot';
  if (inWindow >= WARM_MIN) return 'warm';
  return 'cold';
}

export function windowStart(windowDays: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - windowDays);
  return d.toISOString().split('T')[0];
}

export interface OperatorStats {
  operator: string;
  permits: Permit[];
  total: number;
  inWindow: number;
  lastPermitDate: string;
  score: LeadScore;
}

export function computeOperatorStats(permits: Permit[], windowDays: number): Map<string, OperatorStats> {
  const start = windowStart(windowDays);
  const out = new Map<string, OperatorStats>();
  for (const p of permits) {
    if (!p.operator) continue;
    let s = out.get(p.operator);
    if (!s) {
      s = { operator: p.operator, permits: [], total: 0, inWindow: 0, lastPermitDate: '', score: 'cold' };
      out.set(p.operator, s);
    }
    s.permits.push(p);
    s.total += 1;
    const d = permitDate(p);
    if (d && d >= start) s.inWindow += 1;
    if (d && d > s.lastPermitDate) s.lastPermitDate = d;
  }
  out.forEach((s) => {
    s.score = scoreForCount(s.inWindow);
  });
  return out;
}

export function windowLabel(days: number): string {
  return SCORE_WINDOWS.find((w) => w.days === days)?.label ?? `${days} days`;
}
