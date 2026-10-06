import { useState, useEffect, useCallback } from 'react';
import { getProfile, type DbProfile } from '@/lib/supabase-data';
import { useAuth } from './useAuth';

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const data = await getProfile();
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return {
    profile,
    loading,
    plan: profile?.plan ?? 'free',
    /** Starter or Pro: live feed, Lead Research, data import. */
    hasStarter: profile?.plan === 'starter' || profile?.plan === 'pro',
    /** Pro only: Companies, Deals, Product Catalog. */
    isPro: profile?.plan === 'pro',
    /** Any paid tier. */
    isPaid: profile?.plan === 'starter' || profile?.plan === 'pro',
    refresh,
  };
}
