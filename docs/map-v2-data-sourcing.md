# Map v2.0 — What We Can Actually Pull

Grounded in the real, verified schema of Oklahoma's live data sources — not
assumptions. Two sources checked directly against their actual endpoints.

---

## Source 1: OCC RBDMS_WELLS (confirmed live, free, real-time)

`https://gis.occ.ok.gov/server/rest/services/Hosted/RBDMS_WELLS/FeatureServer/2`

This is a live ArcGIS REST API — queryable on demand (JSON/GeoJSON), not a
weekly bulk file like the ITD import. Verified field list, pulled directly
from the service:

| Field | What it gives us |
|---|---|
| `api` | Ties directly to the permits we already have |
| `sh_lat`, `sh_lon` | **Real surface-hole coordinates** — not a county centroid fallback. This alone fixes the "dashed border / approximate location" problem for any well that's progressed past the ITD stage. |
| `wellstatus` | **This is the real well-type taxonomy** — 14 genuine categories: `DRY`, `GAS`, `GAS_STORAGE`, `OIL`, `OIL/GAS`, `ORPHAN`, `PLUGGED`, `STATE_FUNDS_PLUGGING`, `TEMPORARILY_ABANDONED`, `TERMINATED`, `UIC`, `WATER_INJECTION`, `WATER_SUPPLY`, `OTHER`. Unlike the ITD file's near-universal "OG," this actually varies, because it reflects a well's *outcome*, not its *intent*. |
| `county`, `section`, `township`, `range`, `qtr1`–`qtr4`, `pm` | Full legal description (PLSS) — section/township/range plus quarter-calls. Land professionals think in these terms, not lat/lon. |
| `footage_ew`, `ew`, `footage_ns`, `ns` | Exact footage from section lines — survey-grade precision, the real data behind what our new TRS grid overlay visualizes. |
| `well_records_docs` | Reference to scanned well-file documents — a direct link to the actual filed paperwork for that well. |
| `well_name`, `well_num`, `operator` | Same as what we already have, useful for cross-matching. |

**What this actually enables**: cross-reference every permit's API number
against this layer. A permit that's just an ITD filing today might show up
here later as `DRY`, `PLUGGED`, or `OIL`/`GAS`/`OIL/GAS` once it's actually
drilled and completed — turning a static permit list into a real lifecycle
tracker: *filed → drilled → completed/dry → (eventually) plugged*. That's
the "as much information as possible on new/completed wells" you're asking
for, and it's free and live today.

---

## Source 2: Production volumes — real gap, worth being honest about

Production data is **not** an OCC dataset at all — Oklahoma's official
recordkeeper for oil/gas volumes is the **Oklahoma Tax Commission (OTC)**,
via monthly Gross Production Tax filings (Form 341), organized by
Production Unit Number (PUN, not directly the API number).

I could not find a clean public API or bulk-download equivalent to OCC's
GIS service for this. What I did find, worth knowing before we plan around
it:
- Reported monthly by the **first purchaser**, not the well operator —
  it's downstream of the well itself.
- Third-party data vendors (Oseberg, and implicitly others like Enverus)
  explicitly advertise correcting OTC data for **~5-month reporting lag**
  and **duplicate/entry errors** — meaning the raw feed, even if we found
  a public access point, needs real cleanup work before it's presentable.

**This is a genuine build-vs-buy decision**, not a quick add:
- **Buy**: a commercial data vendor (Oseberg, Enverus, Drillinginfo) gets
  you clean production data fast, at real monthly cost — worth pricing out
  if production data becomes a paid-tier differentiator you want soon.
- **Build**: dig further into whether OTC has any public query interface
  for PUN-level production (I haven't fully exhausted this search) and
  build our own cleaning pipeline — cheaper long-term, slower to ship, and
  we'd be re-solving a problem vendors already sell as their core product.

I'd treat this as a separate, later decision rather than bundling it into
the v2.0 map redesign — the RBDMS lifecycle data alone is a substantial,
free, immediately-buildable upgrade on its own.

---

## Proposed v2.0 shape

1. **Enrichment pass**: for every permit with a matching API in
   RBDMS_WELLS, pull real coordinates, real well status, and full legal
   description. Permits without a match are still-pending ITD filings —
   shown as-is.
2. **Well detail panel** (click a pin): show the full lifecycle —
   *Filed [date] → Current status: [real wellstatus] → Sec/Twp/Rng →
   [link to scanned well file]* — instead of today's single static point.
3. **Well type legend becomes meaningful again**, built from `wellstatus`
   values on enriched wells, not the ITD file's `OG` catch-all — this is
   the direct fix for the well-type problem we just agreed doesn't belong
   at the permit stage.
4. **Production data**: deferred as its own decision (see above), not
   part of this pass.

## Open questions for you

- Does a per-permit RBDMS lookup happen live (on click, one API call) or
  as a batch enrichment during the weekly auto-import (pre-computed,
  faster to display, staler by up to a week)? I'd lean batch, given the
  Monday cron job already exists and this is genuinely the same pattern.
- Is production data a near-term priority worth pricing out a vendor for,
  or a later addition once the core lifecycle tracking is live?
