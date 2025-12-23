/**
 * Research Desk Component
 * Pre-pipeline staging area for new permits
 */

import { useState, useMemo } from 'react';
import { 
  Search, 
  ExternalLink, 
  Archive, 
  CheckCircle2,
  Flame,
  Thermometer,
  Filter,
  ChevronRight,
  Building2,
  MapPin,
  Calendar,
  Layers
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

type ResearchStatus = 'new' | 'pending' | 'verified' | 'archived';
type Priority = 'hot' | 'warm' | 'cold';

interface ResearchPermit extends Permit {
  researchStatus: ResearchStatus;
  priority: Priority;
}

interface ResearchDeskProps {
  permits: Permit[];
  companies: Company[];
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<ResearchStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  pending: { label: 'Pending', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  verified: { label: 'Verified', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  archived: { label: 'Archived', color: 'bg-muted text-muted-foreground border-muted' },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: React.ReactNode; color: string }> = {
  hot: { label: 'Hot', icon: <Flame className="h-3 w-3" />, color: 'text-red-500' },
  warm: { label: 'Warm', icon: <Thermometer className="h-3 w-3" />, color: 'text-amber-500' },
  cold: { label: 'Cold', icon: <Layers className="h-3 w-3" />, color: 'text-blue-400' },
};

// Calculate priority based on permit characteristics
function calculatePriority(permit: Permit, companies: Company[]): Priority {
  const company = companies.find(c => c.name === permit.operator);
  if (company?.score === 'hot') return 'hot';
  if (company?.score === 'warm') return 'warm';
  
  // Hot if recent permit or high-value well type
  const isRecent = permit.approvalDate && 
    new Date(permit.approvalDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const isHighValue = ['HORIZONTAL', 'DIRECTIONAL'].includes(permit.drillType?.toUpperCase() || '');
  
  if (isRecent || isHighValue) return 'warm';
  return 'cold';
}

// Get research status from localStorage (temporary persistence)
function getResearchStatus(permitId: string): ResearchStatus {
  const stored = localStorage.getItem(`research_status_${permitId}`);
  return (stored as ResearchStatus) || 'new';
}

function setResearchStatusLocal(permitId: string, status: ResearchStatus) {
  localStorage.setItem(`research_status_${permitId}`, status);
}

export function ResearchDesk({ permits, companies, onRefresh }: ResearchDeskProps) {
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResearchStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');

  // Convert permits to research permits with status and priority
  const researchPermits = useMemo<ResearchPermit[]>(() => {
    return permits.map(permit => ({
      ...permit,
      researchStatus: getResearchStatus(permit.id),
      priority: calculatePriority(permit, companies),
    }));
  }, [permits, companies]);

  // Filter and sort permits
  const filteredPermits = useMemo(() => {
    return researchPermits
      .filter(p => {
        // Exclude archived unless specifically filtering for them
        if (statusFilter !== 'archived' && p.researchStatus === 'archived') return false;
        
        // Status filter
        if (statusFilter !== 'all' && p.researchStatus !== statusFilter) return false;
        
        // Priority filter
        if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
        
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            p.operator.toLowerCase().includes(query) ||
            p.api.toLowerCase().includes(query) ||
            (p.county?.toLowerCase() || '').includes(query) ||
            (p.wellName?.toLowerCase() || '').includes(query)
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
        return new Date(b.approvalDate || b.dateImported).getTime() - 
               new Date(a.approvalDate || a.dateImported).getTime();
      });
  }, [researchPermits, statusFilter, priorityFilter, searchQuery]);

  const selectedPermit = selectedPermitId 
    ? researchPermits.find(p => p.id === selectedPermitId) 
    : null;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredPermits.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (permitId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(permitId);
    } else {
      newSelected.delete(permitId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkArchive = () => {
    selectedIds.forEach(id => {
      setResearchStatusLocal(id, 'archived');
    });
    setSelectedIds(new Set());
    toast.success(`Archived ${selectedIds.size} permits`);
    onRefresh();
  };

  const handleStatusChange = (permitId: string, status: ResearchStatus) => {
    setResearchStatusLocal(permitId, status);
    onRefresh();
  };

  const handleDealCreated = () => {
    if (selectedPermitId) {
      setResearchStatusLocal(selectedPermitId, 'verified');
    }
    setSelectedPermitId(null);
    onRefresh();
  };

  // Stats
  const newCount = researchPermits.filter(p => p.researchStatus === 'new').length;
  const pendingCount = researchPermits.filter(p => p.researchStatus === 'pending').length;
  const verifiedCount = researchPermits.filter(p => p.researchStatus === 'verified').length;
  const hotCount = researchPermits.filter(p => p.priority === 'hot' && p.researchStatus !== 'archived').length;

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Main Table Area */}
      <div className={`flex-1 flex flex-col ${selectedPermit ? 'mr-4' : ''}`}>
        {/* Header Stats */}
        <div className="grid gap-3 grid-cols-4 mb-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-bold text-blue-400">{newCount}</div>
            <div className="text-xs text-muted-foreground">New Leads</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">In Research</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-bold text-green-400">{verifiedCount}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-bold text-red-500">{hotCount}</div>
            <div className="text-xs text-muted-foreground">Hot Leads</div>
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
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
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

          {selectedIds.size > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleBulkArchive}
              className="ml-auto"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive {selectedIds.size} selected
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
                    checked={selectedIds.size === filteredPermits.length && filteredPermits.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-24">Priority</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Permit Date</TableHead>
                <TableHead>Well Type</TableHead>
                <TableHead>County</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No permits found. Import data or adjust filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPermits.map(permit => (
                  <TableRow 
                    key={permit.id}
                    className={`cursor-pointer transition-colors ${
                      selectedPermitId === permit.id 
                        ? 'bg-primary/10 border-l-2 border-l-primary' 
                        : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setSelectedPermitId(permit.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(permit.id)}
                        onCheckedChange={(checked) => handleSelectOne(permit.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 font-medium ${PRIORITY_CONFIG[permit.priority].color}`}>
                        {PRIORITY_CONFIG[permit.priority].icon}
                        {PRIORITY_CONFIG[permit.priority].label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{permit.operator}</div>
                      <div className="text-xs text-muted-foreground">{permit.api}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {permit.approvalDate 
                          ? new Date(permit.approvalDate).toLocaleDateString()
                          : new Date(permit.dateImported).toLocaleDateString()
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {permit.wellType || permit.drillType || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {permit.county || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select 
                        value={permit.researchStatus} 
                        onValueChange={(v) => handleStatusChange(permit.id, v as ResearchStatus)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
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
      {selectedPermit && (
        <ResearchSidebar
          permit={selectedPermit}
          companies={companies}
          onClose={() => setSelectedPermitId(null)}
          onStatusChange={(status) => handleStatusChange(selectedPermit.id, status)}
          onDealCreated={handleDealCreated}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
