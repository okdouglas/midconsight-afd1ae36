/**
 * Companies Tab Component
 * Perpetual all-time view of companies with click-to-expand CRM
 */

import { useState } from 'react';
import { Users, Flame, Thermometer, Snowflake, Search, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { type Company } from '@/hooks/useSupabaseData';
import { type Permit } from '@/lib/schema-mapping';
import { CompanyDetailModal } from './CompanyDetailModal';

interface CompaniesTabProps {
  companies: Company[];
  permits: Permit[];
  onRefresh: () => void;
}

export function CompaniesTab({ companies, permits, onRefresh }: CompaniesTabProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');

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

  // Filter and sort companies
  const filteredCompanies = companies
    .filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesScore = scoreFilter === 'all' || c.score === scoreFilter;
      return matchesSearch && matchesScore;
    })
    .sort((a, b) => {
      // Sort by score priority (hot > warm > cold), then by permit count
      const scorePriority = { hot: 3, warm: 2, cold: 1 };
      if (scorePriority[a.score] !== scorePriority[b.score]) {
        return scorePriority[b.score] - scorePriority[a.score];
      }
      return b.permitCount - a.permitCount;
    });

  const hotCount = companies.filter(c => c.score === 'hot').length;
  const warmCount = companies.filter(c => c.score === 'warm').length;
  const coldCount = companies.filter(c => c.score === 'cold').length;
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
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Companies</div>
          <div className="text-2xl font-bold mt-1">{companies.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Permits</div>
          <div className="text-2xl font-bold mt-1">{totalPermits}</div>
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

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Companies List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold">All-Time Companies</h3>
          <p className="text-sm text-muted-foreground">
            Showing {filteredCompanies.length} of {companies.length} companies • Click to view details and add contacts
          </p>
        </div>
        
        <div className="divide-y divide-border">
          {filteredCompanies.map((company, index) => (
            <div 
              key={company.id} 
              className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => setSelectedCompany(company)}
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground w-8">
                  {index + 1}
                </span>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {company.name}
                    <Badge className={`${getScoreBadge(company.score)} text-xs`}>
                      {getScoreIcon(company.score)}
                      <span className="ml-1 capitalize">{company.score}</span>
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {company.permitCount} permits • Last activity: {new Date(company.lastPermitDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold text-primary">
                  ${company.totalValue.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Est. value</div>
              </div>
            </div>
          ))}
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
