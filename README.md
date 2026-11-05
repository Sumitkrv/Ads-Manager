# Tandem Ads

Tandem Ads is a multi-industry, multi-company advertising SaaS. Its local milestone set includes authentication, isolated business workspaces, Campaign and Creative Studios, Brand Kit and Asset Library, offline Optimization and Automation, analytics and reports, agency/client collaboration, sample billing, and platform operations. Earlier module migrations were applied to the existing local database only. The new campaign-generation-mode migration is prepared in the repository but was not applied during this work; hosted deployment remains pending.

## Prerequisites

- Node.js 24.22.1 (see `.nvmrc`)
- npm 11
- Docker Desktop running for the local Supabase stack

## Install and run

```sh
npm install
npx supabase start
npm run dev
```

`npm run dev` reads the local Supabase URL and publishable key from the running local stack, writes them to the ignored app env files without printing the key, checks that frontend and API match, and starts the shared package, API, and frontend in watch mode. Shared-package builds are watched by the API so it restarts when shared exports change. It refuses hosted or conflicting shell configuration. Local auth emails are available in Mailpit; hosted accounts are not copied into the local database, so create or confirm a local account there. No hosted database writes are performed by this workflow.

## Local URLs

- Web application: http://127.0.0.1:5180
- Public API health: http://127.0.0.1:4010/api/health
- Local Supabase Studio: http://127.0.0.1:54323
- Local confirmation/reset email inbox (Mailpit): http://127.0.0.1:54324
- Authenticated API identity: `GET /api/me`
- Workspace collection: `GET /api/workspaces`

## Architecture

- `apps/web`: React, TypeScript, Vite, Tailwind CSS, Supabase Auth, workspace switching, Campaign and Creative Studios, Brand Kit, Asset Library, Optimization Studio, Automation Studio, analytics, reports, billing, agency/client workspaces, platform operations, and Light/Dark/System theme support.
- `apps/api`: Express, Zod validation, verified bearer tokens, user-scoped Supabase access, deterministic campaign/creative/optimization simulation, optional consent-based OpenAI campaign text generation, validated private uploads, demo-only advertising publishing/metrics, billing entitlements, agency collaboration, and role-scoped platform operations.
- `packages/shared`: 16-industry catalogue, centralized workspace capabilities, campaign/creative/optimization schemas, and API contracts.
- `supabase/migrations`: additive profile, workspace, integrations, campaign, creative, upload-hardening, and optimization/automation migrations.
- `supabase/tests/database`: pgTAP ownership, role, tenant/RLS, upload-boundary, campaign, creative, and optimization isolation assertions.
- `docs/reference`: Public REA reference evidence and Prompt 05–11 implementation comparisons.

`public.workspaces.id` is the authoritative tenant scope. `public.workspace_memberships` holds the current user's role in each business. Browser selection and slug are UI details only. Normal API reads and writes use the user's access token and publishable key; PostgreSQL RLS and narrowly scoped RPCs enforce membership and role permissions. The creative image upload boundary uses a server-only service-role client restricted to a fixed private bucket and upload reservation/finalization RPCs after API image decoding. That key is never sent to the browser.

The industry catalogue includes real estate, e-commerce, healthcare, education, fitness, restaurants, hospitality, travel, automotive, beauty, professional services, agencies, home services, finance, events, and a custom category. These are workspace contexts in one product, not separate applications.

## Environment variables

- Frontend (`apps/web/.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, optional `VITE_API_BASE_URL`, and `VITE_CAMPAIGN_GENERATION_MODE` (synced from the API mode by the local setup script).
- API (`apps/api/.env`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for the validated private creative upload boundary), `APP_ENV`, `API_HOST`, `API_PORT`, `CORS_ALLOWED_ORIGINS`, `CREATIVE_EXECUTION_MODE=local`. Optional text generation uses `CAMPAIGN_GENERATION_MODE=openai`, `OPENAI_API_KEY`, and `OPENAI_CAMPAIGN_MODEL`; the default remains `simulation`.

`npm run dev` manages the local Supabase URL and publishable key in these ignored files. Do not put a hosted URL or a secret/service-role key in the local browser config. Real `.env` files are ignored by Git; never log or commit their values.

## Commands

- `npx supabase start`: start the local database, Auth, Studio, and Mailpit without resetting data
- `npm run dev`: verify local Supabase config, then start API and frontend
- `npm run dev:web` / `npm run dev:api`: verify local config, then start one server
- `npm run typecheck`: strict TypeScript checks
- `npm run lint`: ESLint checks
- `npm test`: API and web unit tests
- `npm run build`: production builds
- `npm run verify`: typecheck, lint, tests, and builds
- `supabase start` then `supabase test db`: local PostgreSQL/pgTAP tests (requires Docker and the Supabase CLI)

## Current scope

The local application implements milestones through Prompt 11 plus opt-in OpenAI campaign text generation. Campaigns are workspace-scoped and include revisions, approval history, an eight-step brief wizard, Google Search and Meta draft structures, deterministic `AI Simulation` output for all sixteen industries, and optional `AI Generated Draft` copy from a configured OpenAI model. Live generation requires an explicit per-request consent to send the full campaign brief, a recorded usage operation, local schema validation, and human review. It creates no provider campaign or spend. Local validation, review/approval, demo publishing, and separately labeled simulated metrics remain available. The advertising integration UI and OAuth/account-discovery code are retained, but the API's demo configuration disables provider OAuth and execution even when provider secrets are present.

Brand Kit and Asset Library include workspace-scoped brand settings, private asset uploads and retrieval, and a validated image upload boundary. Creative variations use deterministic offline templates. Optimization and Automation use stored, explicitly simulated analytics and human review. Analytics and reports label their data source; agency/client collaboration, sample billing/entitlements, and role-scoped platform operations are also implemented locally.

Previously implemented workspace, campaign, creative, optimization, analytics, agency, billing and platform-operations migrations were applied to the existing local database only. The new campaign-generation-mode migration remains unapplied; run it against the intended local database before enabling OpenAI generation. Hosted deployment remains pending. Do not use `supabase db push` or a hosted reset as part of local verification.

Creative uploads use the private `workspace-creative-assets` Supabase Storage bucket and workspace-scoped metadata; API uploads accept PNG, JPEG, and WebP only, decode and normalize images, and enforce size, dimensions and transactional workspace quotas. Authenticated users cannot write directly to the bucket or forge asset metadata; pgTAP regression tests cover that boundary. Persistent retrieval through an authenticated browser still needs the local E2E pass.

AI image generation, real Google Ads/Meta campaign operations, real provider performance ingestion, scheduled automation, creative-level performance attribution, payment processing, and external notifications are not implemented. Current dashboards and optimization use simulated data; no advertising spend or provider-side campaign changes occur. OpenAI campaign generation is opt-in and was not called during local implementation verification.
