import { useMemo, useState } from 'react';
import { Calendar, MapPin, Layers, Flame, Thermometer, Snowflake, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Permit } from '@/lib/schema-mapping';
import { WELL_TYPE_COLORS, wellTypeKey } from '@/lib/brand-colors';
import { computeOperatorStats, DEFAULT_WINDOW_DAYS, type LeadScore } from '@/lib/scoring';
import { Badge } from '@/components/ui/badge';

// Dot colors match the Well Types legend on the dashboard map.
const DOT_LABELS = { oil: 'Oil', gas: 'Gas', injection: 'Injection', disposal: 'Disposal' } as const;

function wellTypeDot(wellType?: string): { color: string; label: string } {
  const key = wellTypeKey(wellType);
  return {
    color: WELL_TYPE_COLORS[key],
    label: key === 'other' ? wellType || 'Other' : DOT_LABELS[key],
  };
}

function formatDate(d?: string): string {
  if (!d) return 'No date';
  const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PAGE = 12;

const HEAT: Record<LeadScore, { cls: string; label: string; Icon: typeof Flame }> = {
  hot: { cls: 'bg-score-hot/10 text-score-hot border-score-hot/30', label: 'Hot', Icon: Flame },
  warm: { cls: 'bg-score-warm text-score-warm-foreground border-score-warm-foreground/30', label: 'Warm', Icon: Thermometer },
  cold: { cls: 'bg-secondary text-primary-hover border-primary/20', label: 'Cold', Icon: Snowflake },
  pending: { cls: 'bg-muted text-muted-foreground border-border', label: 'Pending', Icon: Clock },
};

interface NewPermitsListProps {
  permits: Permit[];
  /** Every permit we can see, so the heat badge reflects the operator's whole pipeline. */
  allPermits?: Permit[];
  windowDays?: number;
}

export function NewPermitsList({ permits, allPermits, windowDays = DEFAULT_WINDOW_DAYS }: NewPermitsListProps) {
  const [showAll, setShowAll] = useState(false);
  const stats = useMemo(() => computeOperatorStats(allPermits ?? permits, windowDays), [allPermits, permits, windowDays]);

  const sorted = useMemo(
    () =>
      [...permits].sort((a, b) => (b.approvalDate || '').localeCompare(a.approvalDate || '')),
    [permits]
  );
  const visible = showAll ? sorted : sorted.slice(0, PAGE);

  if (sorted.length === 0) return null;

  return (
    <div id="new-permits-list" className="rounded-lg border border-border bg-card p-4 scroll-mt-20">
      <h3 className="font-semibold mb-3">
        New permits this week <span className="text-muted-foreground font-normal tabular-nums">({sorted.length})</span>
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((p) => {
          const dot = wellTypeDot(p.wellType);
          const well = [p.wellName, p.wellNumber].filter(Boolean).join(' ') || p.api;
          return (
            <li
              key={p.id}
              className="rounded-md border border-border bg-background p-3 flex flex-col gap-2 min-w-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {p.operator ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        className="font-medium text-sm truncate text-left hover:text-primary hover:underline"
                        title={`Open ${p.operator}`}
                        onClick={() =>
                          window.dispatchEvent(new CustomEvent('midconsight:open-company', { detail: { name: p.operator } }))
                        }
                      >
                        {p.operator}
                      </button>
                      {(() => {
                        const tier = stats.get(p.operator)?.score;
                        if (!tier) return null;
                        const h = HEAT[tier];
                        return (
                          <Badge className={`${h.cls} text-[10px] px-1.5 shrink-0`}>
                            <h.Icon className="h-3 w-3 mr-0.5" aria-hidden="true" />
                            {h.label}
                          </Badge>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="font-medium text-sm truncate">Unknown operator</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">{well}</div>
                </div>
                <span className="flex items-center gap-1.5 text-xs shrink-0">
                  <span className="h-2 w-2 rounded-full" style={{ background: dot.color }} aria-hidden="true" />
                  {dot.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {p.county ? `${p.county} Co.` : 'Unknown county'}
                </span>
                <span className="flex items-center gap-1 tabular-nums">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {formatDate(p.approvalDate)}
                </span>
                {(p.formationName || p.totalDepth) && (
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" aria-hidden="true" />
                    {[p.formationName, p.totalDepth ? `${p.totalDepth.toLocaleString()} ft` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {sorted.length > PAGE && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show Fewer' : `Show All ${sorted.length}`}
          </Button>
        </div>
      )}
    </div>
  );
}
