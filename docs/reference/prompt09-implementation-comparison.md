# Prompt 09 — implementation comparison and verification

Date: 2026-10-28

## Reference basis

REA calls and evidence IDs are listed in [prompt09-rea-research.md](./prompt09-rea-research.md). Public kAInet pages advertise cross-platform campaign work, review concepts and reporting. No private agency UI, customer data, source code or backend was observed.

## Tandem Ads implementation

- An agency is designated on an existing workspace; clients remain separate, independently owned workspaces.
- Agency-client requests are pending until the receiving workspace's owner/admin accepts. The relationship alone does not grant client-data access.
- User-scoped API queries and workspace membership checks guard client data. An agency member needs actual client-workspace membership to view or operate on client records.
- Client owners can create scoped invitations for verified agency members. Tokens are generated randomly, SHA-256 hashed in the database, single-use, and expire after seven days. The UI says “Invitation link created — not emailed.”
- Agency membership provisioned by an invitation is tracked separately. Relationship revocation removes only the tracked grant if it is still the same role; separately held client memberships are preserved.
- Agency dashboard, client directory, relationship requests/decisions, team and assignment views, tasks, collaboration notes/comments, activity, client campaign/report links, and client portal routes are integrated with existing modules.
- Internal notes are filtered by RLS and API policy; only client-visible collaboration content is returned to client portal responses.
- Existing Campaign Studio, Creative Studio, Analytics/Reports, notifications and Light/Dark/System theme are reused.
- Advertising data remains simulated. No email, ads, AI, or payment provider is contacted.

## Verification status

### IMPLEMENTED

- Additive migration `20261028090000_add_agency_client_collaboration.sql` defines agency profiles, relationships, tracked agency membership grants, assignments, workspace invitations, client tasks, collaboration comments and audit events with RLS and guarded RPCs.
- Additive migration `20261028090100_notify_agency_client_invitations.sql` adds in-app invitation notifications without exposing tokens or claiming email delivery.
- API routes and frontend pages are present for agency and client operations.
- The client portal now displays client-originated pending collaboration requests.
- Prompt 06 Storage upload hardening is present: authenticated clients do not have direct Storage object insert/delete access for creative assets; application upload validation is server-side.

### TESTED LOCALLY

- Local project `tandem-ads-local` was confirmed from `supabase/config.toml`; local DB is on the configured loopback port. The Prompt 09 migrations were applied locally without a database reset. Hosted Supabase was not modified.
- `npm test`: 76 API tests and 58 frontend tests passed.
- `npx supabase test db --local`: 238 pgTAP assertions passed across 9 files, including `supabase/tests/database/agency_client_collaboration_rls.test.sql` and the direct creative Storage upload boundary suite.
- `npm run typecheck`, `npm run lint` and `npm run build` passed.
- REA `capture_browser_scenario` opened `http://127.0.0.1:5180/` in a controlled Chromium replay and completed the initial route-load step: evidence `ev_e1b29979c01db122daced9a200c1a2b79cc22054d81679d63c69e2178907ebe2`. A second controlled replay visited `/app/agency`: evidence `ev_49eeafb6ee61dd5ab13b67e9345880eacde0626ad0630a47055f95967672ec79`. Both retained URL-level evidence only; neither captured a screenshot or tested an authenticated interaction. Read-only local checks returned HTTP 200 for the Tandem Ads page and API health endpoint.

### NOT VERIFIED / LIMITATIONS

- Authenticated browser/E2E flows remain unverified. The local Supabase environment requires email confirmation, and no isolated browser test identities were created; the REA replay verified only unauthenticated route loading. Unit, API and pgTAP tests are not presented as an authenticated browser test.
- The project has zero Git-tracked files; no files were staged, committed or pushed.
- The invitation acceptance rate limit is process-local, not a distributed rate limiter.
- Team member display uses user IDs and roles because no user-scoped profile/email listing API was added in this milestone.
- New-client invitation does not create a workspace under another person's identity. The client must create/claim its own workspace and then authorize the relationship.
- Workspace member role changes are not implemented through agency management. Client access is granted only through the constrained editor/viewer invitation path.
- Existing review permissions remain governed by Campaign Studio's current role policy; portal visibility does not elevate a viewer to reviewer.
- Hosted migrations remain pending and require a separately reviewed deployment operation.

