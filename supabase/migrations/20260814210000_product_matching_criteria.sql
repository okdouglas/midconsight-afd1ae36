-- Turns the product catalog from a static price list into a matching
-- ruleset — the missing link between "what does this operator drill"
-- (permits.formationName/wellType/totalDepth, already captured) and
-- "what do I sell" (selling_options).
--
-- Nullable/empty on every field: a product with no criteria set matches
-- nothing specific (shown as "general" fit) rather than matching
-- everything by accident.

ALTER TABLE public.selling_options
  ADD COLUMN target_formations TEXT[] DEFAULT '{}',
  ADD COLUMN applicable_well_types TEXT[] DEFAULT '{}',
  ADD COLUMN min_depth NUMERIC,
  ADD COLUMN max_depth NUMERIC;
