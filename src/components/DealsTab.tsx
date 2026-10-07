/**
 * Deals Tab Component
 * CRM for managing deal flow from companies
 */

import { toast } from 'sonner';
import { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Building2,
  Calendar,
  ChevronRight,
  Percent,
  TrendingUp,
  Trash2,
  ArrowUpDown,
  Search,
  Flag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { type Deal, type Company } from '@/hooks/useSupabaseData';
import { updateDeal, deleteDeal, getSellingOptions, type DbSellingOption } from '@/lib/supabase-data';
import {
  STAGES,
  STAGE_ORDER,
  stageUpdate,
  isClosedStage,
  parseLocalDate,
  formatLocalDate,
  isBeforeToday,
  type DealStage,
} from '@/lib/deal-stages';
import { DealDetailModal } from './DealDetailModal';
import { FreeUsageBadge } from './FreeUsageBadge';
import { ConfirmAction } from './ConfirmAction';

interface DealsTabProps {
  deals: Deal[];
  companies: Company[];
  onRefresh: () => void;
}

const STAGE_STYLE: Record<DealStage, { color: string; icon: React.ReactNode }> = {
  new_lead: { color: 'bg-secondary text-primary-hover border-primary/20', icon: <ArrowRight className="h-4 w-4" /> },
  contacted: { color: 'bg-foreground/10 text-foreground border-foreground/20', icon: <ArrowRight className="h-4 w-4" /> },
  qualified: { color: 'bg-score-warm text-score-warm-foreground border-score-warm-foreground/30', icon: <ArrowRight className="h-4 w-4" /> },
  proposal: { color: 'bg-primary/10 text-primary border-primary/30', icon: <ArrowRight className="h-4 w-4" /> },
  closed_won: { color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle2 className="h-4 w-4" /> },
  closed_lost: { color: 'bg-muted text-muted-foreground border-border', icon: <XCircle className="h-4 w-4" /> },
};

const PROBABILITY_COLORS: Record<number, string> = {
  0: 'text-muted-foreground',
  10: 'text-muted-foreground',
  30: 'text-score-warm-foreground',
  60: 'text-score-warm-foreground',
  90: 'text-success',
  100: 'text-success',
};

const STALE_DAYS = 14;

type PendingAction =
  | { kind: 'won'; deal: Deal }
  | { kind: 'lost'; deal: Deal }
  | { kind: 'delete'; deal: Deal };

export function DealsTab({ deals, companies, onRefresh }: DealsTabProps) {
  const { toast } = useToast();
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);
  const [filterText, setFilterText] = useState('');
  const [closeSortAsc, setCloseSortAsc] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    getSellingOptions().then(setSellingOptions).catch(() => {
      // Product names are a nice-to-have on the board. Stay quiet if they fail.
    });
  }, []);

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown Company';
  };

  const getCompany = (companyId: string) => {
    return companies.find(c => c.id === companyId) || null;
  };

  const getSellingOptionName = (sellingOptionId?: string) => {
    if (!sellingOptionId) return null;
    const opt = sellingOptions.find(o => o.id === sellingOptionId);
    return opt?.name || null;
  };

  const handleStageChange = async (deal: Deal, newStage: DealStage) => {
    try {
      await updateDeal(deal.id, stageUpdate(newStage));
      onRefresh();
    } catch (error) {
      console.error('Failed to move deal:', error);
      toast({ title: 'Could not move deal', description: 'Your change was not saved. Try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async (deal: Deal) => {
    try {
      await deleteDeal(deal.id);
      toast({ title: 'Deal deleted', description: deal.name });
      onRefresh();
    } catch (error) {
      console.error('Failed to delete deal:', error);
      toast({ title: 'Could not delete deal', description: 'Try again.', variant: 'destructive' });
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    const action = pending;
    setPending(null);
    if (action.kind === 'won') await handleStageChange(action.deal, 'closed_won');
    else if (action.kind === 'lost') await handleStageChange(action.deal, 'closed_lost');
    else await handleDelete(action.deal);
  };

  const pendingCopy = (() => {
    if (!pending) return { title: '', description: '', confirm: 'Confirm' };
    if (pending.kind === 'won') {
      return { title: 'Mark as Closed Won?', description: `"${pending.deal.name}" moves to Closed Won at 100%.`, confirm: 'Mark Closed Won' };
    }
    if (pending.kind === 'lost') {
      return { title: 'Mark as Closed Lost?', description: `"${pending.deal.name}" moves to Closed Lost at 0%.`, confirm: 'Mark Lost' };
    }
    return { title: 'Delete this deal?', description: `"${pending.deal.name}" will be removed. This cannot be undone.`, confirm: 'Delete deal' };
  })();

  const moveForward = (deal: Deal) => {
    const currentIndex = STAGE_ORDER.indexOf(deal.stage);
    if (currentIndex < 0 || currentIndex >= STAGE_ORDER.length - 2) return;
    const next = STAGE_ORDER[currentIndex + 1];
    if (next === 'closed_won') {
      setPending({ kind: 'won', deal });
      return;
    }
    handleStageChange(deal, next);
  };

  const openDeals = deals.filter(d => d.status === 'open');
  const closedDeals = deals.filter(d => d.status === 'closed');
  const totalPipeline = openDeals.reduce((sum, d) => sum + d.value, 0);
  const weightedPipeline = openDeals.reduce((sum, d) => sum + Math.round(d.value * (d.probability / 100)), 0);
  const wonDeals = deals.filter(d => d.stage === 'closed_won');
  const wonValue = wonDeals.reduce((sum, d) => sum + d.value, 0);

  // Closing this month: open deals whose expected close date falls in the current month (local time).
  const closingThisMonth = useMemo(() => {
    const now = new Date();
    return deals.filter(d => {
      if (d.status !== 'open') return false;
      const close = parseLocalDate(d.expectedCloseDate);
      return !!close && close.getFullYear() === now.getFullYear() && close.getMonth() === now.getMonth();
    });
  }, [deals]);

  // No activity 14+ days. The Deal type has no updated_at, so this uses the created date.
  const staleDeals = useMemo(() => {
    const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    return deals.filter(d => {
      if (d.status !== 'open') return false;
      const created = parseLocalDate(d.createdDate);
      return !!created && created.getTime() < cutoff;
    });
  }, [deals]);

  // Group deals by stage for pipeline view
  const dealsByStage = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage);
    return acc;
  }, {} as Record<DealStage, Deal[]>);

  // List view: text filter and sort by close date
  const listDeals = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const filtered = q
      ? deals.filter(d => {
          const company = companies.find(c => c.id === d.companyId)?.name || '';
          const product = d.sellingOptionId ? sellingOptions.find(o => o.id === d.sellingOptionId)?.name || '' : '';
          return [d.name, company, product, d.notes || '', d.nextStep].some(v => v.toLowerCase().includes(q));
        })
      : deals;
    return [...filtered].sort((a, b) => {
      const at = parseLocalDate(a.expectedCloseDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bt = parseLocalDate(b.expectedCloseDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return closeSortAsc ? at - bt : bt - at;
    });
  }, [deals, companies, sellingOptions, filterText, closeSortAsc]);

  if (deals.length === 0) {
    return (
      <div className="text-center py-12">
        <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Deals Yet</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-4">
          Deals are created from the Companies tab. Open a company and create your first deal to start tracking your pipeline.
        </p>
        <Button
          onClick={() => window.dispatchEvent(new CustomEvent('midconsight:goto-tab', { detail: { tab: 'companies' } }))}
        >
          Go to Companies
        </Button>
      </div>
    );
  }

  const nextStepLine = (deal: Deal) => {
    if (!deal.nextStep && !deal.nextStepDate) return null;
    const overdue = !isClosedStage(deal.stage) && isBeforeToday(deal.nextStepDate);
    return (
      <div className="text-xs mt-2 flex flex-wrap items-center gap-1">
        <Flag className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground truncate max-w-full">
          {deal.nextStep || 'Next step'}
          {deal.nextStepDate ? ` (${formatLocalDate(deal.nextStepDate)})` : ''}
        </span>
        {overdue && <span className="font-semibold text-destructive">Overdue</span>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <FreeUsageBadge used={openDeals.length} noun="open deals" />
      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">${totalPipeline.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{openDeals.length} open deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Weighted Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">${weightedPipeline.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Based on probability</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-success">${wonValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{wonDeals.length} closed won</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Closing this month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${closingThisMonth.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{closingThisMonth.length} open deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">No activity 14+ days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${staleDeals.length > 0 ? 'text-destructive' : ''}`}>
              {staleDeals.length}
            </div>
            <p className="text-xs text-muted-foreground">Open deals, by created date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {closedDeals.length > 0
                ? Math.round((wonDeals.length / closedDeals.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">{closedDeals.length} total closed</p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-border p-1">
          <Button
            variant={view === 'pipeline' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('pipeline')}
          >
            Pipeline
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('list')}
          >
            List
          </Button>
        </div>
      </div>

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="grid gap-4 md:grid-cols-6">
          {STAGE_ORDER.map(stage => (
            <div key={stage} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <Badge className={STAGE_STYLE[stage].color}>
                  {STAGES[stage].label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dealsByStage[stage].length}
                </span>
              </div>

              <div className="bg-muted/30 rounded-lg p-2 min-h-[200px] space-y-2">
                {dealsByStage[stage].map(deal => {
                  const productName = getSellingOptionName(deal.sellingOptionId);
                  const weightedValue = Math.round(deal.value * (deal.probability / 100));
                  const open = !isClosedStage(stage);

                  return (
                    <div
                      key={deal.id}
                      className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="font-medium text-sm truncate">{deal.name}</div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${deal.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ kind: 'delete', deal });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {getCompanyName(deal.companyId)}
                      </div>

                      {productName && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {productName}
                        </Badge>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm font-semibold text-primary">
                          ${deal.value.toLocaleString()}
                        </div>
                        <div className={`text-xs font-medium flex items-center gap-1 ${PROBABILITY_COLORS[deal.probability] || 'text-muted-foreground'}`}>
                          <Percent className="h-3 w-3" />
                          {deal.probability}%
                        </div>
                      </div>

                      {open && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Weighted: ${weightedValue.toLocaleString()}
                        </div>
                      )}

                      {nextStepLine(deal)}

                      {open && (
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveForward(deal);
                            }}
                          >
                            Move Forward <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPending({ kind: 'lost', deal });
                            }}
                          >
                            Mark Lost
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by deal, company, product, notes..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium">Deal</th>
                  <th className="text-left p-4 text-sm font-medium">Company</th>
                  <th className="text-left p-4 text-sm font-medium">Product</th>
                  <th className="text-left p-4 text-sm font-medium">Stage</th>
                  <th className="text-center p-4 text-sm font-medium">Probability</th>
                  <th className="text-right p-4 text-sm font-medium">Value</th>
                  <th className="text-right p-4 text-sm font-medium">Weighted</th>
                  <th className="text-left p-4 text-sm font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-primary"
                      onClick={() => setCloseSortAsc(v => !v)}
                      aria-label="Sort by expected close date"
                    >
                      Expected Close
                      <ArrowUpDown className="h-3 w-3" />
                      <span className="text-xs text-muted-foreground">{closeSortAsc ? 'soonest' : 'latest'}</span>
                    </button>
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listDeals.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                      No deals match your filter.
                    </td>
                  </tr>
                )}
                {listDeals.map(deal => {
                  const productName = getSellingOptionName(deal.sellingOptionId);
                  const weightedValue = Math.round(deal.value * (deal.probability / 100));
                  const overdue = !isClosedStage(deal.stage) && isBeforeToday(deal.nextStepDate);

                  return (
                    <tr
                      key={deal.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      <td className="p-4">
                        <div className="font-medium">{deal.name}</div>
                        {deal.nextStep ? (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            Next: {deal.nextStep}
                            {overdue && <span className="ml-1 font-semibold text-destructive">Overdue</span>}
                          </div>
                        ) : deal.notes ? (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {deal.notes.split('\n')[0]}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {getCompanyName(deal.companyId)}
                        </div>
                      </td>
                      <td className="p-4">
                        {productName ? (
                          <Badge variant="outline" className="text-xs">
                            {productName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Select
                          value={deal.stage}
                          onValueChange={(value) => {
                            const next = value as DealStage;
                            if (next === 'closed_won') setPending({ kind: 'won', deal });
                            else handleStageChange(deal, next);
                          }}
                        >
                          <SelectTrigger className="w-[140px]" onClick={e => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_ORDER.map(stage => (
                              <SelectItem key={stage} value={stage}>
                                {STAGES[stage].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-medium ${PROBABILITY_COLORS[deal.probability] || 'text-muted-foreground'}`}>
                          {deal.probability}%
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-semibold text-primary">
                          ${deal.value.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-muted-foreground">
                          ${weightedValue.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatLocalDate(deal.expectedCloseDate)}
                        </div>
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${deal.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ kind: 'delete', deal });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deal Detail Modal */}
      <DealDetailModal
        deal={selectedDeal}
        company={selectedDeal ? getCompany(selectedDeal.companyId) : null}
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onRefresh={() => {
          onRefresh();
          setSelectedDeal(null);
        }}
      />

      <ConfirmAction
        open={!!pending}
        title={pendingCopy.title}
        description={pendingCopy.description}
        confirmLabel={pendingCopy.confirm}
        destructive={pending?.kind === 'delete' || pending?.kind === 'lost'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
