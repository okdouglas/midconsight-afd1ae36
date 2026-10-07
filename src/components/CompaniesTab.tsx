/**
 * Companies Tab Component
 * Perpetual all-time view of companies with click-to-expand CRM
 * Includes Current Clients section
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { windowLabel, computeOperatorStats, whyLine } from '@/lib/scoring';
import { Users, Flame, Thermometer, Snowflake, Search, Building2, ChevronUp, ChevronDown, ArrowUpDown, UserCheck, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { type Company, type Deal } from '@/hooks/useSupabaseData';
import { type Permit } from '@/lib/schema-mapping';
import { CompanyDetailModal } from './CompanyDetailModal';
import { getContactsForCompanies, promoteCompanyPreview, type DbContact } from '@/lib/supabase-data';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CompaniesTabProps {
  companies: Company[];
  permits: Permit[];
  deals: Deal[];
  onRefresh: () => void;
  windowDays: number;
  hiddenCompanyCount?: number;
  /** Company records with no tracked permits, no deal and no client flag. Shown on request. */
  hiddenCompanies?: Company[];
  /** Open this company's modal once, then call onOpenCompanyHandled. Set by the open-company event. */
  openCompanyName?: string | null;
  onOpenCompanyHandled?: () => void;
  /** Apply a hot, warm or cold filter once (the Hot Leads card on the dashboard). */
  requestedScoreFilter?: 'hot' | 'warm' | 'cold' | null;
  onRequestedScoreFilterHandled?: () => void;
}

type SortField = 'name' | 'permitCount' | 'heat' | 'dealCount' | 'weightedRevenue' | 'score';
type SortDirection = 'asc' | 'desc';

interface CompanyWithDetails extends Company {
  primaryContact?: string;
  dealCount: number;
  weightedRevenue: number;
}

