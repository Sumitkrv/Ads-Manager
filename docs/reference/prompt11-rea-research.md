# Prompt 11 — Public reference research

Research date: 2026-10-29. REA 6.8.0 was used with its controlled Chromium browser provider. Only public kAInet marketing pages and the local Tandem Ads sign-in page were opened. No authenticated kAInet content was accessed.

## Actual REA calls

| Call | Target | Evidence | What it establishes |
| --- | --- | --- | --- |
| `capture_browser_scenario` | `https://www.kainet.tech/`, 1280×720, public page, accessibility capture | `ev_73126385ef82a063e3f69f6f370e603ae5265fc02a188f6bdec3d9a116471f9a` | The public navigation includes Features, Pricing, Compare and Log in. The rendered home page presents campaign workflow messaging, marketing-team positioning, a sample-data dashboard, spend-over-time controls, spend-by-platform content and public pricing content. |
| `capture_browser_scenario` | `https://www.kainet.tech/features`, public page, accessibility capture | `ev_f3cb16ea5536231848497af171ac81bf580b03efbb3296e28e372cabeae8b55c` | The public feature page describes campaign structure, build acceleration, creative testing, human approval, unified performance visibility and AI creative claims. It also positions the product for agencies. |
| `capture_browser_scenario` | `http://127.0.0.1:5181/login`, controlled local Chromium | `ev_e2df25f53598425d67792f77d0b43fc63da11de5b2a3d4793af07651e19478e0` | The local account-access page rendered its email/password form, appearance control and account-access copy. This is local UI evidence, not evidence about kAInet. |

REA used its owned headless Chromium profile and terminated it after the scenario. The public captures retained the accessibility tree and final URL; local capture retained the sign-in screenshot and rendered page evidence. These captures do not establish backend behavior of the reference product.

Previous public pricing evidence is also reused from [Prompt 10 REA research](prompt10-rea-research.md): public pricing navigation and page captures `ev_98c06a0b5754a9bcd3feeef71e84127b2f0b1c0921ab34a489778d139ba5b6cd`, `ev_e8575503f0e5d717d285123e3784ed79a74c79c1219bdde4c0d23fd61c94f1a8`, and `ev_a1b09bb2b95bc19bb0cd1ee8f8b350b9a095013977ab482d5cfcf0ea5c9aefff`.

## Findings by evidence class

### OBSERVED

- The public homepage exposes product, pricing and comparison navigation and a login entry point.
- The public features page groups claims into product capabilities and explicitly describes a human review step before campaign launch.
- The homepage renders a sample-data dashboard concept with performance metrics, a time-series chart and spend-by-platform visualization.
- The features page describes agency use and unified campaign-performance visibility.

### ADVERTISED

- kAInet markets campaign creation, optimization, Google/Meta workflows, AI-created creative, human approval and consolidated performance reporting.
- Public marketing copy describes multi-client campaign work for agencies. These are marketing claims and do not prove private tenant or admin behavior.

### INFERRED

- A platform operations experience benefits from a separate navigation hierarchy, role-scoped operational summaries, clear tenant context and explicit audit history.
- Tenant support access should be consent-based and default to no customer-content access.
- These are Tandem Ads product/security decisions, not recovered kAInet implementation details.

### UNAVAILABLE

- No public page exposed kAInet's private platform-admin console, internal tenant directory, support case system, authorization model, operational health probes, database schema, or security audit implementation.
- No private dashboard, customer account, source code, or customer data was inspected.

## Tandem Ads design decisions

- The control center is an original Tandem Ads operations surface, visually consistent with the existing graphite/electric-blue theme and separate from workspace billing administration.
- Platform authority is independent of workspace ownership, agency ownership, plan purchases and editable profile data.
- Administrative summaries expose operational metadata and bounded aggregates. They do not provide a general tenant-content browser or an impersonation feature.
- Support case access and a scoped consent request are recorded, but consent does not currently grant a support agent arbitrary campaign, creative, report or asset reads.
- Health reports measured API/database/auth facts and marks unmeasured Storage, worker and migration sources `UNKNOWN`.
