import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  getAllPermits,
  getAllCompanies,
  getAllDeals,
  getAllDatasets,
  deleteDataset as deleteDatasetFn,
  AVG_PERMIT_VALUE,
  type DbCompany,
  type DbDeal,
  type DbDataset
} from '@/lib/supabase-data';
import type { Permit } from '@/lib/schema-mapping';
import { computeOperatorStats, DEFAULT_WINDOW_DAYS } from '@/lib/scoring';

// Frontend-friendly types (matching old indexeddb types for compatibility)
export interface Company {
  id: string;
  name: string;
  operatorNumber?: string;
  permitCount: number;
  totalValue: number;
  score: 'hot' | 'warm' | 'cold' | 'pending';
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
  /** Permits inside the lookback. */
  windowCount?: number;
  /** Pipeline: expected wells still coming, weighted by the measured permit-to-production curve. Drives the live score. */
  heat?: number;
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
  /** Empty string when the next_step columns are absent or unset. */
  nextStep: string;
  /** YYYY-MM-DD or empty string. */
  nextStepDate: string;
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
    score: db.score as 'hot' | 'warm' | 'cold' | 'pending',
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
    probability: db.probability ?? 10,
    nextStep: db.next_step || '',
    nextStepDate: db.next_step_date || '',
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

/**
 * Builds the company list live from the permits you can see.
 *
 * Counts, last permit date and score all come from permits and the scoring
 * window, never from the stored company row, which is only a snapshot from
 * the last import. Stored rows still supply the CRM fields (client flag,
 * HQ address, primary contact). A stored company with no tracked permits is
 * kept only if it is a client or has a deal. The rest are counted as hidden.
 */
function buildLiveCompanies(
  permits: Permit[],
  realCompanies: Company[],
  deals: Deal[],
  windowDays: number,
): { companies: Company[]; hiddenCount: number; hidden: Company[] } {
  const stats = computeOperatorStats(permits, windowDays);
  const realByName = new Map(realCompanies.map((c) => [c.name.toLowerCase(), c]));
  const dealCompanyIds = new Set(deals.map((d) => d.companyId));
  const out: Company[] = [];
  const used = new Set<string>();

  stats.forEach((st, operatorName) => {
    const real = realByName.get(operatorName.toLowerCase());
    if (real) used.add(real.id);
    const first = st.permits[0];
    out.push({
      id: real?.id ?? `preview-${operatorName}`,
      name: real?.name ?? operatorName,
      operatorNumber: real?.operatorNumber ?? first?.operatorNumber,
      permitCount: st.total,
      windowCount: st.inWindow,
      heat: st.heat,
      totalValue: st.total * AVG_PERMIT_VALUE,
      score: st.score,
      lastPermitDate: st.lastPermitDate || real?.lastPermitDate || '',
      createdDate: real?.createdDate ?? st.lastPermitDate,
      city: real?.city ?? first?.city,
      state: real?.state ?? first?.state,
      isCurrentClient: real?.isCurrentClient ?? false,
      hqAddress: real?.hqAddress,
      primaryContactId: real?.primaryContactId,
      isPreview: !real,
    });
  });

  let hiddenCount = 0;
  const hidden: Company[] = [];
  for (const real of realCompanies) {
    if (used.has(real.id)) continue;
    if (real.isCurrentClient || dealCompanyIds.has(real.id)) {
      out.push({ ...real, permitCount: 0, windowCount: 0, heat: 0, totalValue: 0, score: 'cold' });
    } else {
      hiddenCount += 1;
      hidden.push({ ...real, permitCount: 0, windowCount: 0, heat: 0, totalValue: 0, score: 'cold' });
    }
  }
  return { companies: out, hiddenCount, hidden };
}

export function useSupabaseData() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [realCompanies, setRealCompanies] = useState<Company[]>([]);
  const windowDays = DEFAULT_WINDOW_DAYS;
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setDatasets([]);
      setPermits([]);
      setRealCompanies([]);
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
      setRealCompanies(comps.map(mapDbCompanyToCompany));
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
  const { companies, hiddenCount: hiddenCompanyCount, hidden: hiddenCompanies } = useMemo(
    () => buildLiveCompanies(permits, realCompanies, deals, windowDays),
    [permits, realCompanies, deals, windowDays],
  );

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
    windowDays,
    hiddenCompanyCount,
    hiddenCompanies,
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
