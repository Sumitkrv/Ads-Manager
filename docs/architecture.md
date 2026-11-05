# Application architecture

## Runtime boundaries

- `apps/web` owns presentation, Supabase Auth session handling, route guards, workspace selection, onboarding/settings, and the Campaign Studio wizard/editor/review/preview/report screens.
- `apps/api` owns HTTP configuration, access-token verification, workspace and campaign validation/authorization, user-scoped PostgreSQL operations, deterministic campaign simulation, and demo-only publishing/reporting.
- `packages/shared` owns the 16-industry catalogue, centralized workspace capabilities, campaign validation schemas, and API contracts.
- Supabase Auth owns password handling, confirmation, recovery, and sessions. PostgreSQL owns user profiles, workspace membership, tenant boundaries, constraints, and RLS.
- The API validates bearer tokens with `auth.getUser(token)`. Workspace queries are made with a per-request Supabase client forwarding that user's access token and the publishable key. No service-role key or bypass client is used.

## Tenant model

`auth.users` identifies people. `public.profiles` stores personal profile fields only. A person can own or join multiple `public.workspaces`; each workspace can have multiple `public.workspace_memberships`. A workspace UUID is the authoritative tenant scope. Names, slugs, email domains, profile metadata, and local browser storage never authorize access.

Every business table includes a non-null `workspace_id`, RLS that verifies membership and capability, and tenant-consistent foreign keys. The browser's selected workspace is validated against the authenticated user's API-returned membership list and is never sent as proof of authority. RLS and API authorization both re-check access.

Campaign records, revisions, review decisions, activity, demo publishing attempts, and demo analytics each carry `workspace_id`. A workspace-scoped RLS read policy and role-checked RPCs protect writes. The API uses the user's Supabase access token and never bypasses these rules with the service-role key. Prompt 05's campaign migration depends on the Prompt 03 workspace migration.

The public workspace RPCs keep their API contracts as `SECURITY INVOKER` wrappers. Their implementations live in the non-exposed `tandem_internal` schema as narrowly granted `SECURITY DEFINER` functions with a fixed empty search path. `public.create_workspace` atomically creates the business record and creator's owner membership. It derives the user from `auth.uid()`, not request data, validates inputs, and only returns an idempotent retry while the original owner membership remains active. `public.update_workspace_settings` checks owner/admin membership and validates the complete business settings before persisting. Direct table writes to tenant data are not granted to application roles. The `tandem_internal` schema must remain excluded from Supabase Data API Exposed schemas.

The membership helper is in the non-exposed `tandem_internal` schema. Its security-definer function uses a fixed empty search path and only answers role questions for `auth.uid()`. Workspace and membership tables have RLS; membership writes remain unavailable until secure invite/role workflows are separately designed.

## Industry foundation

The shared catalogue assigns stable keys to 16 business categories and an `other` category with a custom label. Campaign simulation selects industry-specific, rule-based messaging guidance and regulated-industry warnings. It does not call an AI model or represent generated copy as provider-verified.

## Module boundaries for later phases

1. Business identity and industry configuration
2. Workspace-scoped campaign drafts, revision history, review, and approval
3. Local demo publishing and simulated reporting
4. Persistent brand/creative asset storage
5. Separately approved Google Ads and Meta Ads account integrations
6. Live campaign execution and reporting only after explicit provider integration work
7. Invitations, controlled memberships, and ownership transfer
8. Subscriptions and usage limits
9. Agency/client workspace relationships

No live ad provider, AI, or image-generation request is made by Prompt 05. The Prompt 03 and Prompt 05 migrations remain local files until separately reviewed and explicitly deployed. Every future feature must define its workspace scope and role capabilities before data access is added.
