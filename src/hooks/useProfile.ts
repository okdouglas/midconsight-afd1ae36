import { useState, useEffect, useCallback } from 'react';
import { getProfile, type DbProfile } from '@/lib/supabase-data';
import { useAuth } from './useAuth';

/**
 * Once the server confirms a paid plan, remember it in this browser for 30 days.
 * It is only a fallback for the moments when the profile has not loaded yet or a
 * read fails. Whenever the server answers, its answer wins (so cancelling still works).
 * Data access is enforced by the database either way.
 */
const GRACE_MS = 30 * 24 * 60 * 60 * 1000;
const cacheKey = (userId: string) => `midconsight.plan.v1.${userId}`;

type Plan = 'free' | 'starter' | 'pro';

function readCachedPlan(userId: string | undefined): Plan | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const { plan, at } = JSON.parse(raw) as { plan: Plan; at: number };
    if ((plan === 'starter' || plan === 'pro') && Date.now() - at < GRACE_MS) return plan;
  } catch {
    // storage unavailable, no fallback
  }
  return null;
}

function writeCachedPlan(userId: string, plan: string | undefined) {
  try {
    if (plan === 'starter' || plan === 'pro') {
      localStorage.setItem(cacheKey(userId), JSON.stringify({ plan, at: Date.now() }));
    } else {
      localStorage.removeItem(cacheKey(userId));
    }
  } catch {
    // storage unavailable, nothing to remember
  }
}

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
      if (data) writeCachedPlan(user.id, data.plan);
    } catch (err) {
      // Keep the last good profile. A single failed read must not lock paid users out.
      console.error('Could not load profile', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const plan: Plan = (profile?.plan as Plan | undefined) ?? readCachedPlan(user?.id) ?? 'free';

  return {
    profile,
    loading,
    plan,
    /** Starter or Pro: live feed, Lead Research, data import. */
    hasStarter: plan === 'starter' || plan === 'pro',
    /** Pro only: Companies, Deals, Product Catalog. */
    isPro: plan === 'pro',
    /** Any paid tier. */
    isPaid: plan === 'starter' || plan === 'pro',
    refresh,
  };
}
