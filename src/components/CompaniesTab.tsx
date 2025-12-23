/**
 * Companies Tab Component
 * Perpetual all-time view of companies with click-to-expand CRM
 * Includes Current Clients section
 */

import { useState, useEffect, useMemo } from 'react';
import { Users, Flame, Thermometer, Snowflake, Search, Building2, ChevronUp, ChevronDown, ArrowUpDown, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { type Company, type Deal } from '@/hooks/useSupabaseData';
import { type Permit } from '@/lib/schema-mapping';
import { CompanyDetailModal } from './CompanyDetailModal';
import { getContactsByCompany, getAllDeals, type DbContact, type DbDeal } from '@/lib/supabase-data';
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
}

type SortField = 'name' | 'permitCount' | 'totalValue' | 'dealCount' | 'weightedRevenue' | 'score';
type SortDirection = 'asc' | 'desc';

interface CompanyWithDetails extends Company {
  primaryContact?: string;
  dealCount: number;
  weightedRevenue: number;
}

export function CompaniesTab({ companies, permits, deals, onRefresh }: CompaniesTabProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [contacts, setContacts] = useState<Record<string, DbContact[]>>({});
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [activeView, setActiveView] = useState<'all' | 'prospects' | 'clients'>('all');

  // Load contacts for all companies
  useEffect(() => {
    const loadContacts = async () => {
      const contactMap: Record<string, DbContact[]> = {};
      for (const company of companies) {
        try {
          const companyContacts = await getContactsByCompany(company.id);
          if (companyContacts.length > 0) {
            contactMap[company.id] = companyContacts;
          }
        } catch (error) {
          // Silently fail for individual companies
        }
      }
      setContacts(contactMap);
    };
    if (companies.length > 0) {
      loadContacts();
    }
  }, [companies]);

  const getScoreIcon = (score: Company['score']) => {
    switch (score) {
      case 'hot': return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm': return <Thermometer className="h-4 w-4 text-amber-500" />;
      case 'cold': return <Snowflake className="h-4 w-4 text-blue-500" />;
    }
  };

  const getScoreBadge = (score: Company['score']) => {
    const variants: Record<Company['score'], string> = {
      hot: 'bg-red-500/20 text-red-400 border-red-500/30',
      warm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return variants[score];
  };

  // Split companies into clients and prospects
  const currentClients = useMemo(() => {
    return companies.filter(c => c.isCurrentClient);
  }, [companies]);

  const prospects = useMemo(() => {
    return companies.filter(c => !c.isCurrentClient);
  }, [companies]);

  // Compute company details with deals and contacts
  const companiesWithDetails = useMemo<CompanyWithDetails[]>(() => {
    const baseCompanies = activeView === 'clients' 
      ? currentClients 
      : activeView === 'prospects' 
        ? prospects 
        : companies;
    
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
  }, [activeView, companies, currentClients, prospects, deals, contacts]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
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
        case 'totalValue':
          comparison = a.totalValue - b.totalValue;
          break;
        case 'dealCount':
          comparison = a.dealCount - b.dealCount;
          break;
        case 'weightedRevenue':
          comparison = a.weightedRevenue - b.weightedRevenue;
          break;
        case 'score':
          comparison = scorePriority[a.score] - scorePriority[b.score];
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const hotCount = prospects.filter(c => c.score === 'hot').length;
  const warmCount = prospects.filter(c => c.score === 'warm').length;
  const coldCount = prospects.filter(c => c.score === 'cold').length;
  const totalPermits = permits.length;

  if (companies.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Companies Yet</h2>
        <p className="text-muted-foreground">
          Import permit data to automatically identify and score companies based on activity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Permits</div>
          <div className="text-2xl font-bold mt-1">{totalPermits}</div>
        </div>
        <div 
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${
            activeView === 'all' ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
          }`}
          onClick={() => setActiveView('all')}
        >
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Total Companies
          </div>
          <div className="text-2xl font-bold mt-1">{companies.length}</div>
        </div>
        <div 
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${
            activeView === 'clients' ? 'border-purple-500 bg-purple-500/10' : 'border-border bg-card hover:border-purple-500/50'
          }`}
          onClick={() => setActiveView('clients')}
        >
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-purple-500" />
            Current Clients
          </div>
          <div className="text-2xl font-bold text-purple-500 mt-1">{currentClients.length}</div>
        </div>
        <div 
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${
            scoreFilter === 'hot' ? 'border-red-500 bg-red-500/10' : 'border-border bg-card hover:border-red-500/50'
          }`}
          onClick={() => setScoreFilter(scoreFilter === 'hot' ? 'all' : 'hot')}
        >
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            Hot Leads
          </div>
          <div className="text-2xl font-bold text-red-500 mt-1">{hotCount}</div>
        </div>
        <div 
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${
            scoreFilter === 'warm' ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-card hover:border-amber-500/50'
          }`}
          onClick={() => setScoreFilter(scoreFilter === 'warm' ? 'all' : 'warm')}
        >
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-amber-500" />
            Warm Leads
          </div>
          <div className="text-2xl font-bold text-amber-500 mt-1">{warmCount}</div>
        </div>
        <div 
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${
            scoreFilter === 'cold' ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-card hover:border-blue-500/50'
          }`}
          onClick={() => setScoreFilter(scoreFilter === 'cold' ? 'all' : 'cold')}
        >
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-blue-500" />
            Cold Leads
          </div>
          <div className="text-2xl font-bold text-blue-500 mt-1">{coldCount}</div>
        </div>
      </div>

      {/* View Toggle */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'all' | 'prospects' | 'clients')}>
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            All Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="prospects" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Prospects ({prospects.length})
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Current Clients ({currentClients.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
            Showing {filteredCompanies.length} of {activeView === 'clients' ? currentClients.length : activeView === 'prospects' ? prospects.length : companies.length} {activeView === 'clients' ? 'clients' : 'companies'} • Click to view details and add contacts
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
                <SortHeader field="weightedRevenue">Weighted Revenue</SortHeader>
                <SortHeader field="totalValue">Est. Value</SortHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {activeView === 'clients' 
                      ? 'No current clients. Mark companies as clients from the Lead Research tab.'
                      : activeView === 'prospects'
                        ? 'No prospects found. Import permit data or adjust filters.'
                        : 'No companies found. Import permit data or adjust filters.'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company, index) => (
                  <TableRow 
                    key={company.id} 
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCompany(company)}
                  >
                    <TableCell className="text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          company.isCurrentClient ? 'bg-purple-500/10' : 'bg-primary/10'
                        }`}>
                          {company.isCurrentClient ? (
                            <UserCheck className="h-4 w-4 text-purple-500" />
                          ) : (
                            <Building2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {company.name}
                            {company.isCurrentClient && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                Client
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(company.lastPermitDate).toLocaleDateString()}
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
                    <TableCell className="text-right font-semibold text-green-600">
                      ${company.weightedRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      ${company.totalValue.toLocaleString()}
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
        companyPermits={permits.filter(p => p.operator === selectedCompany?.name)}
        onClose={() => setSelectedCompany(null)}
        onUpdate={onRefresh}
      />
    </div>
  );
}
