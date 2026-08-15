# Map v2.0 — Symbol System & UI Design

**Status: design agreed, not yet implemented.** Companion to
`docs/map-v2-data-sourcing.md` (the data-availability research). This doc
captures the actual UI decisions for when we build it.

---

## Core decision: split "stage" from "product type"

The old well-type legend (Gas/Injection/Disposal/Oil) failed because it
tried to answer two different questions with one taxonomy:
- **What stage of life is this well in?** (filed → drilled → producing →
  dry/plugged/orphaned)
- **What does it produce, if it's active?** (oil, gas, injection, water)

RBDMS's 14 `wellstatus` values are really these two axes tangled together.
v2.0 separates them: **lifecycle stage drives marker color** (always
visible, the primary signal), **product type becomes a secondary filter
facet** (only meaningful for active wells).

## Lifecycle stage — primary marker color

| Stage | Maps from | Color |
|---|---|---|
| Permitted | ITD only, no RBDMS match yet | Neutral gray |
| Active producer | `OIL`, `GAS`, `OIL/GAS`, `GAS_STORAGE` | Green |
| Injection / water | `WATER_INJECTION`, `UIC`, `WATER_SUPPLY` | Blue |
| Dry hole | `DRY` | Red |
| Temporarily abandoned | `TEMPORARILY_ABANDONED` | Amber |
| Plugged / terminated | `PLUGGED`, `TERMINATED`, `STATE_FUNDS_PLUGGING` | Dark gray |
| Orphan | `ORPHAN` | Coral — kept distinct from Dry/red deliberately, since orphan status carries real regulatory/liability weight for a land professional, not just "didn't produce" |

`OTHER` and any unmatched values fall back to the same self-diagnosing
"Unrecognized values: ..." treatment already built for the ITD well-type
fix — never silently dropped.

## Two more facets — kept separate from color, not stacked into it

1. **Border style** (already built, keep as-is): solid = precise
   coordinates, dashed = county-centroid approximation.
2. **Fill** (new): solid = matched against RBDMS and enriched, hollow =
   ITD-only, not yet resolved. This is arguably the most useful addition —
   it tells you how much is actually known about a pin before you click it.

Three independent visual channels (color, border, fill), each answering a
different question. Deliberately not a fourth — more than three starts
reading as noise rather than signal.

## Well detail panel (on marker click)

Replaces today's minimal popup. Fields, by source:

**From ITD:**
- Filed date
- API, well name/number, operator
- Formation, total depth

**From RBDMS (when matched):**
- Current status (real lifecycle stage, with last-updated date)
- Full legal description: Section-Township-Range + quarter calls
- Link to scanned well-file documents (`well_records_docs`)

**Combined:** a mini-timeline — *Filed [date] → Current status: [stage],
as of [RBDMS update date]* — the lifecycle-tracking view that's the actual
point of this whole redesign.

## Filter panel changes

"Well Status" splits into two facets, both still data-driven with live
counts (same pattern as the current status-filter fix — never a hardcoded
guess):
- **Stage** filter (the 7 categories above)
- **Product type** filter (oil / gas / injection / water — only populated
  for wells with an active-producer or injection stage)

## Explicitly deferred, not in this pass

- **Production volumes** — separate project, OTC data has real lag/quality
  issues, needs its own build-vs-buy decision (see
  `map-v2-data-sourcing.md`).
- **TRS grid ↔ well selection interaction** — clicking a well could
  highlight its specific section on the Township/Range/Section overlay.
  Nice-to-have, natural next step once the legal-description data is
  flowing, but not required for the core redesign.

## Open implementation question (from prior discussion, still open)

Does the RBDMS enrichment lookup happen live (one API call per marker
click) or batched into the existing Monday auto-import (pre-computed,
faster to render, up to a week stale)? Leaning batch, since the cron
infrastructure already exists and this is the same pattern — but not yet
decided.
