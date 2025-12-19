import { useState, useEffect, useCallback } from 'react';
import { 
  getAllDatasets, 
  getActiveDataset, 
  setActiveDataset, 
  deleteDataset,
  getAllPermitsFromActiveDataset,
  getAllCompanies,
  getAllDeals,
  getRecentActivities,
  type Dataset,
  type Company,
  type Deal,
  type Activity
} from '@/lib/indexeddb';
import type { Permit } from '@/lib/schema-mapping';

export function useMidconData() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDataset, setActiveDatasetState] = useState<Dataset | null>(null);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ds, active, perms, comps, dls, acts] = await Promise.all([
        getAllDatasets(),
        getActiveDataset(),
        getAllPermitsFromActiveDataset(),
        getAllCompanies(),
        getAllDeals(),
        getRecentActivities(50)
      ]);
      
      setDatasets(ds);
      setActiveDatasetState(active || null);
      setPermits(perms);
      setCompanies(comps);
      setDeals(dls);
      setActivities(acts);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchDataset = async (datasetId: string) => {
    await setActiveDataset(datasetId);
    await refresh();
  };

  const removeDataset = async (datasetId: string) => {
    await deleteDataset(datasetId);
    await refresh();
  };

  // Computed values
  const hotLeads = companies.filter(c => c.score === 'hot').length;
  const warmLeads = companies.filter(c => c.score === 'warm').length;
  const pipelineValue = deals.filter(d => d.status === 'open').reduce((sum, d) => sum + d.value, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newThisWeek = permits.filter(p => new Date(p.dateImported) >= sevenDaysAgo).length;

  return {
    datasets,
    activeDataset,
    permits,
    companies,
    deals,
    activities,
    loading,
    refresh,
    switchDataset,
    removeDataset,
    stats: {
      totalPermits: permits.length,
      newThisWeek,
      hotLeads,
      warmLeads,
      pipelineValue
    }
  };
}
