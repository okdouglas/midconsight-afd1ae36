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

export function useSupabaseData() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<DbDataset[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [companies, setCompanies] = useState<DbCompany[]>([]);
  const [deals, setDeals] = useState<DbDeal[]>([]);
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
      setCompanies(comps);
      setDeals(dls);
      setDatasets(ds);
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
  const pipelineValue = deals.filter(d => d.status === 'open').reduce((sum, d) => sum + Number(d.value), 0);

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
