# Tenant lifecycle operations

Workspace operational status is independent of subscription status. A workspace can remain operational while its trial expires; a suspended workspace can still have a simulated active subscription.

## States and transitions

- `ACTIVE` → `UNDER_REVIEW` or `SUSPENSION_PENDING`
- `UNDER_REVIEW` → `ACTIVE` or `SUSPENSION_PENDING`
- `SUSPENSION_PENDING` → `SUSPENDED` or `ACTIVE`
- `SUSPENDED` → `RESTORATION_PENDING`
- `RESTORATION_PENDING` → `ACTIVE` or `SUSPENDED`
- `ARCHIVED` is represented as a restricted status; no routine destructive archive operation is offered by the UI.

Every state change requires `platform.tenants.manage`, a reason, a locked workspace row, a valid transition, lifecycle history and a platform audit event. Repeating the current status is idempotent.

## Suspension behavior

Suspended/archived workspaces are blocked from writes to covered campaign, creative, automation, report, membership, task and collaboration tables. Existing rows are not deleted. Account recovery and permitted support access remain separate. The UI does not offer a delete-tenant operation or customer impersonation.

Before any real tenant status change, confirm workspace identity, reason and approval authority. Do not apply lifecycle changes to existing workspaces during development; tests use rolled-back pgTAP fixtures or clearly isolated local test accounts.

## Historical interpretation

The directory uses current workspace rows and lifecycle records. It does not claim historical growth or prior status from current state unless an event/snapshot exists. Last administrative activity is based on recorded platform events, not inferred user activity.
