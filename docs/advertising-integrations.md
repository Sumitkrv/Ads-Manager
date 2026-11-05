# Advertising integrations

## Prompt 05 execution boundary

Prompt 04's provider adapters and schema remain in the repository, but this application build is fixed to `ADS_EXECUTION_MODE=demo`. The API configuration schema rejects other modes, and the integrations router returns a disabled response before authentication, provider construction, or any OAuth/provider request. Configuring Google or Meta secrets cannot enable the flow. The setup notes below describe the preserved future integration design; they are not instructions to activate providers during Prompt 05. Do not perform OAuth or provider calls as part of Campaign Studio verification.

The integrations screen is workspace-scoped and supports Google Ads and Meta Ads. Authorization, discovery, verification and account selection are server-side operations. Campaign creation, spend changes and performance reporting are not part of this module.

## Database deployment order

`20261028000000_create_advertising_integrations.sql` requires the Prompt 03 workspace tables and `tandem_internal.has_workspace_role`. The Prompt 03 hosted workspace migration is still pending, so apply neither migration to the hosted project until the existing backup and deployment review is complete and an operator explicitly approves the deployment. Do not use `supabase db push` as an unreviewed deployment step.

Apply the workspace migration first, then the advertising integrations migration. The new migration is additive and does not recreate `public.profiles` or edit the profile trigger.

## API server configuration

Set these only in the API server's secret manager/environment. Never define OAuth secrets, the service-role key or the encryption key in a `VITE_` variable.

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<server-side Supabase publishable key>
SUPABASE_SERVICE_ROLE_KEY=<server-only service-role key>
INTEGRATIONS_APP_RETURN_URL=https://<app-host>/app/integrations
INTEGRATION_CREDENTIAL_ACTIVE_KEY_VERSION=v1
INTEGRATION_CREDENTIAL_KEYS_JSON={"v1":"<base64-encoded-32-byte-key>"}
```

The credential key ring must be supplied by a deployment secret manager. The API fails closed when the key or active version is missing or malformed. The implementation uses AES-256-GCM with a fresh 96-bit nonce and binds ciphertext to workspace, record, provider, purpose and key version. The current configuration is application-level encryption; use an audited secret manager/KMS and an operator-controlled rotation process before enabling live credentials in production. Retain old key versions until every record encrypted with them has been re-encrypted. A bulk key-rotation job is not implemented yet.

The API uses user-scoped Supabase clients for normal reads and writes. The server-only service-role client is used only for narrowly granted OAuth callback and encrypted-credential RPCs, which re-check current membership before finalizing or using a credential. Configure ingress and API access logs to redact OAuth callback query parameters such as `code` and `state`; this app does not log callback values itself.

OAuth start requests are limited to five per user per ten minutes in each API process. This is a local in-memory limit; production deployments with multiple API processes should enforce the same limit in a shared rate limiter.

## Google Ads setup

1. In Google Cloud, configure the OAuth consent screen and create a **Web application** OAuth client. Add the exact redirect URI below to Authorized redirect URIs.
2. Enable the Google Ads API in the same Cloud project used by the OAuth client.
3. Apply for and configure a Google Ads developer token. Its access level must permit the intended accounts; test access is limited to test accounts.
4. Configure the OAuth app's publishing/test-user requirements for the users who will authorize it.
5. Set `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REDIRECT_URI`, and `GOOGLE_ADS_API_VERSION` on the API server.

Development redirect URI:

```text
http://127.0.0.1:4010/api/integrations/google_ads/callback
```

Production must use an HTTPS API hostname and the exact same URI in the Google Cloud client and `GOOGLE_ADS_REDIRECT_URI`.

The implemented scope is `https://www.googleapis.com/auth/adwords`. The flow requests offline access and uses PKCE. A Google OAuth login is not treated as an Ads connection: Tandem Ads calls the Ads API account-discovery endpoint and persists a connection only after authorization validation and account discovery succeed. Initial authorization is rejected if Google does not return a refresh token.

