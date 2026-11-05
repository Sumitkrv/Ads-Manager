# Prompt 12 — Implementation comparison and verification

Date: 2026-10-29

## Reference evidence

REA inspected the public kAInet homepage and Features page. The actual capture calls, evidence references, public observations, advertised claims, design inferences and unavailable private behavior are recorded in [Prompt 12 REA research](prompt12-rea-research.md). The public pages present a staged story around setting direction, building a campaign and reviewing before launch. The captures did not authenticate or operate the private product.

## Tandem Ads decisions and implementation

| Area | Public reference evidence | Tandem Ads implementation |
| --- | --- | --- |
| Guided setup | Public pages describe a short campaign path. | The existing workspace onboarding route now offers independent business, agency and invitation paths, the current sixteen-industry catalogue, business details, planning preferences, workspace review, Brand Kit and demo-mode acknowledgement. |
| Progress | Public pages advertise campaign review and visibility. | User drafts and workspace setup progress persist through authenticated APIs. Activation checklist items are derived from saved workspace, profile, Brand Kit, campaign, creative, review, demo-publish and analytics records. The only client-recorded activation acknowledgements are demo-mode review and report view. |
| Campaign preparation | Public pages advertise automated campaign building. | The onboarding CTA opens the existing Campaign Studio with saved business context and forces its offline rule-based simulation path. Existing review permissions and demo publishing continue to apply. |
| Creative work | Public pages advertise creative generation and testing. | First creative actions route to the existing Creative Studio and Brand Kit APIs. Logo uploads use existing private workspace asset storage; typography-based creatives remain available without an image. |
| Tour and help | Private tour behavior was unavailable. | A central role-aware tour registry, semantic targets, skip/restart/progress persistence, keyboard controls and local help content are available. The platform-operator tour uses a separate user-scoped record, requires a server-verified platform capability, and includes only authorized console areas. |
| Agency setup | Public pages advertise agency workflows; private behavior was unavailable. | Existing agency and invitation records feed conditional agency activation items. Invitation copy retains the existing “created — not emailed” disclosure. |
| Reporting and plans | Public pages advertise unified reporting. | Existing saved demo analytics and report views drive activation milestones. Getting Started reads the existing subscription/usage summary and labels billing and advertising behavior as simulated. |

These are original Tandem Ads screens and use Tandem Ads permissions and data structures. The implementation does not reproduce kAInet page layouts or claim knowledge of its private workflows.

## Implemented surfaces

- Additive migration: `supabase/migrations/20261029100000_add_onboarding_activation.sql`.
- Additive platform tour migration: `supabase/migrations/20261029110000_add_platform_tour_progress.sql`; authenticated workspace users cannot query or write this platform-scoped record directly.
- RLS tests: `supabase/tests/database/onboarding_activation_rls.test.sql`.
- Shared schemas and 16-industry guidance: `packages/shared/src/onboarding.ts`.
- Authenticated onboarding, tour, activation and Getting Started API: `apps/api/src/onboarding/routes.ts`.
- Seven-step setup experience: `apps/web/src/pages/OnboardingPage.tsx`.
- Getting Started dashboard and local help: `apps/web/src/pages/GettingStartedPage.tsx`.
- Central tour registry and accessible overlay: `apps/web/src/onboarding/tours.ts`, `apps/web/src/components/ProductTour.tsx`.
- Platform console links and tour steps now follow returned platform capabilities; restricted routes do not issue their data request.
- Platform console access, progress and loaded records are keyed to the authenticated user so a session switch does not reuse another operator's state.
- Campaign onboarding query behavior: existing Campaign Studio, forced onto deterministic offline simulation for the onboarding path.
- Existing analytics route now records a report-view milestone only when saved demo analytics exist.

Activation progress cannot be set by posting arbitrary frontend completion flags. Workspace completion timestamps are excluded from authenticated column grants and are set only by a database trigger after the saved business profile, Brand Kit, campaign, creative, review, demo publication, demo analytics and report-view requirements are present. Agency, client and workspace permissions continue to use existing authorization.

## Verification results

**TESTED LOCALLY** with installed Node `v24.22.1`:

