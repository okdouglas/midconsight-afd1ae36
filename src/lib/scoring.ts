/**
 * Live lead scoring (rule v4.1: measured permit-to-production curve, new drills only).
 *
 * v4 replaces the 60-day half-life guess with the curve measured from OCC data
 * (6,590 new-drill oil and gas permits approved 2019 or later, joined to the
 * completions file; log-logistic mixture cure model, see the Scoring Analysis
 * tab of the MidconSight v2.0 doc).
 *
 *   A permit is worth the expected chance its well is still on the way:
 *
 *       w(t) = (1 - c) / (1 + (t / a)^b)       t = days since approval
 *
 *   c  share of permits that never become producing wells
 *   a  days until half of the wells that will produce have produced
 *   b  steepness
 *
 *   Horizontal wells:           c 0.168, a 181.9, b 2.43
 *   Vertical and directional:   c 0.426, a 132.7, b 2.14
 *   Unknown type (all wells):   c 0.248, a 179.3, b 2.31
 *
 *   Only new-drill permits count. Amendments, recompletions, re-entries and
 *   deepenings (ITD codes AM, RC, RE, DP) re-approve a well that already has a
 *   permit, and the curve was measured on new drills only.
 *   A permit past its expiry date is worth nothing.
 *   An operator's pipeline is the sum of its permits' weights, in expected wells.
 *   Activity is the number of permits approved in the last 30 days.
 *
 *   Hot    pipeline of 1.6 or more AND a permit in the last 30 days
 *   Warm   pipeline of 0.75 or more
 *   Cold   everything else
 *
 * Hot means "actively permitting with real volume on the way". Warm means "wells
 * still in the pipeline". Cold means "the lead has mostly played out".
 *
 * The lookback setting at the top of the page caps how far back permits count.
 * It starts at 12 months. A permit's date is its approval date, or the date it
 * was imported if that is missing.
 */
import type { Permit } from '@/lib/schema-mapping';

/**
 * 'pending' is for operators whose permits are all in states we do not score yet
 * (everything except Oklahoma, for now). They show on the map and in lists but get no
 * heat. The rule was measured on Oklahoma data only.
 */
export type LeadScore = 'hot' | 'warm' | 'cold' | 'pending';

/** States whose permits are scored. Everything else is pending. */
export const SCORED_STATES = ['OK'] as const;

export function isScoredState(p: Pick<Permit, 'permitState'>): boolean {
  return (SCORED_STATES as readonly string[]).includes((p.permitState || 'OK').toUpperCase());
}

export const RULE_VERSION = 'v4.1';
export const HOT_MIN = 1.6;
export const WARM_MIN = 0.75;
export const ACTIVE_DAYS = 30;

export interface WeightCurve {
  /** Share of permits that never produce. */
  c: number;
  /** Days to the midpoint of the wells that do produce. */
  a: number;
  /** Steepness. */
  b: number;
}

export const CURVES: Record<'HH' | 'SH' | 'ALL', WeightCurve> = {
  HH: { c: 0.168, a: 181.9, b: 2.431 },
  SH: { c: 0.426, a: 132.7, b: 2.141 },
  ALL: { c: 0.248, a: 179.3, b: 2.307 },
};

/** ITD drill codes: HH and multi-unit are horizontal; SH and DH are vertical or directional. */
export function curveFor(drillType?: string | null): WeightCurve {
  const t = (drillType || '').trim().toUpperCase();
  if (t === 'HH' || t.startsWith('MU')) return CURVES.HH;
  if (t === 'SH' || t === 'DH') return CURVES.SH;
  return CURVES.ALL;
}

/** Weight of one permit t days after approval. */
export function weightAt(ageDays: number, curve: WeightCurve): number {
  return (1 - curve.c) / (1 + Math.pow(Math.max(0, ageDays) / curve.a, curve.b));
}

/** ITD application types that are not new drills. Anything else, including blank, counts. */
export const NON_NEW_DRILL_TYPES = ['AM', 'RC', 'RE', 'DP'];

export function isNewDrill(p: Pick<Permit, 'applicationType'>): boolean {
  const t = (p.applicationType || '').trim().toUpperCase();
  return !NON_NEW_DRILL_TYPES.includes(t);
}

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

