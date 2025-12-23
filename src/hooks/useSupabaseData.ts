import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  getAllPermits,
  getAllCompanies,
  getAllDeals,
  getAllDatasets,
  deleteDataset as deleteDatasetFn,
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
      setCompanies(comps.map(mapDbCompanyToCompany));
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

  // New this week based on date_imported
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const newThisWeek = permits.filter(p => p.dateImported >= sevenDaysAgoStr).length;

  // Get new this week permits for dashboard map
  const newThisWeekPermits = permits.filter(p => p.dateImported >= sevenDaysAgoStr);

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
