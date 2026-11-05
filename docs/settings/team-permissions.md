# Team and permissions

Team routes show active memberships, verified email only when available to an owner/admin, and up to 100 invitations. The view supports member search and role/status filtering, role changes, eligible member removal, invitation actions and recent membership activity. Results are currently bounded to 500 members; server-side pagination is a follow-up.

The current data model has no generic workspace access-request inbox. Pending invitations are reviewed here; agency relationship requests stay in Agency Command Center.

| Role | Settings access |
| --- | --- |
| Owner | Workspace settings, team management, invitation/role administration, workspace closure request. |
| Admin | Operational settings and team administration within admin authority; cannot self-promote, manage another admin, or grant admin to an invitee. |
| Editor | Read-only workspace settings; no membership administration by default. |
| Viewer | Read-only permitted views; no workspace settings or membership writes. |

Express checks a verified user and current membership. Database policies and guarded functions revalidate role on writes. Role updates and removals lock the workspace and target membership, preventing conflicting transitions from creating an ownerless workspace. The owner cannot be removed or demoted using these operations. Explicit ownership transfer is unavailable.

Workspace Owner is an ordinary workspace role; it does not confer Platform Admin. Subscription entitlements and agency plan state do not alter RBAC.
