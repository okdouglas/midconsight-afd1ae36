import { useMemo, useState } from 'react';
import { Calendar, MapPin, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Permit } from '@/lib/schema-mapping';

// Dot colors match the Well Types legend on the dashboard map.
function wellTypeDot(wellType?: string): { color: string; label: string } {
  const t = (wellType || '').toLowerCase();
  if (t.includes('gas')) return { color: 'bg-blue-500', label: 'Gas' };
  if (t.includes('inj')) return { color: 'bg-amber-500', label: 'Injection' };
  if (t.includes('disp')) return { color: 'bg-red-500', label: 'Disposal' };
  if (t.includes('oil')) return { color: 'bg-green-500', label: 'Oil' };
  return { color: 'bg-muted-foreground', label: wellType || 'Other' };
}

function formatDate(d?: string): string {
  if (!d) return 'No date';
  const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PAGE = 12;

export function NewPermitsList({ permits }: { permits: Permit[] }) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () =>
      [...permits].sort((a, b) => (b.approvalDate || '').localeCompare(a.approvalDate || '')),
    [permits]
  );
  const visible = showAll ? sorted : sorted.slice(0, PAGE);

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
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
                  <div className="font-medium text-sm truncate">{p.operator || 'Unknown operator'}</div>
                  <div className="text-xs text-muted-foreground truncate">{well}</div>
                </div>
                <span className="flex items-center gap-1.5 text-xs shrink-0">
                  <span className={`h-2 w-2 rounded-full ${dot.color}`} aria-hidden="true" />
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
