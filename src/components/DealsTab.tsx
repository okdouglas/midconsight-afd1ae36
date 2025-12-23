/**
 * Deals Tab Component
 * CRM for managing deal flow from companies
 */

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
  CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Deal, type Company } from '@/hooks/useSupabaseData';
import { updateDeal, getSellingOptionById, getSellingOptions, type DbSellingOption } from '@/lib/supabase-data';
import { DealDetailModal } from './DealDetailModal';

interface DealsTabProps {
  deals: Deal[];
  companies: Company[];
  onRefresh: () => void;
}

type DealStage = Deal['stage'];
type ReportingPeriod = 'weekly' | 'monthly' | 'quarterly';

const STAGE_ORDER: DealStage[] = ['new_lead', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];

const STAGE_CONFIG: Record<DealStage, { label: string; color: string; icon: React.ReactNode }> = {
  new_lead: { label: 'New Lead', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <ArrowRight className="h-4 w-4" /> },
  contacted: { label: 'Contacted', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <ArrowRight className="h-4 w-4" /> },
  qualified: { label: 'Qualified', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <ArrowRight className="h-4 w-4" /> },
  proposal: { label: 'Proposal', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <ArrowRight className="h-4 w-4" /> },
  closed_won: { label: 'Closed Won', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle2 className="h-4 w-4" /> },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="h-4 w-4" /> },
};

// Stage-to-probability mapping
const STAGE_PROBABILITY: Record<DealStage, number> = {
  new_lead: 10,
  contacted: 30,
  qualified: 60,
  proposal: 90,
  closed_won: 100,
  closed_lost: 0,
};

const PROBABILITY_COLORS: Record<number, string> = {
  0: 'text-red-500',
  10: 'text-red-400',
  30: 'text-orange-400',
  60: 'text-amber-400',
  90: 'text-green-400',
  100: 'text-green-500',
};

const PERIOD_CONFIG: Record<ReportingPeriod, { label: string; description: string }> = {
  weekly: { label: 'Weekly', description: 'Moved to Proposal this week' },
  monthly: { label: 'Monthly', description: 'Expected to close this month' },
  quarterly: { label: 'Quarterly', description: 'Closed Won this quarter' },
};

// Helper functions for date filtering
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff));
}

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getQuarterStart(): Date {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), quarter * 3, 1);
}

export function DealsTab({ deals, companies, onRefresh }: DealsTabProps) {
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriod>('weekly');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);

  useEffect(() => {
    getSellingOptions().then(setSellingOptions);
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
    const newStatus = (newStage === 'closed_won' || newStage === 'closed_lost') ? 'closed' : 'open';
    const newProbability = STAGE_PROBABILITY[newStage];
    
    await updateDeal(deal.id, { 
      stage: newStage, 
      status: newStatus,
      probability: newProbability
    });
    
    onRefresh();
  };

  // Period-based metrics
  const periodMetrics = useMemo(() => {
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();
    const quarterStart = getQuarterStart();

    // Weekly: Deals moved to Proposal this week
    const movedToProposalThisWeek = deals.filter(d => 
      d.stage === 'proposal' && new Date(d.createdDate) >= weekStart
    );

    // Monthly: Deals expected to close this month
    const closingThisMonth = deals.filter(d => {
      const closeDate = new Date(d.expectedCloseDate);
      return d.status === 'open' && closeDate >= monthStart && closeDate < new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    });

    // Quarterly: Closed Won this quarter
    const closedWonThisQuarter = deals.filter(d => 
      d.stage === 'closed_won' && new Date(d.createdDate) >= quarterStart
    );

    return {
      weekly: {
        deals: movedToProposalThisWeek,
        value: movedToProposalThisWeek.reduce((sum, d) => sum + d.value, 0),
        weighted: movedToProposalThisWeek.reduce((sum, d) => sum + Math.round(d.value * (d.probability / 100)), 0),
      },
      monthly: {
        deals: closingThisMonth,
        value: closingThisMonth.reduce((sum, d) => sum + d.value, 0),
        weighted: closingThisMonth.reduce((sum, d) => sum + Math.round(d.value * (d.probability / 100)), 0),
      },
      quarterly: {
        deals: closedWonThisQuarter,
        value: closedWonThisQuarter.reduce((sum, d) => sum + d.value, 0),
        weighted: closedWonThisQuarter.reduce((sum, d) => sum + d.value, 0), // 100% for closed won
      },
    };
  }, [deals]);

  const openDeals = deals.filter(d => d.status === 'open');
  const closedDeals = deals.filter(d => d.status === 'closed');
  const totalPipeline = openDeals.reduce((sum, d) => sum + d.value, 0);
  const weightedPipeline = openDeals.reduce((sum, d) => sum + Math.round(d.value * (d.probability / 100)), 0);
  const wonValue = deals.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + d.value, 0);

  // Group deals by stage for pipeline view
  const dealsByStage = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage);
    return acc;
  }, {} as Record<DealStage, Deal[]>);

  if (deals.length === 0) {
    return (
      <div className="text-center py-12">
        <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Deals Yet</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Deals are created from the Companies tab. Click on a company and create your first deal to start tracking your pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">${totalPipeline.toLocaleString()}</div>
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
            <div className="text-2xl font-bold text-amber-500">${weightedPipeline.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Based on probability</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">${wonValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{deals.filter(d => d.stage === 'closed_won').length} closed won</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${dealsByStage['proposal'].reduce((sum, d) => sum + d.value, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{dealsByStage['proposal'].length} deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {closedDeals.length > 0 
                ? Math.round((deals.filter(d => d.stage === 'closed_won').length / closedDeals.length) * 100) 
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
                <Badge className={STAGE_CONFIG[stage].color}>
                  {STAGE_CONFIG[stage].label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dealsByStage[stage].length}
                </span>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-2 min-h-[200px] space-y-2">
                {dealsByStage[stage].map(deal => {
                  const productName = getSellingOptionName(deal.sellingOptionId);
                  const weightedValue = Math.round(deal.value * (deal.probability / 100));
                  
                  return (
                    <div 
                      key={deal.id}
                      className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      <div className="font-medium text-sm truncate">{deal.name}</div>
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
                      
                      {stage !== 'closed_won' && stage !== 'closed_lost' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Weighted: ${weightedValue.toLocaleString()}
                        </div>
                      )}
                      
                      {stage !== 'closed_won' && stage !== 'closed_lost' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentIndex = STAGE_ORDER.indexOf(stage);
                            if (currentIndex < STAGE_ORDER.length - 2) {
                              handleStageChange(deal, STAGE_ORDER[currentIndex + 1]);
                            }
                          }}
                        >
                          Move Forward <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
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
                <th className="text-left p-4 text-sm font-medium">Expected Close</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deals.map(deal => {
                const productName = getSellingOptionName(deal.sellingOptionId);
                const weightedValue = Math.round(deal.value * (deal.probability / 100));
                
                return (
                  <tr 
                    key={deal.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedDeal(deal)}
                  >
                    <td className="p-4">
                      <div className="font-medium">{deal.name}</div>
                      {deal.notes && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {deal.notes}
                        </div>
                      )}
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
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Select 
                        value={deal.stage} 
                        onValueChange={(value) => handleStageChange(deal, value as DealStage)}
                      >
                        <SelectTrigger className="w-[140px]" onClick={e => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_ORDER.map(stage => (
                            <SelectItem key={stage} value={stage}>
                              {STAGE_CONFIG[stage].label}
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
                        {new Date(deal.expectedCloseDate).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </div>
  );
}
