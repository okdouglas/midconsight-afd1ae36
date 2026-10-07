/**
 * Companies built from the shared permit feed are previews with no database row.
 * Save one before any write that needs a real company_id.
 */
import { promoteCompanyPreview } from '@/lib/supabase-data';
import { type Company } from '@/hooks/useSupabaseData';

export async function ensureRealCompany(company: Company): Promise<{ id: string; promoted: boolean }> {
  if (!company.isPreview) return { id: company.id, promoted: false };
  const real = await promoteCompanyPreview({
    name: company.name,
    operatorNumber: company.operatorNumber,
    permitCount: company.permitCount,
    totalValue: company.totalValue,
    score: company.score,
    lastPermitDate: company.lastPermitDate,
    city: company.city,
    state: company.state,
  });
  return { id: real.id, promoted: true };
}
