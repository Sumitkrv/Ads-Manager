# Multi-tenant workspace migration

## Status and safety gate

The additive migration is `supabase/migrations/20261027010000_create_multi_tenant_workspaces.sql`. It follows the existing `20261027000000_create_personal_profiles.sql` migration. It has **not** been applied to the hosted Supabase project. Review the SQL and verify the project reference before applying it. Do not reset the database or run `supabase db reset` against a hosted project.

This migration does not alter `public.profiles`, `auth.users`, existing user credentials, or existing profile rows. It creates no default workspace. Existing authenticated users without memberships will be directed to onboarding and can create a workspace when the migration is deployed.

## Tables and relationships

### `public.workspaces`

- UUID primary key used as the authoritative business tenant scope.
- Business name and unique, lowercase URL slug.
- Stable industry key, optional custom label for `other`, optional website and country code, time zone, and reserved optional logo URL.
- `created_by` references `auth.users(id)` with `ON DELETE RESTRICT` so deleting an auth identity cannot silently erase or orphan its business.
- `creation_request_id` is an internal idempotency key scoped to the creator. A retry returns the original workspace only while the caller still has its owner membership; it never recreates or upgrades a membership.
- Created and updated timestamps, bounded field constraints, a valid industry check, and slug uniqueness.

### `public.workspace_memberships`

- UUID primary key, workspace and auth-user foreign keys, role, and timestamps.
- One membership per `(workspace_id, user_id)`.
- At most one `owner` membership per workspace.
- Roles are constrained to `owner`, `admin`, `editor`, or `viewer`.
- Workspace deletion cascades its memberships. Auth-user deletion cascades non-owner memberships; the `created_by` restriction protects a workspace creator's businesses.

Business profile fields are stored on the workspace row. This phase does not add a settings JSON blob or future campaign, ad-account, lead, creative, analytics, AI-job, billing, or audit tables.

## Authorization and RLS

- RLS is enabled on both tenant tables.
- Workspace rows are selectable only by current members. Direct `UPDATE` is not granted; settings changes go through the owner/admin-checked RPC.
- Membership rows are visible to their subject and to owners/admins of that workspace. There are no client membership write policies or grants.
- Authenticated users receive column-scoped `SELECT` only for fields needed by the application. The internal idempotency key is not selectable from the table. There is no direct workspace `INSERT`, `UPDATE`, `DELETE`, or membership write grant.
- `tandem_internal.has_workspace_role` is a narrow `SECURITY DEFINER` boolean helper. It uses a fixed empty `search_path`, fully qualified names, and only evaluates the calling user's `auth.uid()`.
- `tandem_internal.create_workspace_privileged` and `tandem_internal.update_workspace_settings_privileged` contain the privileged implementations. They use `SECURITY DEFINER`, a fixed empty `search_path`, qualified relation references, and verify `auth.uid()` plus membership/role as applicable.
- `public.create_workspace` and `public.update_workspace_settings` preserve the API function names, arguments, and table return schemas. They are `SECURITY INVOKER` wrappers, have fixed empty `search_path` values, and delegate to the private implementations. Only `authenticated` can execute the wrappers. The authenticated role also needs execute permission on the private functions for the invoker wrappers to call them.
- **Keep `tandem_internal` out of Supabase Data API's Exposed schemas.** The private implementations require authenticated execute permission for wrapper calls, so the schema exposure setting is part of the security boundary. The schema comment warns against exposing it; verify the setting in the Dashboard before deploying. The private functions cannot be called through PostgREST when their schema is not exposed.
- Creation takes no user ID or role, derives the creator from `auth.uid()`, validates fields, and inserts the workspace plus owner membership atomically. A same-request retry is accepted only if the original owner membership still exists; the membership is locked while checked. A former owner whose membership is removed or downgraded cannot replay the request to regain ownership.
- Settings updates require the caller's current owner/admin membership and validate the complete settings. Neither public RPC accepts a role or ownership field. Authenticated users have no direct workspace or membership write grants.
- Both RPCs return an explicit workspace projection, excluding the internal creation retry key.
- Both functions use `SECURITY DEFINER`, an empty fixed search path, schema-qualified references, and explicit execute ACLs. The API forwards a verified user's bearer token with the publishable key; it does not use a service-role key.
- The pre-existing profile table and its policies are not changed by this migration.

Workspace settings access is limited to owner/admin. Editors can read workspace identity and are reserved for future operational edit capabilities; viewers can read only. Member invitations, role changes, ownership transfer, workspace deletion, subscriptions, and company-wide administrator access are not implemented.

## Safe deployment procedure