- Follow-up `npm run typecheck`: passed.
- Follow-up `npm run lint`: passed.
- Follow-up web tests: **68/68** passed.
- Follow-up `npm run build`: passed for shared, API and web workspaces.
- Network-free platform tour route tests: **2/2** passed by dispatching requests directly through the Express router with a mocked repository. These verify capability denial, actor-derived ownership, resume and invalid input; they do not exercise Supabase or an HTTP listener.
- Full API suite: **38 passed, 60 blocked** because the sandbox denied route-test listeners with `listen EPERM` on `127.0.0.1`; those 60 tests failed before their endpoint assertions ran.
- The interactive shell resolved Node `v20.20.2` by default, although `.nvmrc` pins `24.22.1`. Vitest then failed before test assertions while loading the installed `undici@8` zstd decompressor. Re-running web tests with the pinned Node `24.22.1` passed **68/68**; no dependency changes were needed.
- Earlier, before this focused platform-tour follow-up, the suite passed API **95/95** and web **66/66**. That earlier result does not cover the new platform-tour endpoints.
- Repository files are untracked in the current Git state; no files were staged or committed.

The added API tests cover unauthenticated access, malformed workspace IDs, restricted activation event keys and route/body tour mismatches. Frontend unit tests cover onboarding schemas and industry guidance, tour roles, tour skip/keyboard behavior and missing-target recovery. These are not authenticated browser end-to-end tests.

## Environment safety gate and blocked checks

The default environment files do not point to the same Supabase instance:

- `apps/web/.env.local` points to `http://127.0.0.1:54321`.
- `apps/api/.env` points to hosted project `https://cmaxbauxzgvyikheqiyz.supabase.co` (reference `cmaxbauxzgvyikheqiyz`).

A separate ignored `apps/api/.env.local` override was created with the local URL and the matching frontend publishable key only. `DOTENV_CONFIG_PATH=apps/api/.env.local` successfully loaded an API config whose URL and publishable key match the frontend; the hosted `apps/api/.env` was not changed, and the override contains no service-role key. When the local stack is available, the API workspace can load this file with `DOTENV_CONFIG_PATH=.env.local npm run dev --workspace @ai-ads/api` (the workspace script runs with `apps/api` as its working directory). `apps/web/vite.config.ts` proxies `/api` to `127.0.0.1:4010`, with the frontend on `127.0.0.1:5180`.

The local API, web port `5180`, Supabase API `54321` and database were not reachable during the audit. Starting the isolated web-only Vite script also failed with `listen EPERM` on `127.0.0.1:5180`. Node listeners were present on `5173` and `5000`; the `5173` command line identified the Relay frontend, and both processes were left untouched. The `5000` listener was a Node `src/server.js` process whose repository could not be confirmed. The correct Tandem Ads process could not be confirmed. No local test users or fixtures were provisioned. No migration was executed, no database reset or hosted write was attempted, and no Auth admin operation was made.

Therefore these checks are **BLOCKED** pending a verified local-only runtime configuration:

- Authenticated local browser onboarding, campaign, creative, review, demo-publish, reporting, tour, workspace-switch and logout scenarios.
- The new platform-tour database migration, RLS privileges and authenticated routes; the local DB is unavailable, and API route tests cannot bind loopback sockets in this sandbox.
- The reported workspace-list 401 in an actual browser. Source inspection shows the frontend sends its Supabase bearer token, the workspace provider waits for an authenticated session, refreshes once on 401 and does not issue a workspace request without a session. The current local frontend and API environment mismatch is a likely cause of an invalid-token 401, but runtime reproduction was not possible.
- `npx supabase test db --local`, migration application, pgTAP execution, database-backed tenant isolation and local Auth fixture provisioning.
- REA inspection of the local Tandem Ads screens and local responsive/light/dark appearance. Public-reference REA captures ran; the local browser target was unavailable.

## Simulation disclosures

Campaign copy generation in the onboarding flow is deterministic offline simulation. Campaign review and publishing remain internal Tandem Ads demo states; nothing is published to Google or Meta, and no advertising account, budget or spend is changed. Analytics are simulated from saved demo data. Billing remains the existing subscription simulation and does not confirm payment. Invitations are not emailed. No third-party activation tracking or external advertising, generative AI, messaging or payment request was made by this work.

## Deployment

No hosted deployment, hosted migration, production credential change or external service write was performed. Database and authenticated-browser acceptance remain unverified, so this milestone is not represented as production-ready.