Directly accessible customer IDs are discovered first. Manager accounts are queried through the customer hierarchy with a manager login-customer-id. Google API version is configurable and currently defaults to `v26`; check the official release and sunset schedule before deployment because API versions are retired on a regular schedule.

## Meta Ads setup

1. Create a Meta developer app and configure the appropriate Facebook Login or Login for Business flow for the product's audience.
2. Register the exact callback URI in the app's valid OAuth redirect URI list and configure the intended app mode, test users and business settings.
3. Request `ads_read`, which is the only Meta permission this module currently uses for authorization validation and ad-account discovery. It does not request `ads_management` or `business_management` because this module does not create campaigns, change budgets or manage business assets.
4. Obtain the access level and approval Meta requires for the app, permission, business and users being served. App Review, advanced access, business verification or Marketing API access may be required before people outside app-role/test users can grant or use `ads_read`; verify the current Meta App Dashboard requirements for the chosen login configuration.
5. Set `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, and `META_GRAPH_API_VERSION` on the API server. Set `META_LOGIN_CONFIG_ID` only when the configured Login for Business flow requires it.

Development redirect URI:

```text
http://127.0.0.1:4010/api/integrations/meta_ads/callback
```

Production must use HTTPS and exactly match both the Meta app's redirect list and `META_REDIRECT_URI`. `META_GRAPH_API_VERSION` currently defaults to `v26.0`; verify that version is supported by the app and endpoint before deployment.

The flow validates the actual granted permission and discovers accounts from the authorized user's `/me/adaccounts` response. This implementation handles user tokens; it does not accept or manage system-user tokens. It may exchange a short-lived user token for a long-lived user token where Meta permits that exchange. It does not implement a silent refresh grant. Expired or revoked tokens require reauthorization. Disconnect removes only the current workspace's Tandem Ads credential; it does not revoke a Meta authorization that could still be needed elsewhere.

Discovery is bounded to 500 accounts per provider connection. If pagination shows that the provider response exceeds this limit, the authorization is not persisted as a complete connection; it fails safely instead of presenting partial results as exhaustive.

## Callback and recovery behavior

Each OAuth start creates a random state value; only its SHA-256 hash is stored. Google PKCE verifiers are encrypted before storage. Attempts expire after eight minutes and are consumed atomically once. Provider, initiating user and workspace are bound to that attempt. The callback accepts no caller-supplied return URL; it returns to the configured `/app/integrations` destination. Workspace membership and owner/admin role are checked again before credentials and accounts are finalized.

If consent is cancelled, state is invalid, or the provider rejects authorization, no healthy/connected status is created. If authorization later expires or is revoked, a verification records a safe error and the owner/admin must reconnect. Removing a connection deletes its workspace-scoped encrypted credential and account associations; provider-side authorization is not revoked automatically.

## Verification boundary

Provider adapter tests use isolated mock HTTP responses. They verify request construction, response parsing and failure handling, but do not prove live Google Ads or Meta access. Live verification requires configured developer credentials, provider approvals, a real consenting user, and an account the user can access. No demo account or campaign metrics are seeded.

The Prompt 04 migration, RLS tests and code are local artifacts until the workspace migration is deployed in the target environment and a separate, approved deployment is completed. A successful TypeScript/build/test run is not a database restore test or a live provider test.

## Official references

- [Google Ads OAuth overview](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Google Ads user authentication](https://developers.google.com/google-ads/api/docs/oauth/user-authentication)
- [Google Ads account discovery](https://developers.google.com/google-ads/api/docs/account-management/listing-accounts)
- [Google Ads account hierarchy](https://developers.google.com/google-ads/api/docs/account-management/get-account-hierarchy)
- [Google Ads API release notes](https://developers.google.com/google-ads/api/docs/release-notes)
- [Google Ads API sunset schedule](https://developers.google.com/google-ads/api/docs/sunset-dates)
- [Google Ads credential management](https://developers.google.com/google-ads/api/docs/oauth/credential-management)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-api/)
- [Meta Facebook Login](https://developers.facebook.com/docs/facebook-login/)
- [Meta Business SDK](https://github.com/facebook/facebook-nodejs-business-sdk)
