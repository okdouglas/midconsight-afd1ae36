import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  getAllPermits,
  getAllCompanies,
  getAllDeals,
  getAllDatasets,
  deleteDataset as deleteDatasetFn,
  calculateScore,
  AVG_PERMIT_VALUE,
  type DbCompany,
  type DbDeal,
  type DbDataset
} from '@/lib/supabase-data';
import type { Permit } from '@/lib/schema-mapping';

// Frontend-friendly types (matching old indexeddb types for compatibility)
export interface Company {
  id: string;
  name: string;
  operatorNumber?: string;
  permitCount: number;
  totalValue: number;
  score: 'hot' | 'warm' | 'cold';
  lastPermitDate: string;
  createdDate: string;
  city?: string;
  state?: string;
  isCurrentClient?: boolean;
  hqAddress?: string;
  primaryContactId?: string;
  /** True for companies synthesized from the shared permit feed rather than
   *  a real row you've created — a starter view so new paid accounts see
   *  live data on day one instead of an empty CRM. Becomes a real record
   *  the moment you act on it (mark as client, create a deal). */
  isPreview?: boolean;
}

export interface Deal {
  id: string;
  companyId: string;
  name: string;
  stage: 'new_lead' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';
  value: number;
  expectedCloseDate: string;
  status: 'open' | 'closed';
  linkedPermitIds: string[];
  notes?: string;
  sellingOptionId?: string;
  probability: number;
  createdDate: string;
}

export interface Dataset {
  id: string;
  name: string;
  uploadedAt: string;
  fileName: string;
  permitCount: number;
  validRows: number;
  skippedRows: number;
  isActive: boolean;
}

// Mappers
function mapDbCompanyToCompany(db: DbCompany): Company {
  return {
    id: db.id,
    name: db.name,
    operatorNumber: db.operator_number,
    permitCount: db.permit_count || 0,
    totalValue: Number(db.total_value) || 0,
    score: db.score as 'hot' | 'warm' | 'cold',
    lastPermitDate: db.last_permit_date || db.created_at,
    createdDate: db.created_at,
    city: db.city,
    state: db.state,
    isCurrentClient: db.is_current_client,
    hqAddress: db.hq_address,
    primaryContactId: db.primary_contact_id,
  };
}

function mapDbDealToDeal(db: DbDeal): Deal {
  return {
    id: db.id,
    companyId: db.company_id,
    name: db.name,
    stage: db.stage as Deal['stage'],
    value: Number(db.value) || 0,
    expectedCloseDate: db.expected_close_date || db.created_at,
    status: db.status as 'open' | 'closed',
    linkedPermitIds: db.linked_permit_ids || [],
    notes: db.notes,
    sellingOptionId: db.selling_option_id,
    probability: db.probability || 10,
    createdDate: db.created_at,
  };
}

function mapDbDatasetToDataset(db: DbDataset): Dataset {
  return {
    id: db.id,
    name: db.name,
    uploadedAt: db.created_at,
    fileName: db.file_name || 'Unknown',
    permitCount: db.permit_count || 0,
    validRows: db.valid_rows || 0,
    skippedRows: db.skipped_rows || 0,
    isActive: db.is_active || false,
  };
}

const ROLLUP_WINDOW_DAYS = 30;

/**
 * Builds a default company view from recent permits so a first-time paid
 * user sees real, connected data (permits → companies) immediately,
 * instead of an empty CRM until they run their own import.
 *
 * Real company records (rows you've created/edited — marked as a client,
 * linked to a deal, etc.) always take priority. This only fills in
 * operators that don't have a real record yet, computed from permits
 * imported in the last 30 days that you have visibility into (your own
 * permits, plus the shared feed if you're on the paid plan — free-plan
 * permits are already 30+ days delayed by RLS, so this naturally
 * contributes nothing extra for free accounts).
 */
function buildCompanyRollups(permits: Permit[], realCompanies: Company[]): Company[] {
  const realNames = new Set(realCompanies.map((c) => c.name.toLowerCase()));

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - ROLLUP_WINDOW_DAYS);
  const windowStartStr = windowStart.toISOString().split('T')[0];

  const recentPermits = permits.filter((p) => p.dateImported >= windowStartStr);

  const byOperator = new Map<string, Permit[]>();
  for (const permit of recentPermits) {
    if (!permit.operator || realNames.has(permit.operator.toLowerCase())) continue;
    const existing = byOperator.get(permit.operator) || [];
    existing.push(permit);
    byOperator.set(permit.operator, existing);
  }

  const previews: Company[] = [];
  byOperator.forEach((operatorPermits, operatorName) => {
    const lastPermitDate = operatorPermits.reduce((latest, p) => {
      const date = p.approvalDate || p.dateImported;
      return date > latest ? date : latest;
    }, '1900-01-01');

    previews.push({
      id: `preview-${operatorName}`,
      name: operatorName,
      operatorNumber: operatorPermits[0]?.operatorNumber,
      permitCount: operatorPermits.length,
      totalValue: operatorPermits.length * AVG_PERMIT_VALUE,
      score: calculateScore(operatorPermits.length, operatorPermits.length),
      lastPermitDate,
      createdDate: lastPermitDate,
      city: operatorPermits[0]?.city,
      state: operatorPermits[0]?.state,
      isCurrentClient: false,
      isPreview: true,
    });
  });

  return [...realCompanies, ...previews];
}

export function useSupabaseData() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setDatasets([]);
      setPermits([]);
      setCompanies([]);
      setDeals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [perms, comps, dls, ds] = await Promise.all([
        getAllPermits(),
        getAllCompanies(),
        getAllDeals(),
        getAllDatasets()
      ]);

      setPermits(perms);
      const realCompanies = comps.map(mapDbCompanyToCompany);
      setCompanies(buildCompanyRollups(perms, realCompanies));
      setDeals(dls.map(mapDbDealToDeal));
      setDatasets(ds.map(mapDbDatasetToDataset));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const removeDataset = async (datasetId: string) => {
    await deleteDatasetFn(datasetId);
    await refresh();
  };

  // Computed values
  const hotLeads = companies.filter(c => c.score === 'hot').length;
  const warmLeads = companies.filter(c => c.score === 'warm').length;
  const pipelineValue = deals.filter(d => d.status === 'open').reduce((sum, d) => sum + d.value, 0);

  // New this week based on approval_date (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const newThisWeek = permits.filter(p => p.approvalDate && p.approvalDate >= sevenDaysAgoStr).length;

  // Get new this week permits for dashboard map (based on approval_date)
  const newThisWeekPermits = permits.filter(p => p.approvalDate && p.approvalDate >= sevenDaysAgoStr);

  return {
    datasets,
    permits,
    companies,
    deals,
    loading,
    refresh,
    removeDataset,
    newThisWeekPermits,
    stats: {
      totalPermits: permits.length,
      newThisWeek,
      hotLeads,
      warmLeads,
      pipelineValue
    }
  };
}
