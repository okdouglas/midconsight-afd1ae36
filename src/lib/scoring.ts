/**
 * Live lead scoring (rule v3: heat that fades).
 *
 * Wells take a long time to go from a permit to an active well, and an
 * operator with a permit is still a lead for months. So a permit does not drop
 * out after 30 days. It fades.
 *
 *   Each permit is worth 1 point on the day it is approved.
 *   It loses half its weight every 60 days.
 *   A permit past its expiry date is worth nothing.
 *   An operator's heat is the sum of its permits.
 *
 *   Hot    heat of 2.5 or more   (3 permits this week, or 5 this month)
 *   Warm   heat of 0.75 to 2.5   (3 permits 3 months ago, or 1 permit this month)
 *   Cold   under 0.75            (1 permit 6 months ago)
 *
 * The lookback setting at the top of the page caps how far back permits count.
 * It starts at 12 months. A permit's date is its approval date, or the date it
 * was imported if that is missing.
 */
import type { Permit } from '@/lib/schema-mapping';

export type LeadScore = 'hot' | 'warm' | 'cold';

export const HALF_LIFE_DAYS = 60;
export const HOT_MIN = 2.5;
export const WARM_MIN = 0.75;

export const SCORE_WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 365, label: '12 months' },
] as const;

export const DEFAULT_WINDOW_DAYS = 365;

const DAY_MS = 86_400_000;

export function permitDate(p: Pick<Permit, 'approvalDate' | 'dateImported'>): string {
  return p.approvalDate || p.dateImported || '';
}

export function scoreForHeat(heat: number): LeadScore {
  if (heat >= HOT_MIN) return 'hot';
  if (heat >= WARM_MIN) return 'warm';
  return 'cold';
}

export function windowStart(windowDays: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - windowDays);
  return d.toISOString().split('T')[0];
}

/** Age in whole days of a YYYY-MM-DD date. Never negative. */
export function ageInDays(date: string, now: Date = new Date()): number {
  const t = new Date(`${date}T00:00:00Z`).getTime();
  if (isNaN(t)) return Infinity;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - t) / DAY_MS));
}

/** What one permit adds to its operator's heat. */
export function permitHeat(p: Permit, windowDays: number, now: Date = new Date()): number {
  const d = permitDate(p);
  if (!d) return 0;
  if (p.expireDate && p.expireDate < now.toISOString().split('T')[0]) return 0;
  const age = ageInDays(d, now);
  if (age > windowDays) return 0;
  return Math.pow(0.5, age / HALF_LIFE_DAYS);
}

export interface OperatorStats {
  operator: string;
  permits: Permit[];
  /** All permits tracked for this operator. */
  total: number;
  /** Permits inside the lookback. */
  inWindow: number;
  heat: number;
  lastPermitDate: string;
  score: LeadScore;
}

export function computeOperatorStats(permits: Permit[], windowDays: number): Map<string, OperatorStats> {
  const now = new Date();
  const start = windowStart(windowDays, now);
  const out = new Map<string, OperatorStats>();
  for (const p of permits) {
    if (!p.operator) continue;
    let s = out.get(p.operator);
    if (!s) {
      s = { operator: p.operator, permits: [], total: 0, inWindow: 0, heat: 0, lastPermitDate: '', score: 'cold' };
      out.set(p.operator, s);
    }
    s.permits.push(p);
    s.total += 1;
    const d = permitDate(p);
    if (d && d >= start) s.inWindow += 1;
    if (d && d > s.lastPermitDate) s.lastPermitDate = d;
    s.heat += permitHeat(p, windowDays, now);
  }
  out.forEach((s) => {
    s.score = scoreForHeat(s.heat);
  });
  return out;
}

/** Heat and tier for one operator's permits. Used where only a permit list is at hand. */
export function scoreOperator(permits: Permit[], windowDays: number): { heat: number; score: LeadScore } {
  const now = new Date();
  const heat = permits.reduce((sum, p) => sum + permitHeat(p, windowDays, now), 0);
  return { heat, score: scoreForHeat(heat) };
}

export function windowLabel(days: number): string {
  return SCORE_WINDOWS.find((w) => w.days === days)?.label ?? `${days} days`;
}

export function formatHeat(heat: number): string {
  return heat.toFixed(1);
}
