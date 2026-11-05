# Platform administration architecture

## Domain boundaries

Platform roles are separate from workspace membership roles and workspace subscriptions. `OWNER`, `ADMIN`, `EDITOR` and `VIEWER` do not imply any platform capability. Agency/client links do not imply platform authority. A paid plan does not imply platform authority or cross-tenant access.

Platform operator roles are `super_admin`, `operations_admin`, `support_agent`, `billing_admin` and `auditor`, mapped to explicit capabilities in `tandem_internal.platform_admin_role_capabilities`. The migration creates role definitions and capability mappings only; it creates no operator assignment.

## Application structure

- UI: `apps/web/src/pages/PlatformAdminPages.tsx`, API wrappers in `apps/web/src/api/platformAdmin.ts`, routes in `apps/web/src/App.tsx`.
- API: `apps/api/src/platform-admin/routes.ts` authenticates the bearer token, obtains the actor exclusively from verified middleware state, checks the required capability, validates parameters and returns safe responses.
- Privileged repository: `apps/api/src/platform-admin/repository.ts` uses a server-only service key through an allowlist of named RPC operations. It is not a generic table/query proxy. Ordinary workspace support requests use the caller's publishable client and bearer token.
- Database: private role/capability assignments live in `tandem_internal`; operational case, lifecycle, settings, flags and audit records use additive migrations under `supabase/migrations`.

## Data and operations

Overview counts and tenant metadata come from current PostgreSQL/Auth records. No fake tenants, user counts, revenue, activity trend or online status is seeded. Simulated billing is clearly separate from collected revenue. The dashboard returns a source timestamp. Health marks measurements without a configured source `UNKNOWN`.

Tenant lifecycle updates lock the workspace and its state row, validate the transition, write lifecycle history and audit the operation. Suspension guards block writes to selected business tables while preserving records. Platform feature flags are an additional database write guard for covered module tables; they never grant role, plan or provider access.

## Migrations

1. `20261028110000_add_platform_operations.sql`
2. `20261028110100_harden_platform_support_consent.sql`
3. `20261028110200_fix_platform_tenant_directory_privacy.sql`
4. `20261028110300_restore_internal_wrapper_schema_usage.sql`
5. `20261028110400_limit_support_agent_tenant_access.sql`
6. `20261028110500_audit_denied_platform_authorization.sql`

These are additive. They were applied and tested only against the configured loopback Tandem Ads local Supabase instance. Hosted migration rollout remains pending and was not attempted.
