# Security settings

## Account

The account page displays the Auth identity email and confirmation state. Password changes and email changes use the installed Supabase Auth client; reset uses the existing password-reset route. Sign-out uses the current Auth session. The UI does not expose password hashes, access/refresh tokens, invented device history or unsupported session revocation controls.

## Workspace

Owners/admins can review the membership/invitation audit timeline and available roles. Workspace security writes use the same server and RLS checks as team/settings writes. Invitation tokens are never included in audit records. Audits list changed field names rather than values.

The product does not claim SSO/SAML or MFA enforcement. Ownership transfer and impersonation are unavailable. A workspace-closure request is recorded as pending review and does not remove workspace data.

## Runtime boundary

The web local environment points to loopback Supabase. The API package `.env` points to the hosted Supabase project, while `.env.local` is loopback; `dotenv/config` does not make the runtime loopback-only by itself. Local Supabase status returned unavailable, so no API/browser session or database write was attempted.
