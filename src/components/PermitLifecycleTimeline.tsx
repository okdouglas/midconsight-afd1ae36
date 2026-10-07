/**
 * Permit-to-production timeline for the company view.
 *
 * Plots the measured curves (share of permits that have spud, completed and
 * produced, by days since approval) and puts this operator's open permits on
 * them by age. The bar above sums each permit's expected position.
 *
 * It shows where permits should be, not where they are. We hold no per-well
 * spud, completion or production dates.
 */
import { useMemo } from 'react';
import type { Permit } from '@/lib/schema-mapping';
import { permitDate, ageInDays, isNewDrill } from '@/lib/scoring';
import {
  MILESTONES,
  drillGroup,
  shareAt,
  stageSplit,
  useLifecycleBenchmarks,
  type DrillGroup,
  type Milestone,
} from '@/lib/lifecycle';

const MAX_AGE = 730;
const W = 640;
const H = 230;
const M = { l: 50, r: 14, t: 12, b: 64 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;
const X_TICKS = [0, 90, 180, 365, 540, 730];
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

const GROUP_LABEL: Record<DrillGroup, string> = {
  HH: 'horizontal wells',
  SH: 'vertical and directional wells',
  ALL: 'all new wells',
};

const CURVE_STYLE: Record<Milestone, { cls: string; dash?: string }> = {
  spud: { cls: 'stroke-muted-foreground', dash: '2 4' },
  completion: { cls: 'stroke-info', dash: '6 3' },
  first_production: { cls: 'stroke-primary' },
};

const x = (age: number) => M.l + (Math.min(age, MAX_AGE) / MAX_AGE) * PW;
const y = (share: number) => M.t + (1 - share) * PH;
const one = (n: number) => n.toFixed(1);

interface Props {
  permits: Permit[];
}

export function PermitLifecycleTimeline({ permits }: Props) {
  const bench = useLifecycleBenchmarks();

  const view = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let expired = 0;
    let older = 0;
    let amendments = 0;
    const open: { age: number; drillType?: string }[] = [];
    for (const p of permits) {
      const d = permitDate(p);
      if (!d) continue;
      // Amendments and recompletions re-approve a well that already has a permit.
      if (!isNewDrill(p)) {
        amendments += 1;
        continue;
      }
      if (p.expireDate && p.expireDate < today) {
        expired += 1;
        continue;
      }
      const age = ageInDays(d);
      if (!isFinite(age)) continue;
      if (age > MAX_AGE) {
        older += 1;
        continue;
      }
      open.push({ age, drillType: p.drillType });
    }
    const counts = { HH: 0, SH: 0, ALL: 0 } as Record<DrillGroup, number>;
    open.forEach((o) => (counts[drillGroup(o.drillType)] += 1));
    const group = (Object.keys(counts) as DrillGroup[]).sort((a, b) => counts[b] - counts[a])[0];
    return { open, expired, older, amendments, group };
  }, [permits]);

  if (!bench || view.open.length === 0) return null;

  const split = view.open.reduce(
    (acc, o) => {
      const s = stageSplit(bench, o.drillType, o.age);
      acc.waiting += s.waiting;
      acc.drilling += s.drilling;
      acc.completing += s.completing;
      acc.producing += s.producing;
      return acc;
    },
    { waiting: 0, drilling: 0, completing: 0, producing: 0 },
  );
  const n = view.open.length;

  const bar = [
    { key: 'waiting', label: 'Not spud yet', value: split.waiting, cls: 'bg-muted-foreground/30' },
    { key: 'drilling', label: 'Drilling', value: split.drilling, cls: 'bg-muted-foreground' },
    { key: 'completing', label: 'Completing', value: split.completing, cls: 'bg-info' },
    { key: 'producing', label: 'Producing', value: split.producing, cls: 'bg-primary' },
  ];

  // Stack dots that land close together so none hide another.
  const sorted = [...view.open].sort((a, b) => a.age - b.age);
  const lane: number[] = [];
  const dots = sorted.map((o) => {
    let row = 0;
    while (lane[row] !== undefined && x(o.age) - lane[row] < 8) row += 1;
    lane[row] = x(o.age);
    return { ...o, row };
  });

  const curves = MILESTONES.map((m) => {
    const pts = bench[view.group][m.key];
    const path = Array.from({ length: 74 }, (_, i) => i * 10)
      .map((age, i) => `${i === 0 ? 'M' : 'L'}${x(age).toFixed(1)},${y(shareAt(pts, age)).toFixed(1)}`)
      .join(' ');
    return { ...m, path };
  });

  const notes: string[] = [];
  if (view.expired) notes.push(`${view.expired} expired permit${view.expired === 1 ? '' : 's'} left out`);
  if (view.amendments) notes.push(`${view.amendments} amendment${view.amendments === 1 ? '' : 's'} and recompletion${view.amendments === 1 ? '' : 's'} left out`);
  if (view.older) notes.push(`${view.older} older than 24 months left out`);

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="text-sm text-muted-foreground">Permit to production timeline</div>
      <div className="text-sm mt-1">
        Expected position of {n} open permit{n === 1 ? '' : 's'} approved in the last 24 months: {one(split.waiting)} not
        spud yet, {one(split.drilling)} drilling, {one(split.completing)} completing, {one(split.producing)} producing.
      </div>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full mt-3 bg-muted"
        role="img"
        aria-label={bar.map((b) => `${b.label} ${one(b.value)}`).join(', ')}
      >
        {bar.map((b) => (
          <div key={b.key} className={b.cls} style={{ width: `${(b.value / n) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
        {bar.map((b) => (
          <span key={b.key} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${b.cls}`} />
            {b.label} {one(b.value)}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-4 text-foreground" role="img"
        aria-label={`Share of ${GROUP_LABEL[view.group]} reaching spud, completion and first production by days since approval, with this operator's permits marked by age`}>
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={M.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {X_TICKS.map((t) => (
          <text key={t} x={x(t)} y={M.t + PH + 14} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
            {t}
          </text>
        ))}
        <text x={M.l + PW / 2} y={M.t + PH + 28} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
          Days since approval
        </text>
        {curves.map((c) => (
          <path
            key={c.key}
            d={c.path}
            fill="none"
            strokeWidth={2}
            strokeDasharray={CURVE_STYLE[c.key].dash}
            className={CURVE_STYLE[c.key].cls}
          />
        ))}
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={x(d.age)}
            cy={M.t + PH + 40 + Math.min(d.row, 2) * 7}
            r={3}
            className="fill-primary"
            fillOpacity={0.55}
          >
            <title>{`${d.age} days since approval`}</title>
          </circle>
        ))}
        <text x={M.l - 6} y={M.t + PH + 43} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
          Permits
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
        {curves.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" x2="22" y1="3" y2="3" strokeWidth="2" strokeDasharray={CURVE_STYLE[c.key].dash} className={CURVE_STYLE[c.key].cls} />
            </svg>
            {c.label}
          </span>
        ))}
      </div>

      <div className="text-xs text-muted-foreground mt-3">
        Curves show the share of {GROUP_LABEL[view.group]} that reached each step, measured from OCC data on permits approved
        since 2019. This shows where permits should be, not where they are. {notes.length ? `${notes.join('. ')}.` : ''}
      </div>
    </div>
  );
}
