/**
 * Research Desk Component
 * Pre-pipeline staging area for new permits - merged by operator
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Archive, 
  CheckCircle2,
  Flame,
  Thermometer,
  Filter,
  ChevronRight,
  Building2,
  MapPin,
  Calendar,
  Layers,
  UserCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ResearchSidebar } from './ResearchSidebar';
import { type Permit } from '@/lib/schema-mapping';
import { type Company } from '@/hooks/useSupabaseData';
import { toast } from 'sonner';
import { updateCompany, getAllResearchStatuses, setResearchStatus as persistResearchStatus } from '@/lib/supabase-data';

type ResearchStatus = 'new' | 'researching' | 'verified' | 'current_client' | 'archived';
type Priority = 'hot' | 'warm' | 'cold';

// Grouped operator lead
interface OperatorLead {
  operator: string;
  permits: Permit[];
  latestPermitDate: string;
  county: string;
  state: string;
  researchStatus: ResearchStatus;
  priority: Priority;
  company?: Company;
}

interface ResearchDeskProps {
  permits: Permit[];
  companies: Company[];
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<ResearchStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-secondary text-primary-hover border-primary/20' },
  researching: { label: 'Researching', color: 'bg-score-warm text-score-warm-foreground border-score-warm-foreground/30' },
  verified: { label: 'Verified', color: 'bg-success/10 text-success border-success/30' },
  current_client: { label: 'Current Client', color: 'bg-foreground/10 text-foreground border-foreground/20' },
  archived: { label: 'Archived', color: 'bg-muted text-muted-foreground border-muted' },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: React.ReactNode; color: string }> = {
  hot: { label: 'Hot', icon: <Flame className="h-3 w-3" />, color: 'text-score-hot' },
  warm: { label: 'Warm', icon: <Thermometer className="h-3 w-3" />, color: 'text-score-warm-foreground' },
  cold: { label: 'Cold', icon: <Layers className="h-3 w-3" />, color: 'text-primary' },
};

// Calculate priority based on permit characteristics
function calculatePriority(permits: Permit[], company?: Company): Priority {
  if (company?.score === 'hot') return 'hot';
  if (company?.score === 'warm') return 'warm';
  
  // Hot if recent permit or high-value well type
  const hasRecent = permits.some(p => 
    p.approvalDate && new Date(p.approvalDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const hasHighValue = permits.some(p => 
    ['HORIZONTAL', 'DIRECTIONAL'].includes(p.drillType?.toUpperCase() || '')
  );
  
  if (hasRecent || hasHighValue) return 'warm';
  return 'cold';
}

// Research status now persists server-side via Supabase (operator_research_status
// table) instead of localStorage, so it syncs across devices and team members.

export function ResearchDesk({ permits, companies, onRefresh }: ResearchDeskProps) {
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [selectedOperators, setSelectedOperators] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResearchStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [statusMap, setStatusMap] = useState<Record<string, ResearchStatus>>({});
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Load research statuses from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    getAllResearchStatuses()
      .then((map) => {
        if (!cancelled) setStatusMap(map as Record<string, ResearchStatus>);
      })
      .catch(() => {
        toast.error('Failed to load research status — showing defaults');
      })
      .finally(() => {
        if (!cancelled) setStatusLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Optimistically update local state, then persist; revert on failure.
  const updateStatus = async (operator: string, status: ResearchStatus) => {
    const previous = statusMap[operator] ?? 'new';
    setStatusMap((prev) => ({ ...prev, [operator]: status }));
    try {
      await persistResearchStatus(operator, status);
    } catch {
      setStatusMap((prev) => ({ ...prev, [operator]: previous }));
      toast.error(`Failed to save status for ${operator}`);
      throw new Error('persist-failed');
    }
  };

  // Get current client operators to filter out
  const currentClientOperators = useMemo(() => {
    return new Set(
      companies
        .filter(c => c.isCurrentClient)
        .map(c => c.name)
    );
  }, [companies]);

  // Group permits by operator (1 lead per operator), filter out current clients
  const operatorLeads = useMemo<OperatorLead[]>(() => {
    const operatorMap = new Map<string, Permit[]>();
    
    permits.forEach(permit => {
      // Skip permits from current clients
      if (currentClientOperators.has(permit.operator)) return;
      
      if (!operatorMap.has(permit.operator)) {
        operatorMap.set(permit.operator, []);
      }
      operatorMap.get(permit.operator)!.push(permit);
    });

    return Array.from(operatorMap.entries()).map(([operator, opPermits]) => {
      const company = companies.find(c => c.name === operator);
      const latestPermit = opPermits.reduce((latest, p) => {
        const pDate = new Date(p.approvalDate || p.dateImported);
        const lDate = new Date(latest.approvalDate || latest.dateImported);
        return pDate > lDate ? p : latest;
      }, opPermits[0]);

      return {
        operator,
        permits: opPermits,
        latestPermitDate: latestPermit.approvalDate || latestPermit.dateImported,
        county: latestPermit.county || 'Unknown',
        state: latestPermit.state || 'Unknown',
        researchStatus: statusMap[operator] ?? 'new',
        priority: calculatePriority(opPermits, company),
        company,
      };
    });
  }, [permits, companies, currentClientOperators, statusMap]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    return operatorLeads
      .filter(lead => {
        // Exclude archived unless specifically filtering for them
        if (statusFilter !== 'archived' && lead.researchStatus === 'archived') return false;
        
        // Status filter
        if (statusFilter !== 'all' && lead.researchStatus !== statusFilter) return false;
        
        // Priority filter
        if (priorityFilter !== 'all' && lead.priority !== priorityFilter) return false;
        
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            lead.operator.toLowerCase().includes(query) ||
            lead.county.toLowerCase().includes(query) ||
            lead.permits.some(p => p.api.toLowerCase().includes(query))
          );
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sort by priority (hot first), then by date
        const priorityOrder = { hot: 0, warm: 1, cold: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.latestPermitDate).getTime() - new Date(a.latestPermitDate).getTime();
      });
  }, [operatorLeads, statusFilter, priorityFilter, searchQuery]);

  const selectedLead = selectedOperator 
    ? operatorLeads.find(l => l.operator === selectedOperator) 
    : null;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOperators(new Set(filteredLeads.map(l => l.operator)));
    } else {
      setSelectedOperators(new Set());
    }
  };

  const handleSelectOne = (operator: string, checked: boolean) => {
    const newSelected = new Set(selectedOperators);
    if (checked) {
      newSelected.add(operator);
    } else {
      newSelected.delete(operator);
    }
    setSelectedOperators(newSelected);
  };

  const handleBulkArchive = async () => {
    const operators = Array.from(selectedOperators);
    setSelectedOperators(new Set());
    const results = await Promise.allSettled(operators.map((op) => updateStatus(op, 'archived')));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast.error(`Archived ${operators.length - failed} of ${operators.length} leads — ${failed} failed`);
    } else {
      toast.success(`Archived ${operators.length} leads`);
    }
    onRefresh();
  };

  const handleStatusChange = async (operator: string, status: ResearchStatus) => {
    try {
      await updateStatus(operator, status);
    } catch {
      return; // error toast already shown by updateStatus
    }

    // If marking as current client, update the company record
    if (status === 'current_client') {
      const lead = operatorLeads.find(l => l.operator === operator);
      if (lead?.company) {
        try {
          await updateCompany(lead.company.id, { is_current_client: true });
          toast.success(`${operator} marked as current client`);
        } catch (error) {
          toast.error('Failed to update company');
        }
      }
    }

    onRefresh();
  };

  const handleDealCreated = async () => {
    if (selectedOperator) {
      try {
        await updateStatus(selectedOperator, 'verified');
      } catch {
        // error toast already shown
      }
    }
    setSelectedOperator(null);
    onRefresh();
  };

  // Stats
  const newCount = operatorLeads.filter(l => l.researchStatus === 'new').length;
  const hotCount = operatorLeads.filter(l => l.priority === 'hot' && l.researchStatus !== 'archived').length;
  const currentClientCount = companies.filter(c => c.isCurrentClient).length;
  const researchingCount = operatorLeads.filter(l => l.researchStatus === 'researching').length;
  const verifiedCount = operatorLeads.filter(l => l.researchStatus === 'verified').length;

  if (!statusLoaded) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] text-sm text-muted-foreground">
        Loading research status…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Main Table Area */}
      <div className={`flex-1 flex flex-col ${selectedLead ? 'mr-4' : ''}`}>
        {/* Header Stats */}
        <div className="grid gap-3 grid-cols-5 mb-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-semibold text-primary">{newCount}</div>
            <div className="text-xs text-muted-foreground">New Leads</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-semibold text-score-hot">{hotCount}</div>
            <div className="text-xs text-muted-foreground">Hot Leads</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-semibold text-foreground">{currentClientCount}</div>
            <div className="text-xs text-muted-foreground">Current Clients</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-semibold text-score-warm-foreground">{researchingCount}</div>
            <div className="text-xs text-muted-foreground">Researching</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-semibold text-success">{verifiedCount}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search operator, API, county..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="researching">Researching</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="current_client">Current Client</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="w-[140px]">
              <Flame className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>

          {selectedOperators.size > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleBulkArchive}
              className="ml-auto"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive {selectedOperators.size} selected
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border border-border rounded-lg">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedOperators.size === filteredLeads.length && filteredLeads.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-24">Priority</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Latest Permit</TableHead>
                <TableHead>County</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No leads found. Import data or adjust filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map(lead => (
                  <TableRow 
                    key={lead.operator}
                    className={`cursor-pointer transition-colors ${
                      selectedOperator === lead.operator 
                        ? 'bg-primary/10 border-l-2 border-l-primary' 
                        : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setSelectedOperator(lead.operator)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedOperators.has(lead.operator)}
                        onCheckedChange={(checked) => handleSelectOne(lead.operator, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 font-medium ${PRIORITY_CONFIG[lead.priority].color}`}>
                        {PRIORITY_CONFIG[lead.priority].icon}
                        {PRIORITY_CONFIG[lead.priority].label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{lead.operator}</div>
                      <div className="text-xs text-muted-foreground">{lead.permits.length} permit{lead.permits.length > 1 ? 's' : ''}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(lead.latestPermitDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {lead.county}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select 
                        value={lead.researchStatus} 
                        onValueChange={(v) => handleStatusChange(lead.operator, v as ResearchStatus)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="researching">Researching</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="current_client">
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              Current Client
                            </span>
                          </SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Research Sidebar */}
      {selectedLead && (
        <ResearchSidebar
          permit={selectedLead.permits[0]}
          allPermits={selectedLead.permits}
          companies={companies}
          onClose={() => setSelectedOperator(null)}
          onStatusChange={(status) => handleStatusChange(selectedLead.operator, status)}
          onDealCreated={handleDealCreated}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
