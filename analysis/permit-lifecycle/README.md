# Permit-to-production lifecycle analysis

Survival analysis of Oklahoma new-drill oil and gas permits (approved 2019 or later),
built from two public Oklahoma Corporation Commission files:
the Intent to Drill master and the completions base.

Full write-up: the "Scoring Analysis" tab of the MidconSight v2.0 doc.
Scoring rule v4 in `src/lib/scoring.ts` uses the parameters fitted here.

## Run order

1. `01_extract_xlsx.py` streams selected columns out of an OCC xlsx file into CSV.
2. `02_build_cohort.py` joins permits to completions on the 10-digit API and writes a per-well table.
3. `03_milestone_shares.py` computes the simple cohort shares by day.
4. `lib.py`, `part12.py`, `part3456.py`, `part7.py` run Kaplan-Meier, the cure models, Cox and sensitivity checks.
5. `figs.py` draws the figures. `mkmd.py` writes `results.md` from `results.json`.

Scripts hold absolute paths from the original run. Edit the path constants at the top of each file.

## Not stored

The OCC source files and the per-well cohort table are not in the repo. Download the files from the OCC
open data page and rebuild. Only aggregate results (`results.json`, `results.md`, `figures/`) are kept.

## Status

The statistical models were run and cross-checked by AI agents. They have not had human statistical review.
