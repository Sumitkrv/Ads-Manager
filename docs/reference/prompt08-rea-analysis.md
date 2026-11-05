# Prompt 08 — REA reference analysis

Research date: 2026-10-28

## Actual REA calls

REA 6.8.0 was invoked against public pages using `capture_browser_scenario` with a Chrome launch target:

1. `https://www.kainet.tech/` — wait for the page to settle and capture the resulting URL. Evidence: `ev_027cc587017331a91954b9f2d7573355d892775293a65340710e57a3194f1876`.
2. `https://www.kainet.tech/features` — wait for the page to settle and capture URL, screenshot, DOM and accessibility tree. Evidence: `ev_e3c54bae91a47d5d92d82445f005b31ce2b6fa964525b8e7e914b7e038c425fd`. The screenshot artifact was associated with SHA-256 `e39bb4f55d36f74f35092b931d2f0d4b88df3fa9bfe7391c07f8ccafb0fb5681`.

These calls inspected public marketing content only. No authenticated customer workspace or private implementation was inspected.

## Findings by evidence class

### OBSERVED

- The features page presents advertising performance and multi-platform reporting as part of its public product story.
- Its visible/accessibility content uses a performance-overview concept and a spend-by-platform concept.
- Google and Meta are named as advertising platforms in the public product presentation.

### ADVERTISED

- The public marketing content describes unified visibility into spend, impressions, clicks, CTR and CPC.
- It advertises reviewing campaign performance across Google and Meta.
- The page presents spend by platform and a performance overview as reporting concepts.

These are marketing claims, not proof of exact private dashboard behavior or data architecture.

### INFERRED

- A useful analytics workspace should put period controls and platform context near the top, then connect summary measures to campaign-level detail.
- Users benefit from clear provenance when combining data from multiple advertising platforms.

These are product-design inferences based on the public page, not statements about kAInet's private product.

### UNAVAILABLE

- A functional customer analytics dashboard was not accessible through the public pages captured.
- The private chart interactions, metric definitions, attribution rules, filters, export behavior, data model, and optimization algorithm were not observable.
- No provider account or live reporting endpoint was accessed.

## Original Tandem Ads decisions

- Build a workspace-scoped reporting experience using Tandem Ads components and code.
- Label the available source `DEMO_SIMULATION` and display “Simulated Data — Not Actual Ad Performance”.
- Recompute CTR and other ratios from additive counts, keep spend-derived metrics grouped by currency, and show unavailable ROAS when revenue inputs are absent.
- Use filters for date range, platform, campaign, objective, status, industry and currency; keep URL filter state shareable within the signed-in session.
- Persist saved views, report definitions, revisions and export audit metadata through authenticated, role-checked PostgreSQL operations.
- Keep creative-level performance unavailable unless creative-attributed observations are actually stored.
- Treat the public reference as workflow inspiration only. No competitor code, graphics or branded assets were copied.
