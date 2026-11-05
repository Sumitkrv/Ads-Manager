# Platform authorization and operator provisioning

## Capability checks

The Express middleware verifies the Supabase access token and derives the actor ID from the verified user. Each platform handler checks its specific capability before invoking a database RPC. The RPC checks that same actor against the trusted assignment/capability tables. The caller cannot supply a role or capability in a request body.

The server-only service-role client is confined to `apps/api/src/platform-admin/repository.ts` and an explicit list of named platform RPCs. It is not exposed to the browser and cannot perform arbitrary table access through this repository. Customer support case actions use a separate session-scoped repository. A valid authenticated request denied a capability writes a narrow `platform.authorization.denied` audit record through a service-only RPC. Only known capability keys are accepted, and identical actor/capability denials are throttled to one event per minute.

Authenticated clients cannot read platform role assignments, privileged operational tables, or execute administrative functions directly. Existing workspace RLS remains the boundary for normal business data. Platform roles do not create customer-content access.

## Role scope

| Role | Capability scope |
| --- | --- |
| `super_admin` | All enumerated platform capabilities, including role provisioning |
| `operations_admin` | Dashboard, tenant read/manage, usage, health and audit |
| `support_agent` | Dashboard and support case/access-request operations; no tenant-directory enumeration |
| `billing_admin` | Dashboard, tenant read, billing read/manage, usage and audit |
| `auditor` | Read-only dashboard, tenant/user/billing/usage/audit/health metadata |

Sensitive endpoint checks are capability-specific. A support agent cannot suspend tenants or manage plan configuration; a billing operator cannot suspend tenants; an auditor cannot mutate platform state.

## First-operator bootstrap

No operator was auto-promoted or provisioned. Workspace owners and editable profiles cannot bootstrap themselves. Before a real operator is designated, obtain explicit approval for the verified Auth user identity and intended least-privilege role.

The approved bootstrap must be performed by an authorized DBA in the intended environment, never through a public endpoint:

1. Verify the exact local Supabase URL and the target Auth UUID from the trusted Auth account; do not resolve by email-domain rule alone.
2. Obtain explicit operator approval for that identity and role.
3. In one transaction, insert one `tandem_internal.platform_admin_role_assignments` row with the approved `user_id`, selected `role_key`, and reason. For the initial grant, `granted_by` may be null because no platform actor exists yet.
4. Insert a corresponding `platform_admin_events` record in the same transaction with action `platform.role.granted`, target type `user`, the UUID as target, actor role `bootstrap_operator`, a reason/request reference, and safe metadata containing only the role key.
5. Verify `/api/platform-admin/access` for that user and review the audit event. Do not store credentials or tokens in the audit record.

Once an authorized `super_admin` exists, subsequent grants/revocations go through the audited `platform_admin_grant_role` and `platform_admin_revoke_role` operations, which require `platform.admin.provision`. Self-revocation and removing the final active super administrator are blocked. No bootstrap statement has been executed for a real user.

## Emergency access

There is no impersonation or customer-session minting route. A platform role does not bypass customer RLS. Any future emergency access design requires a separately reviewed, time-bounded, customer-consented, narrowly scoped capability and its own audit/test boundary.
