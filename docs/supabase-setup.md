# Local Supabase Auth, profile, and workspace setup

Local development uses the Supabase stack in `supabase/config.toml` at `http://127.0.0.1:54321`. It does not use the linked hosted project. The frontend and API must use the same local publishable key.

## Start local development

Start Docker Desktop, then run from the repository root:

```sh
npx supabase start
npm run dev
```

The root development command reads the local URL and publishable key from the running Supabase CLI, updates only the ignored frontend/API environment entries, checks that they match, and verifies local Auth health before starting the app. It rejects conflicting inherited environment variables and does not select or write to the linked hosted project. It does not reset the local database.

Local URLs:

- Web: `http://127.0.0.1:5180`
- API: `http://127.0.0.1:4010`
- Supabase Auth/API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit inbox: `http://127.0.0.1:54324`

If port 5180 or 4010 is occupied, identify its owner before stopping anything. Vite uses `strictPort` and will not silently switch to another project's server.

## Sign up, confirm, and log in locally

Email confirmation is enabled in the local config. Sign up at `/signup`, open Mailpit at `http://127.0.0.1:54324`, and follow the local confirmation link. A hosted account is not automatically present in the local database; create or confirm a local account. Local confirmation mail never goes to a real inbox.

The local redirect URLs in `supabase/config.toml` include `http://127.0.0.1:5180/login` and `http://127.0.0.1:5180/reset-password`. Keep using `127.0.0.1` consistently; `localhost` is a separate browser storage origin.

The browser restores and refreshes sessions through the Supabase SDK. The API verifies each bearer token against the same local Auth service before workspace lookup. It does not trust a decoded client-side user ID as proof of authentication.

## Local database safety

The profile, workspace, campaign, creative, and optimization migrations are recorded in the current local database. Do not run `supabase db reset`; no reset is needed for login verification. Local PostgreSQL tests can be run with `npx supabase test db`.

Hosted Supabase configuration and migrations are a separate deployment task. Do not run `supabase db push`, `supabase link`, hosted dashboard changes, or a hosted reset as part of local authentication debugging.

## Profile and tenant isolation

The pgTAP security test is `supabase/tests/database/profiles_rls.test.sql`. It creates isolated test users, checks anonymous/authenticated grants, verifies users can access their own profile, and checks cross-user isolation. Never use an elevated dashboard SQL session as proof of RLS behavior.

Every user can create a separate workspace and is assigned its owner role atomically. Creating an account or workspace does not invite anyone else. Workspace IDs are authoritative; company name, slug, email domain, profile metadata, and saved browser selection do not grant access. The workspace API forwards the user's verified bearer token and uses no service-role key for workspace access.

Member invitations, role changes, ownership transfer, billing, and agency/client relationships remain future controlled workflows. Do not infer roles from signup metadata or user-editable profile fields.
