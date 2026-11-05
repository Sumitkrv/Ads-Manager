# Prompt 08 — implementation comparison and verification

Date: 2026-10-28

## Reference basis

REA public-page capture evidence and its OBSERVED / ADVERTISED / INFERRED / UNAVAILABLE classifications are recorded in [prompt08-rea-analysis.md](./prompt08-rea-analysis.md). The captured material advertised a unified view of spend, impressions, clicks, CTR and CPC, plus performance-overview and spend-by-platform concepts. It did not expose a private customer dashboard or its backend.

## Tandem Ads implementation

- Workspace-scoped Analytics overview with date/platform/campaign/objective/status/industry/currency filters, period comparison, metrics and campaign exploration.
- Platform and creative views. Creative attribution intentionally reports insufficient data because the current schema stores campaign-level demo snapshots only.
- Saved filter views, structured report templates, report creation/editing/duplication/archive, revisions and export history.
- CSV and locally generated PDF exports are built from stored demo analytics and include source disclosures.
- Server-side aggregations recompute ratios from raw counts and do not combine currencies for spend-derived metrics.
- No Google Ads, Meta Marketing, external AI or external report-generation API is called.

## Verification status

### TESTED LOCALLY

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 67 API tests and 56 frontend tests.
- `npm run build` passed.
- `npx supabase test db --local` passed: 216 pgTAP assertions across 8 files.
- Additive migration `20261028080000_add_analytics_reporting.sql` was applied to the explicitly local Supabase instance without resetting it. The migration adds workspace-scoped saved views, report definitions/revisions, export audit metadata, RLS and guarded RPCs.
- Export tests generated and inspected a valid local PDF, including the report title and simulated-data disclosure. CSV tests cover escaping and spreadsheet-formula injection mitigation.

### BLOCKED / NOT VERIFIED

- Authenticated browser/E2E verification was not completed. A read-only check of `http://127.0.0.1:5180` returned connection refused (`frontend=000`); no local Tandem Ads web server was running. The existing frontend environment is known to target hosted Supabase, so it was not started against that configuration. Unit/API tests are not presented as browser verification.
- No live Google Ads, Meta Ads, or AI provider verification was performed or is part of this milestone.

### Deployment

- Hosted Supabase was not contacted or modified. No hosted migrations were applied.
- The repository currently has zero Git-tracked files; files are untracked. No commit or push was made. Establish a reviewed baseline and check `.gitignore`/secrets before versioning.
