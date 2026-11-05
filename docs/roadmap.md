# Prompt roadmap

The repository implements the local product milestones through Prompt 11. All Supabase migrations remain local to the configured development database; hosted deployment is a separate, pending operation.

## Completed local milestones

### Prompt 01 — Project Foundation

Create the workspaces monorepo, responsive shell, API health endpoint, shared contracts, environment examples, and verification scripts.

### Prompt 02 — Authentication and Personal Profiles

Add Supabase email/password authentication, protected routes, personal profile persistence, RLS, and verified API identity. Signup grants no company access.

### Prompt 03 — SaaS Workspace Foundation

Add workspace and membership tables, role-scoped authorization, atomic workspace creation, industry-aware onboarding, workspace selection and business settings. Do not add invitations, ads, campaigns, AI features, billing, or agency management.

### Prompt 04 — Advertising Account Connections

Preserve workspace-scoped Google Ads and Meta Ads OAuth, account discovery, verification, and account selection. Provider access is disabled in the demo configuration; live campaign operations are not part of this milestone.

### Prompt 05 — REA-Driven Campaign Studio

Add workspace-scoped drafts, revisions, Google Search and Meta draft structures, deterministic multi-industry generation simulation, local validation, review and approval, demo publishing, and separately labeled simulated analytics.

### Prompt 06 — Brand Kit and Asset Library

Add workspace-scoped brand settings, creative templates, private asset storage and retrieval, and a validated image-upload boundary.

### Prompt 07 — Optimization and Automation

Add offline recommendations and automation rules based on explicitly simulated analytics, with review and approval controls. Scheduled provider-side automation is not enabled.

### Prompt 08 — Analytics and Reports

Add workspace-scoped analytics and report building. Current results are derived from Tandem Ads simulated data, not Google Ads or Meta Ads responses.

### Prompt 09 — Agency and Client Collaboration

Add agency/client workspace relationships, invitations, role-scoped collaboration, and a client portal.

### Prompt 10 — Billing and Entitlements

Add a sample plan catalog, usage limits, entitlements, and local billing administration. Checkout and payment processing are not enabled.

### Prompt 11 — Platform Operations

Add role-scoped platform overview, tenant and user directories, lifecycle and billing oversight, health reporting, support cases and consent records, settings, and audit history. No platform operator is provisioned by default.

## Remaining product milestones

- AI campaign text generation is implemented behind explicit server configuration, per-request external-processing consent, usage metering, strict structured output, and human review. AI image generation and live AI-generated creative assets remain pending.
- Real Google Ads and Meta Ads campaign operations and performance ingestion. OAuth/account-discovery code is retained but disabled in demo mode; no live publishing, budget changes, or provider metrics are active.
- Scheduled automation and creative-level performance attribution.
- Local authenticated acceptance for persistent asset retrieval and for platform-admin controls using an approved local operator. These acceptance gaps do not authorize promoting a user or changing hosted data.

## Deployment boundary

Previously implemented additive migrations have been applied only to the existing local Tandem Ads database. The new campaign-generation-mode migration is prepared but unapplied. Hosted migration rollout, hosted data changes, external ad-account access, and provider-side campaign operations require their own review and approval. Do not use `supabase db push` or a hosted reset as part of local verification.
