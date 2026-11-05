# Integrations architecture

Prompt 14 adds an offline planning layer to the existing React/Express/Supabase application. It does not introduce a second workspace system or connect provider APIs.

## Runtime boundary

- `/app/integrations` and `/app/tracking/*` render the Integrations & Measurement Center.
- API routes are under `/api/workspaces/:workspaceId/tracking/*` and use the caller's bearer token with the existing publishable Supabase client.
- Google/Meta OAuth start, callback, account discovery, verification, selection and unlink routes now fail closed regardless of environment configuration.
- No tracking planner route fetches a destination URL or sends a third-party request.
- The OpenAI campaign-generation route always returns an unavailable response, regardless of credentials or an injected adapter; local campaign simulation remains available.

## Storage model

Migration `20261029130000_add_offline_tracking_planner.sql` adds provider drafts, readiness responses, goals, event definitions/mappings, UTM templates, campaign tracking sidecars, implementation/privacy plans, workspace naming preferences, synthetic test runs and append-only configuration audit records. It also exposes `tracking.planning` in derived billing context for existing plan versions; subscription lifecycle/read-only checks still run on every write.

Reads are membership-scoped. Configuration writes require owner/admin membership. RLS is enforced independently of API checks. The API does not use service-role Supabase clients for user CRUD.

## Status vocabulary

- `not_configured`: no local planning record exists.
- `draft_configuration`: a planning record was saved.
- `readiness_incomplete`: local validation found missing planning fields.
- `locally_validated`: the saved planning record passed the narrow local checks.
- `PROVIDER_INTEGRATION_DISABLED`: provider transport is unavailable.

None of these states means connected, authenticated, installed or receiving events.

## Separation from analytics

Conversion goals are definitions. Synthetic tests are stored in `tracking_test_runs`. Analytics shows a separate measurement-planning snapshot for goal, mapping, campaign-association and synthetic-check counts. Existing Analytics/Reports continue to consume their own campaign and demo analytics sources; these planning counts and test runs are not appended to conversion totals.