function FilterChip({
  active,
  clearable = false,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  clearable?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? 'border-primary bg-primary/10 text-foreground font-medium' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
      }`}
    >
      {icon}
      {children}
      {active && clearable && <X className="h-3.5 w-3.5" aria-label="Clear filter" />}
    </button>
  );
}

export function CompaniesTab({ companies, permits, deals, onRefresh, windowDays, hiddenCompanyCount = 0, hiddenCompanies = [], openCompanyName = null, onOpenCompanyHandled, requestedScoreFilter = null, onRequestedScoreFilterHandled }: CompaniesTabProps) {
  const [pickedCompany, setSelectedCompany] = useState<Company | null>(null);
  // The open company always reflects the live score, so moving the score window
  // updates it while the modal is open.
  const selectedCompany = useMemo<Company | null>(() => {
    if (!pickedCompany) return null;
    const live = companies.find((c) => c.name === pickedCompany.name);
    return live ? { ...live, id: pickedCompany.id, isPreview: false } : pickedCompany;
  }, [pickedCompany, companies]);
  const [promotingName, setPromotingName] = useState<string | null>(null);

  const handleSelectCompany = async (company: Company) => {
    if (promotingName) return;
    if (!company.isPreview) {
      setSelectedCompany(company);
      return;
    }
    // Turn the preview into a real record before opening the modal, since
    // the modal's contacts/deals/client-toggle actions all need a real
    // company_id to write against.
    setPromotingName(company.name);
    try {
      const real = await promoteCompanyPreview({
        name: company.name,
        operatorNumber: company.operatorNumber,
        permitCount: company.permitCount,
        totalValue: company.totalValue,
        score: company.score,
        lastPermitDate: company.lastPermitDate,
        city: company.city,
        state: company.state,
      });
      setSelectedCompany({
        id: real.id,
        name: real.name,
        operatorNumber: real.operator_number,
        permitCount: real.permit_count || 0,
        totalValue: Number(real.total_value) || 0,
        score: real.score as 'hot' | 'warm' | 'cold',
        lastPermitDate: real.last_permit_date || real.created_at,
        createdDate: real.created_at,
        city: real.city,
        state: real.state,
        isCurrentClient: real.is_current_client,
      });
      onRefresh?.();
    } catch {
      toast.error(`Couldn't open ${company.name}. Please try again.`);
    } finally {
      setPromotingName(null);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [contacts, setContacts] = useState<Record<string, DbContact[]>>({});
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [activeView, setActiveView] = useState<'all' | 'prospects' | 'clients'>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Load contacts for every real company with one query (preview rows have no record yet).
  const realIdsKey = useMemo(
    () => companies.filter((c) => !c.isPreview && !c.id.startsWith('preview-')).map((c) => c.id).sort().join(','),
    [companies],
  );
  useEffect(() => {
    if (!realIdsKey) {
      setContacts({});
      return;
    }
    let cancelled = false;
    getContactsForCompanies(realIdsKey.split(','))
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, DbContact[]> = {};
        for (const row of rows) (map[row.company_id] ||= []).push(row);
        setContacts(map);
      })
      .catch(() => {
        // The table still works without a primary contact column.
      });
    return () => {
      cancelled = true;
    };
  }, [realIdsKey]);

  const getScoreIcon = (score: Company['score']) => {
    switch (score) {
      case 'hot': return <Flame className="h-4 w-4 text-score-hot" />;
      case 'warm': return <Thermometer className="h-4 w-4 text-score-warm-foreground" />;
      case 'cold': return <Snowflake className="h-4 w-4 text-primary" />;
    }
  };

  const getScoreBadge = (score: Company['score']) => {
    const variants: Record<Company['score'], string> = {
      hot: 'bg-score-hot/10 text-score-hot border-score-hot/30',
      warm: 'bg-score-warm text-score-warm-foreground border-score-warm-foreground/30',
      cold: 'bg-secondary text-primary-hover border-primary/20',
    };
    return variants[score];
  };

  // Split companies into clients and prospects
  // Inactive records (no tracked permits, no deal, not a client) only show on request.
  const allCompanies = useMemo(
    () => (showInactive ? [...companies, ...hiddenCompanies] : companies),
    [showInactive, companies, hiddenCompanies],
  );

  const currentClients = useMemo(() => {
    return allCompanies.filter(c => c.isCurrentClient);
  }, [allCompanies]);

  const prospects = useMemo(() => {
    return allCompanies.filter(c => !c.isCurrentClient);
  }, [allCompanies]);

  // Compute company details with deals and contacts
  const companiesWithDetails = useMemo<CompanyWithDetails[]>(() => {
    const baseCompanies = activeView === 'clients'
      ? currentClients
      : activeView === 'prospects'
        ? prospects
        : allCompanies;

    return baseCompanies.map(company => {
      const companyDeals = deals.filter(d => d.companyId === company.id && d.status === 'open');
      const dealCount = companyDeals.length;
      const weightedRevenue = companyDeals.reduce((sum, d) => {
        return sum + Math.round(d.value * ((d.probability || 10) / 100));
      }, 0);
      const primaryContact = contacts[company.id]?.[0]?.name || '-';

      return {
        ...company,
        primaryContact,
        dealCount,
        weightedRevenue
      };
    });
  }, [activeView, allCompanies, currentClients, prospects, deals, contacts]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ field, children, align = 'left' }: { field: SortField; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
      aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  // Permits filed in the last 30 days per operator, for the "why" line under each name.
  const recentByOperator = useMemo(() => {
    const m = new Map<string, number>();
    computeOperatorStats(permits, windowDays).forEach((s, name) => m.set(name.toLowerCase(), s.recent));
    return m;
  }, [permits, windowDays]);

  // Filter and sort companies
  const filteredCompanies = companiesWithDetails
    .filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.primaryContact && c.primaryContact.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesScore = scoreFilter === 'all' || c.score === scoreFilter;
      return matchesSearch && matchesScore;
    })
    .sort((a, b) => {
      const scorePriority = { hot: 3, warm: 2, cold: 1 };
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'permitCount':
          comparison = a.permitCount - b.permitCount;
          break;
        case 'heat':
          comparison = (a.heat ?? 0) - (b.heat ?? 0);
          break;
        case 'dealCount':
          comparison = a.dealCount - b.dealCount;
          break;
        case 'weightedRevenue':
          comparison = a.weightedRevenue - b.weightedRevenue;
          break;
        case 'score':
          comparison = scorePriority[a.score] - scorePriority[b.score] || (a.heat ?? 0) - (b.heat ?? 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Score counts follow the view (All, Prospects or Clients), so they match the rows you would see.
  const viewBase = activeView === 'clients' ? currentClients : activeView === 'prospects' ? prospects : allCompanies;
  const hotCount = viewBase.filter(c => c.score === 'hot').length;
  const warmCount = viewBase.filter(c => c.score === 'warm').length;
  const coldCount = viewBase.filter(c => c.score === 'cold').length;

  useEffect(() => {
    if (!requestedScoreFilter) return;
    setScoreFilter(requestedScoreFilter);
    setActiveView('all');
    setSearchQuery('');
    onRequestedScoreFilterHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedScoreFilter]);

  // Open a company when another screen asks (the open-company event, via Index).
  const handledOpen = useRef<string | null>(null);
  useEffect(() => {
    if (!openCompanyName || handledOpen.current === openCompanyName) return;
    const wanted = openCompanyName.toLowerCase();
    const match = companies.find((c) => c.name.toLowerCase() === wanted) ?? hiddenCompanies.find((c) => c.name.toLowerCase() === wanted);
    if (!match) {
      if (companies.length > 0) {
        toast.error(`No company record for ${openCompanyName} yet.`);
        handledOpen.current = openCompanyName;
        onOpenCompanyHandled?.();
      }
      return;
    }
    handledOpen.current = openCompanyName;
    handleSelectCompany(match).finally(() => {
      handledOpen.current = null;
      onOpenCompanyHandled?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCompanyName, companies, hiddenCompanies]);

  if (companies.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No companies yet</h2>
        <p className="text-muted-foreground">
          Companies show up here as permits load. New permits load every Monday.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter chips. The active one shows an x that clears it. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter companies">
        <FilterChip active={activeView === 'all'} onClick={() => setActiveView('all')} icon={<Building2 className="h-3.5 w-3.5" />}>
          All ({allCompanies.length})
        </FilterChip>
        <FilterChip active={activeView === 'prospects'} onClick={() => setActiveView(activeView === 'prospects' ? 'all' : 'prospects')} clearable icon={<Users className="h-3.5 w-3.5" />}>
          Prospects ({prospects.length})
        </FilterChip>
        <FilterChip active={activeView === 'clients'} onClick={() => setActiveView(activeView === 'clients' ? 'all' : 'clients')} clearable icon={<UserCheck className="h-3.5 w-3.5" />}>
          Current Clients ({currentClients.length})
        </FilterChip>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <FilterChip active={scoreFilter === 'hot'} onClick={() => setScoreFilter(scoreFilter === 'hot' ? 'all' : 'hot')} clearable icon={<Flame className="h-3.5 w-3.5 text-score-hot" />}>
          Hot ({hotCount})
        </FilterChip>
        <FilterChip active={scoreFilter === 'warm'} onClick={() => setScoreFilter(scoreFilter === 'warm' ? 'all' : 'warm')} clearable icon={<Thermometer className="h-3.5 w-3.5 text-score-warm-foreground" />}>
          Warm ({warmCount})
        </FilterChip>
        <FilterChip active={scoreFilter === 'cold'} onClick={() => setScoreFilter(scoreFilter === 'cold' ? 'all' : 'cold')} clearable icon={<Snowflake className="h-3.5 w-3.5 text-primary" />}>
          Cold ({coldCount})
        </FilterChip>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies or contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Companies Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold">
            {activeView === 'clients' ? 'Current Clients' : activeView === 'prospects' ? 'Prospects' : 'All Companies'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Showing {filteredCompanies.length} of {viewBase.length} {activeView === 'clients' ? 'clients' : 'companies'}. Click a row to see details and add contacts.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Scores look back {windowLabel(windowDays)}. A permit counts most when it is new and fades on the measured permit-to-production curve (about 6 months for a horizontal well).
            {hiddenCompanyCount > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setShowInactive((v) => !v)}
                  aria-pressed={showInactive}
                  className="text-primary hover:underline"
                >
                  {showInactive
                    ? `Hide ${hiddenCompanyCount} inactive records`
                    : `${hiddenCompanyCount} older records with no tracked permits are hidden. Show them.`}
                </button>
              </>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12">#</TableHead>
                <SortHeader field="name">Company</SortHeader>
                <SortHeader field="score">Score</SortHeader>
                <TableHead>Primary Contact</TableHead>
                <SortHeader field="permitCount">Permits</SortHeader>
                <SortHeader field="dealCount">Deals</SortHeader>
                <SortHeader field="weightedRevenue" align="right">Weighted Revenue</SortHeader>
                <SortHeader field="heat" align="right">Heat</SortHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {activeView === 'clients'
                      ? 'No current clients yet. Open a company and turn on Current Client.'
                      : 'No companies match these filters. Clear a chip or the search to see more.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company, index) => (
                  <TableRow
                    key={company.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleSelectCompany(company)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectCompany(company);
                      }
                    }}
                    tabIndex={0}
                    aria-busy={promotingName === company.name}
                  >
                    <TableCell className="text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          company.isCurrentClient ? 'bg-foreground/10' : 'bg-primary/10'
                        }`}>
                          {company.isCurrentClient ? (
                            <UserCheck className="h-4 w-4 text-foreground" />
                          ) : (
                            <Building2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {company.name}
                            {promotingName === company.name && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Opening" />
                            )}
                            {company.isCurrentClient && (
                              <Badge className="bg-foreground/10 text-foreground border-foreground/20 text-xs">
                                Client
                              </Badge>
                            )}
                            {company.isPreview && (
                              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                From recent permits
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {company.permitCount > 0
                              ? whyLine(company.heat ?? 0, company.windowCount ?? 0, recentByOperator.get(company.name.toLowerCase()) ?? 0)
                              : 'No permits tracked'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getScoreBadge(company.score)} text-xs`}>
                        {getScoreIcon(company.score)}
                        <span className="ml-1 capitalize">{company.score}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {company.primaryContact}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {company.permitCount}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {company.dealCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      ${company.weightedRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {(company.heat ?? 0).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Company Detail Modal */}
      <CompanyDetailModal
        company={selectedCompany}
        companyPermits={permits.filter(p => (p.operator || '').toLowerCase() === (selectedCompany?.name || '').toLowerCase())}
        windowDays={windowDays}
        onClose={() => setSelectedCompany(null)}
        onUpdate={onRefresh}
      />
    </div>
  );
}
