-- Map v2.0: enriches ITD permits with real post-drilling well data from
-- OCC's live RBDMS_WELLS feed (see docs/map-v2-data-sourcing.md). Adds
-- the fields that make the lifecycle-stage symbol system possible (see
-- docs/map-v2-ui-design.md) — nothing here changes existing behavior for
-- permits that haven't been matched yet (all columns nullable).

ALTER TABLE public.permits
  ADD COLUMN rbdms_well_status TEXT,
  ADD COLUMN rbdms_legal_description TEXT,
  ADD COLUMN rbdms_well_records_url TEXT,
  ADD COLUMN rbdms_enriched_at TIMESTAMP WITH TIME ZONE;

-- Speeds up the enrichment function's "find permits needing a lookup" query.
CREATE INDEX idx_permits_rbdms_enriched_at ON public.permits (rbdms_enriched_at);
