import { useProfile } from '@/hooks/useProfile';
import { promptUpgrade } from '@/lib/supabase-data';

/** Shows free accounts how much of their small allowance is used. Paid accounts see nothing. */
export function FreeUsageBadge({ used, limit = 3, noun }: { used: number; limit?: number; noun: string }) {
  const { plan, loading } = useProfile();
  if (loading || plan !== 'free') return null;
  const full = used >= limit;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={full ? 'font-medium text-foreground' : ''}>
        {Math.min(used, limit)} of {limit} {noun} used
      </span>
      <button type="button" onClick={() => promptUpgrade(full ? 'free_limit' : 'usage_badge')} className="text-primary font-medium hover:underline">
        {full ? 'Upgrade for more' : 'Upgrade'}
      </button>
    </div>
  );
}
