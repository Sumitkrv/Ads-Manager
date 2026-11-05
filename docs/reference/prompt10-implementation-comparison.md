# Prompt 10 implementation comparison

## Reference boundary

Public kAInet pricing research is recorded in [prompt10-rea-research.md](./prompt10-rea-research.md). REA observed a public pricing page with tier comparisons, prices and usage/feature descriptions. Tandem Ads uses its own editable demo catalog and does not reuse kAInet's prices, wording, branding or limits.

The local visual check used REA controlled Chromium replay against `http://127.0.0.1:5180/pricing`:

- Evidence `ev_433878f7c97d17254c8c0e95f102253494cf59e01a4c9aef6a6327e9674c9f0a` captured URL, screenshot, DOM and accessibility tree.
- The capture showed five sample plans (Free Trial, Starter, Growth, Agency, Enterprise), monthly/annual selection, workspace capacity summaries, demo-pricing disclosures, and a statement that a plan choice creates a request rather than a checkout.
- Capture was unauthenticated and establishes rendered presentation only. It does not prove authenticated plan changes, database persistence, or quota enforcement through a browser workflow.

## Tandem Ads implementation

The implementation adds a workspace-scoped commercial domain backed by additive PostgreSQL migrations. The server enforces `BILLING_MODE=simulation`; user requests cannot select a live mode. Public plan selection creates a persisted request. Paid demo entitlements can only be activated by the locally allowlisted simulation operator under the development-only guard. A workspace owner cannot self-grant a paid plan.

Plan catalog versions and entitlements are database-authoritative. Workspace roles remain independent from plan capabilities. Quota triggers guard the metered database writes for campaigns, creatives, asset storage, automation rules, saved reports/exports, seats and agency client relationships. Usage consumption is idempotent. Legacy workspaces receive a finite transition policy; trials expire without deleting existing records.

The billing UI includes public pricing, monthly/annual sample price presentation, workspace billing overview, usage, history, plan requests, cancellation/reactivation requests, demo invoice PDF, and restricted plan/subscription administration. Demo documents are labeled as not tax invoices and no payment was processed. No card or bank credentials are collected.

## Verification

- **TESTED LOCALLY:** `npm run verify` passed typecheck, lint, 80 API tests, 58 frontend tests and the production build.
- **TESTED LOCALLY:** `npx supabase test db --local` passed 256 pgTAP assertions across 10 files.
- **TESTED LOCALLY:** additive migrations were applied to the configured loopback Supabase local instance; hosted Supabase was not modified.
- **SIMULATED:** requests, activation, cancellation, renewal, invoices and subscription lifecycle events are local simulation records. No payment provider is instantiated.
- **BLOCKED:** authenticated browser acceptance was not completed. The app's local dev startup found port 5180 already occupied and its coordinated startup stopped its own API process. The existing listeners were left untouched; no test user was created against hosted Supabase. REA's unauthenticated pricing render is visual evidence, not end-to-end acceptance.
- **NOT IMPLEMENTED:** Stripe, Razorpay and any other payment adapter; real charges; payment webhooks; tax-compliant invoices; external billing delivery.

## Limitations

- Hosted migration deployment remains pending and was not attempted.
- The demo catalog's prices and quotas are editable examples, not approved commercial terms.
- Browser-authenticated subscription persistence, privileged demo activation and invoice download remain unverified in an authenticated browser session.
- Git reports zero tracked files and the working tree contains untracked project files. No files were staged, committed or pushed.
- Future provider support requires separately reviewed provider-signed webhook verification, reconciliation, refunds, tax treatment and payment failure handling.