1. Confirm the intended Supabase project name and reference in the dashboard. This code does not link or apply a migration automatically.
2. Take the normal project backup/snapshot and verify it is restorable.
3. Review the complete migration file. Confirm it contains only the additive schema/functions/policies described above and contains no reset, truncate, profile deletion, or auth-user deletion.
4. In Supabase Dashboard → API, confirm `tandem_internal` is absent from **Exposed schemas**. Apply the reviewed migration in the selected project's SQL Editor, or link the local Supabase CLI only after checking the project reference and pending migration list. Apply only this migration; never reset the hosted database.
5. Configure `apps/api/.env` and `apps/web/.env.local` using the project's URL and publishable key. Keep all secret/service-role keys out of both files.
6. Run the local app and test signup/login, workspace creation, settings updates, and access as multiple dedicated users.
7. Run `supabase test db` against a local Supabase stack to execute the pgTAP isolation suite. Do not use dashboard SQL run as an elevated role as proof of RLS.

## Verification queries

Run these read-only checks in the selected project's SQL Editor after applying the migration. SQL Editor usually acts with elevated privileges; these queries verify schema/ACL setup, not end-user isolation.

```sql
select c.relname, c.relrowsecurity
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('workspaces', 'workspace_memberships')
order by c.relname;

select
  has_table_privilege('anon', 'public.workspaces', 'SELECT') as anon_can_read_workspaces,
  has_table_privilege('authenticated', 'public.workspaces', 'INSERT') as client_can_insert_workspaces,
  has_table_privilege('authenticated', 'public.workspaces', 'UPDATE') as client_can_update_workspace_rows,
  has_table_privilege('authenticated', 'public.workspace_memberships', 'INSERT') as client_can_create_memberships;

select p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       p.proconfig as function_config,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in ('create_workspace', 'update_workspace_settings'))
   or (n.nspname = 'tandem_internal' and p.proname in ('create_workspace_privileged', 'update_workspace_settings_privileged'))
order by n.nspname, p.proname;
```

Expected results: RLS is enabled; anonymous reads and all direct client writes are false; anonymous execution is false for all four RPCs; public wrappers show `security_definer = false`; private implementations show `security_definer = true` and a fixed empty search path. Authenticated execute is true for the wrappers and their private callees. Separately verify in Dashboard that `tandem_internal` is not exposed. Then use dedicated authenticated users and the pgTAP test to verify row isolation.

## Database test

`supabase/tests/database/workspaces_rls.test.sql` wraps its fixture changes in a transaction and rolls them back. It creates isolated auth users and workspaces, then tests wrapper/private function privileges, security modes, creator ownership, legitimate retries, replay after owner-role downgrade or membership removal, multiple workspaces, invalid inputs, tenant isolation, viewer/editor denial, admin settings access, and role/owner escalation denial. It must run against a disposable local Supabase database; it was not run against the hosted project.

## Manual rollback strategy

The safest rollback after the migration is to disable the workspace routes in a separately reviewed code deployment while leaving workspace data intact. Do not drop tenant tables just to revert an app release.

If a database rollback is specifically approved, first export and verify a backup. Confirm there are no business rows to preserve. The following is destructive and must be reviewed and run manually only when those conditions are true; it is never part of a normal deployment:

```sql
begin;

do $$
begin
  if exists (select 1 from public.workspace_memberships)
     or exists (select 1 from public.workspaces) then
    raise exception 'Rollback stopped: workspace data exists and must be preserved.';
  end if;
end;
$$;

drop function public.update_workspace_settings(uuid, text, text, text, text, text, text);
drop function public.create_workspace(text, text, text, text, text, text, text, uuid);
drop function tandem_internal.update_workspace_settings_privileged(uuid, text, text, text, text, text, text);
drop function tandem_internal.create_workspace_privileged(text, text, text, text, text, text, text, uuid);
drop table public.workspace_memberships;
drop table public.workspaces;
drop function tandem_internal.has_workspace_role(uuid, text[]);
drop function tandem_internal.touch_workspace_updated_at();
drop schema tandem_internal;

commit;
```

This rollback does not drop or modify `public.profiles` or `auth.users`. If the internal schema has acquired other objects by a later migration, do not drop the schema as a whole; review and remove only the objects introduced by this migration.

## Future tenant boundaries

Every future business-owned table should carry a non-null `workspace_id` foreign key. Its RLS must independently check membership and capability. For relationships between tenant tables, use composite uniqueness/foreign keys such as `(workspace_id, id)` so a child row cannot reference a parent from another workspace. API handlers must verify the bearer token and membership for every requested workspace; a saved browser workspace ID is navigation state, never authorization.

Agency/client workspaces, invitations, ownership transfer, roles beyond this four-role model, SaaS billing, platform operators, and retention/account-deletion policy need separately reviewed migrations and authorization rules.
