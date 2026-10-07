/**
 * Single source of truth for deal stages.
 * Label, probability and open/closed status all come from here.
 */

export type DealStage = 'new_lead' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';

export const STAGE_ORDER: DealStage[] = ['new_lead', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];

export const STAGES: Record<DealStage, { label: string; probability: number }> = {
  new_lead: { label: 'New Lead', probability: 10 },
  contacted: { label: 'Contacted', probability: 30 },
  qualified: { label: 'Qualified', probability: 60 },
  proposal: { label: 'Proposal', probability: 90 },
  closed_won: { label: 'Closed Won', probability: 100 },
  closed_lost: { label: 'Closed Lost', probability: 0 },
};

export function stageLabel(stage: string | null | undefined): string {
  return STAGES[stage as DealStage]?.label ?? STAGES.new_lead.label;
}

export function stageProbability(stage: DealStage): number {
  return STAGES[stage].probability;
}

export function isClosedStage(stage: string | null | undefined): boolean {
  return stage === 'closed_won' || stage === 'closed_lost';
}

/** Fields to write when a deal moves to a stage. Stage, status and probability always move together. */
export function stageUpdate(stage: DealStage): { stage: DealStage; status: 'open' | 'closed'; probability: number } {
  return {
    stage,
    status: isClosedStage(stage) ? 'closed' : 'open',
    probability: STAGES[stage].probability,
  };
}

/** Parses YYYY-MM-DD (or a full ISO string) as a LOCAL date, so there is no one-day shift. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatLocalDate(value: string | null | undefined, fallback = 'TBD'): string {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString() : fallback;
}

/** Today as YYYY-MM-DD in local time. */
export function todayISO(): string {
  const n = new Date();
  const mm = String(n.getMonth() + 1).padStart(2, '0');
  const dd = String(n.getDate()).padStart(2, '0');
  return `${n.getFullYear()}-${mm}-${dd}`;
}

/** True when a YYYY-MM-DD date is before today (local). */
export function isBeforeToday(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.slice(0, 10) < todayISO();
}

/** Prepends a dated line (YYYY-MM-DD) to existing notes, newest first. */
export function prependNote(existing: string | null | undefined, text: string): string {
  const line = `${todayISO()}: ${text.trim()}`;
  const prev = (existing || '').trim();
  return prev ? `${line}\n${prev}` : line;
}
