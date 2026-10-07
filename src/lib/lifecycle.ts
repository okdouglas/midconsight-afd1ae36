/**
 * Permit-to-production timeline math.
 *
 * Reads the aggregate curves in the lifecycle_benchmarks table (measured from OCC
 * data, 81 rows, no per-well data). For a permit of a given age and drill type it
 * gives the share of comparable permits that had reached each step by then.
 * This is where a permit should be, not where it is: we do not hold per-well
 * spud, completion or production dates.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { curveFor, CURVES } from '@/lib/scoring';

export type Milestone = 'spud' | 'completion' | 'first_production';
export type DrillGroup = 'ALL' | 'HH' | 'SH';

export const MILESTONES: { key: Milestone; label: string }[] = [
  { key: 'spud', label: 'Spud' },
  { key: 'completion', label: 'Completion' },
  { key: 'first_production', label: 'First production' },
];

/** points[group][milestone] = sorted [horizonDays, shareReached] pairs, starting at [0, 0]. */
export type Benchmarks = Record<DrillGroup, Record<Milestone, [number, number][]>>;

export function drillGroup(drillType?: string | null): DrillGroup {
  const c = curveFor(drillType);
  if (c === CURVES.HH) return 'HH';
  if (c === CURVES.SH) return 'SH';
  return 'ALL';
}

/** Share of permits that reached the step by this many days after approval. */
export function shareAt(points: [number, number][], ageDays: number): number {
  if (!points.length) return 0;
  const age = Math.max(0, ageDays);
  const last = points[points.length - 1];
  if (age >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (age <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (age - x0)) / (x1 - x0 || 1);
    }
  }
  return last[1];
}

export interface StageSplit {
  /** Approved, no spud yet. */
  waiting: number;
  /** Spud, not yet completed. */
  drilling: number;
  /** Completed, not yet producing. */
  completing: number;
  /** Producing. */
  producing: number;
}

/** Expected split of one permit across the steps. The four parts add up to 1. */
export function stageSplit(bench: Benchmarks, drillType: string | null | undefined, ageDays: number): StageSplit {
  const g = bench[drillGroup(drillType)];
  const spud = shareAt(g.spud, ageDays);
  const comp = Math.min(spud, shareAt(g.completion, ageDays));
  const prod = Math.min(comp, shareAt(g.first_production, ageDays));
  return { waiting: 1 - spud, drilling: spud - comp, completing: comp - prod, producing: prod };
}

interface Row {
  drill_group: DrillGroup;
  milestone: Milestone;
  horizon_days: number;
  share_reached: number | string;
}

function build(rows: Row[]): Benchmarks | null {
  const out = {} as Benchmarks;
  for (const g of ['ALL', 'HH', 'SH'] as DrillGroup[]) {
    out[g] = { spud: [[0, 0]], completion: [[0, 0]], first_production: [[0, 0]] };
  }
  for (const r of rows) {
    out[r.drill_group]?.[r.milestone]?.push([r.horizon_days, Number(r.share_reached)]);
  }
  for (const g of ['ALL', 'HH', 'SH'] as DrillGroup[]) {
    for (const m of MILESTONES) {
      out[g][m.key].sort((a, b) => a[0] - b[0]);
      if (out[g][m.key].length < 3) return null;
    }
  }
  return out;
}

let cached: Promise<Benchmarks | null> | null = null;

function load(): Promise<Benchmarks | null> {
  if (!cached) {
    cached = (async () => {
      try {
        const { data, error } = await supabase
          .from('lifecycle_benchmarks' as never)
          .select('drill_group, milestone, horizon_days, share_reached');
        if (error || !data) return null;
        return build(data as unknown as Row[]);
      } catch {
        return null;
      }
    })();
    // Do not keep a failed load for the rest of the session.
    cached.then((b) => {
      if (!b) cached = null;
    });
  }
  return cached;
}

/** Benchmarks, or null while loading or if the table cannot be read. */
export function useLifecycleBenchmarks(): Benchmarks | null {
  const [bench, setBench] = useState<Benchmarks | null>(null);
  useEffect(() => {
    let live = true;
    load().then((b) => {
      if (live) setBench(b);
    });
    return () => {
      live = false;
    };
  }, []);
  return bench;
}
