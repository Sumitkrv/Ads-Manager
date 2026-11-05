# Settings Center architecture

## Routes and ownership

The authenticated Settings Center lives under `/app/settings`. It renders overview, team, shared defaults, personal preferences, notifications, security and data/privacy sections. The established business-identity route remains `/app/settings/workspace`. Each route uses the current Auth session and selected workspace.

React views call `apps/web/src/api/settings.ts` or the existing workspace/profile clients. Express mounts the Settings router from `apps/api/src/settings/routes.ts`; repositories use the caller’s publishable key and bearer JWT. No service-role key is used by this feature. Workspace IDs are parsed, membership/role is rechecked server-side, and database RLS remains authoritative.

## Persistence

- `user_preferences` stores user-owned display and notification preferences.
- `workspace_preferences` stores workspace profile details and typed team defaults.
- Existing `workspaces`, memberships, invitations, Brand Kit, agency and billing records remain the source for their established concepts.
- `workspace_settings_audit` records allowed field names and membership/invitation events, not tokens or submitted values.
- `account_closure_requests` records requests for later review; it does not delete data.

The additive migration is `supabase/migrations/20261029120000_add_settings_center.sql`. It was not applied in this environment because local Supabase was not running and the API `.env` targets the hosted project.

## Authorization boundary

Owners/admins can update business/workspace settings. Team membership management is limited to owners/admins and guarded RPCs; admins cannot self-promote, change another admin, or grant an admin role. The owner cannot be demoted or removed through these operations. Editors/viewers cannot update shared settings or memberships. Ownership transfer and platform-admin assignment are not exposed by ordinary workspace settings.

## Data handling

Avatar objects are private, size/type limited and scoped to a user UUID path. API responses provide short-lived signed URLs when a permitted profile is displayed. Invitations persist SHA-256 token hashes and place the one-time token in the fragment of a manually shared link. Account and workspace export endpoints are private and no-store.