export function scoreForHeat(heat: number, recentPermits = 0): LeadScore {
  if (heat >= HOT_MIN && recentPermits > 0) return 'hot';
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

function isExpired(p: Pick<Permit, 'expireDate'>, now: Date): boolean {
  return !!p.expireDate && p.expireDate < now.toISOString().split('T')[0];
}

/** What one permit adds to its operator's heat. */
export function permitHeat(p: Permit, windowDays: number, now: Date = new Date()): number {
  const d = permitDate(p);
  if (!d) return 0;
  if (!isScoredState(p)) return 0;
  if (!isNewDrill(p)) return 0;
  if (isExpired(p, now)) return 0;
  const age = ageInDays(d, now);
  if (age > windowDays) return 0;
  return weightAt(age, curveFor(p.drillType));
}

export interface OperatorStats {
  operator: string;
  permits: Permit[];
  /** All permits tracked for this operator. */
  total: number;
  /** Permits inside the lookback. */
  inWindow: number;
  /** Permits approved in the last 30 days (inside the lookback). */
  recent: number;
  heat: number;
  lastPermitDate: string;
  score: LeadScore;
}

export function computeOperatorStats(permits: Permit[], windowDays: number): Map<string, OperatorStats> {
  const now = new Date();
  const start = windowStart(windowDays, now);
  const recentStart = windowStart(ACTIVE_DAYS, now);
  const out = new Map<string, OperatorStats>();
  for (const p of permits) {
    if (!p.operator) continue;
    let s = out.get(p.operator);
    if (!s) {
      s = { operator: p.operator, permits: [], total: 0, inWindow: 0, recent: 0, heat: 0, lastPermitDate: '', score: 'cold' };
      out.set(p.operator, s);
    }
    s.permits.push(p);
    s.total += 1;
    const d = permitDate(p);
    const counts = isNewDrill(p) && isScoredState(p);
    if (d && d >= start && counts) s.inWindow += 1;
    if (d && d >= recentStart && d >= start && counts && !isExpired(p, now)) s.recent += 1;
    if (d && d > s.lastPermitDate) s.lastPermitDate = d;
    s.heat += permitHeat(p, windowDays, now);
  }
  out.forEach((s) => {
    s.score = s.permits.every((p) => !isScoredState(p)) ? 'pending' : scoreForHeat(s.heat, s.recent);
  });
  return out;
}

/** Heat and tier for one operator's permits. Used where only a permit list is at hand. */
export function scoreOperator(permits: Permit[], windowDays: number): { heat: number; score: LeadScore } {
  const now = new Date();
  const start = windowStart(windowDays, now);
  const recentStart = windowStart(ACTIVE_DAYS, now);
  const heat = permits.reduce((sum, p) => sum + permitHeat(p, windowDays, now), 0);
  const recent = permits.filter((p) => {
    const d = permitDate(p);
    return d && d >= recentStart && d >= start && isNewDrill(p) && isScoredState(p) && !isExpired(p, now);
  }).length;
  if (permits.length > 0 && permits.every((p) => !isScoredState(p))) return { heat: 0, score: 'pending' };
  return { heat, score: scoreForHeat(heat, recent) };
}

export function windowLabel(days: number): string {
  return SCORE_WINDOWS.find((w) => w.days === days)?.label ?? `${days} days`;
}

/** One plain line that says why an operator ranks where it does. */
export function whyLine(heat: number, newPermits: number, recentPermits: number): string {
  if (newPermits === 0) return 'No new drilling permits in the window.';
  const wells = heat >= 0.05 ? `About ${heat.toFixed(1)} wells still coming` : 'Almost nothing still coming';
  const recent = recentPermits > 0 ? `, ${recentPermits} filed in the last ${ACTIVE_DAYS} days` : '';
  return `${wells} from ${newPermits} new permit${newPermits === 1 ? '' : 's'}${recent}.`;
}

export function formatHeat(heat: number): string {
  return heat.toFixed(1);
}

/** The permits that add the most heat, biggest first. */
export function topContributingPermits(permits: Permit[], windowDays: number, n = 3): { permit: Permit; heat: number }[] {
  const now = new Date();
  return permits
    .map((permit) => ({ permit, heat: permitHeat(permit, windowDays, now) }))
    .filter((x) => x.heat > 0)
    .sort((a, b) => b.heat - a.heat)
    .slice(0, n);
}
