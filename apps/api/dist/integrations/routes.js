import { createHash, randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { AdvertisingAccountSchema, AdvertisingConnectionSchema, AdvertisingIntegrationsResponseSchema, AdvertisingProviderSchema, AdvertisingProviderStateSchema, SelectAdvertisingAccountsInputSchema, WorkspaceRoleSchema, hasWorkspacePermission, } from "@ai-ads/shared";
import { z } from "zod";
import { createRequireAuthenticatedUser } from "../auth.js";
import { HttpError } from "../errors.js";
import { CredentialCipher, CredentialCipherError } from "./credentials/credential-cipher.js";
import { createIntegrationCallbackRepository, createIntegrationUserRepository, } from "./repository.js";
import { createAdvertisingProviders } from "./providers/index.js";
import { ProviderError } from "./providers/types.js";
const ProviderCredentialsSchema = z.object({
    accessToken: z.string().min(1).max(32768),
    refreshToken: z.string().max(32768).nullable(),
    expiresAt: z.number().finite().nullable(),
    scopes: z.array(z.string().max(200)).max(100),
    identityReference: z.string().max(300).nullable(),
}).strict();
const oauthStartBuckets = new Map();
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FALLBACK_APP_RETURN_URL = "http://127.0.0.1:5180/app/integrations";
function logIntegrationEvent(apiConfig, event, data) {
    if (apiConfig.APP_ENV === "test")
        return;
    console.info(JSON.stringify({
        event,
        workspace_id: data.workspaceId,
        provider: data.provider,
        ...(data.connectionId ? { connection_id: data.connectionId } : {}),
        ...(data.result ? { result: data.result } : {}),
        ...(data.selectedAccountCount === undefined ? {} : { selected_account_count: data.selectedAccountCount }),
        occurred_at: new Date().toISOString(),
    }));
}
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function parseId(value, field) {
    if (typeof value !== "string" || !ID_PATTERN.test(value)) {
        throw new HttpError(400, `invalid_${field}_id`, `${field === "workspace" ? "Workspace" : "Connection"} identifier is invalid.`);
    }
    return value;
}
function authenticatedUser(response) {
    const user = response.locals.authenticatedUser;
    if (!user)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return user;
}
function accessToken(response) {
    const token = response.locals.authenticatedAccessToken;
    if (typeof token !== "string")
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return token;
}
function providerId(value) {
    const parsed = AdvertisingProviderSchema.safeParse(value);
    if (!parsed.success)
        throw new HttpError(404, "provider_not_found", "The advertising provider is not supported.");
    return parsed.data;
}
function connectionFromRow(value) {
    return AdvertisingConnectionSchema.parse({
        id: value.id,
        workspaceId: value.workspace_id,
        provider: value.provider,
        status: value.connection_status,
        connectedByUserId: value.connected_by_user_id,
        providerIdentityReference: value.provider_identity_reference,
        grantedScopes: value.granted_scopes,
        verifiedAt: value.verified_at,
        lastErrorCode: value.last_error_code,
        createdAt: value.created_at,
        updatedAt: value.updated_at,
    });
}
function accountFromRow(value) {
    return AdvertisingAccountSchema.parse({
        id: value.id,
        workspaceId: value.workspace_id,
        connectionId: value.connection_id,
        provider: value.provider,
        externalAccountId: value.external_account_id,
        name: value.external_account_name,
        accountStatus: value.account_status,
        currency: value.currency,
        timezone: value.timezone,
        isManager: value.is_manager,
        managerReference: value.manager_reference,
        businessContext: value.business_context,
        selected: value.selected,
        lastSyncedAt: value.last_synced_at,
        createdAt: value.created_at,
        updatedAt: value.updated_at,
    });
}
function parseProviderAccount(value) {
    return z.object({
        externalAccountId: z.string().min(1).max(160),
        name: z.string().min(1).max(300),
        accountStatus: z.string().max(120).nullable(),
        currency: z.string().max(12).nullable(),
        timezone: z.string().max(120).nullable(),
        isManager: z.boolean().nullable(),
        managerReference: z.string().max(160).nullable(),
        businessContext: z.string().max(300).nullable(),
    }).strict().parse(value);
}
function providerErrorCode(error) {
    if (!(error instanceof ProviderError))
        return "provider_error";
    if (error.code === "authorization_expired")
        return "authorization_expired";
    if (error.code === "provider_permission_required")
        return "provider_permission_required";
    if (error.retryable || error.code === "provider_unavailable" || error.code === "provider_rate_limited")
        return "provider_unavailable";
    return "provider_error";
}
function safeProviderMessage(code) {
    switch (code) {
        case "authorization_expired": return "Provider authorization has expired. Reconnect this account to continue.";
        case "provider_permission_required": return "The provider did not grant the advertising access this connection needs.";
        case "provider_unavailable": return "The provider is temporarily unavailable. Try again shortly.";
        default: return "The provider could not verify this connection. Review setup and try again.";
    }
}
function getCipher(apiConfig, injected) {
    return injected === undefined
        ? CredentialCipher.fromEnvironment(apiConfig.INTEGRATION_CREDENTIAL_ACTIVE_KEY_VERSION, apiConfig.INTEGRATION_CREDENTIAL_KEYS_JSON)
        : injected;
}
function safeAppReturnUrl(apiConfig) {
    let destination;
    try {
        destination = new URL(apiConfig.INTEGRATIONS_APP_RETURN_URL ?? FALLBACK_APP_RETURN_URL);
    }
    catch {
        throw new HttpError(503, "integration_callback_unavailable", "The integration callback is not configured.");
    }
    if (destination.protocol !== "https:" && destination.hostname !== "127.0.0.1" && destination.hostname !== "localhost") {
        throw new HttpError(503, "integration_callback_unavailable", "The integration callback is not configured.");
    }
    if (destination.pathname !== "/app/integrations" || destination.username || destination.password || destination.search || destination.hash) {
        throw new HttpError(503, "integration_callback_unavailable", "The integration callback is not configured.");
    }
    destination.search = "";
    return destination;
}
function providerRedirectUri(provider, apiConfig) {
    const value = provider === "google_ads" ? apiConfig.GOOGLE_ADS_REDIRECT_URI : apiConfig.META_REDIRECT_URI;
    if (!value)
        throw new HttpError(503, "provider_setup_required", "Provider callback URL is not configured.");
    let uri;
    try {
        uri = new URL(value);
    }
    catch {
        throw new HttpError(503, "provider_setup_required", "Provider callback URL is invalid.");
    }
    const localhost = uri.hostname === "127.0.0.1" || uri.hostname === "localhost";
    const expectedPath = `/api/integrations/${provider}/callback`;
    if ((uri.protocol !== "https:" && !(uri.protocol === "http:" && localhost))
        || uri.pathname !== expectedPath
        || uri.username || uri.password || uri.search || uri.hash) {
        throw new HttpError(503, "provider_setup_required", "Provider callback URL must use the exact Tandem Ads callback path over HTTPS.");
    }
    return uri.toString();
}
function sendAppReturn(response, apiConfig, provider, result) {
    const destination = safeAppReturnUrl(apiConfig);
    destination.searchParams.set("provider", provider);
    destination.searchParams.set("result", result);
    response.redirect(303, destination.toString());
}
function providerConfiguration(provider, providers, apiConfig, cipher) {
    const adapter = providers[provider];
    const required = [...adapter.requiredConfiguration, "INTEGRATIONS_APP_RETURN_URL"];
    const values = apiConfig;
    const missing = required.filter((name) => {
        if (name === "INTEGRATION_CREDENTIAL_KEYS_JSON" || name === "INTEGRATION_CREDENTIAL_ACTIVE_KEY_VERSION")
            return !cipher;
        return typeof values[name] !== "string" || values[name] === "";
    });
    try {
        providerRedirectUri(provider, apiConfig);
    }
    catch {
        missing.push(provider === "google_ads" ? "GOOGLE_ADS_REDIRECT_URI" : "META_REDIRECT_URI");
    }
    if (!apiConfig.SUPABASE_SERVICE_ROLE_KEY)
        missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return { configured: adapter.configured && missing.length === 0, missing: [...new Set(missing)] };
}
function verifyAuthorizationUrl(provider, rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
        throw new ProviderError("provider_url_rejected");
    }
    const expectedHost = provider === "google_ads" ? "accounts.google.com" : "www.facebook.com";
    if (url.protocol !== "https:" || url.hostname !== expectedHost)
        throw new ProviderError("provider_url_rejected");
    return url.toString();
}
function consumeStartRateLimit(userId) {
    const now = Date.now();
    if (oauthStartBuckets.size > 10_000) {
        for (const [key, timestamps] of oauthStartBuckets) {
            if (!timestamps.some((timestamp) => now - timestamp < 10 * 60_000))
                oauthStartBuckets.delete(key);
        }
        if (oauthStartBuckets.size > 10_000)
            oauthStartBuckets.delete(oauthStartBuckets.keys().next().value);
    }
    const recent = (oauthStartBuckets.get(userId) ?? []).filter((time) => now - time < 10 * 60_000);
    if (recent.length >= 5)
        throw new HttpError(429, "oauth_rate_limited", "Too many connection attempts. Wait a few minutes and try again.");
    recent.push(now);
    oauthStartBuckets.set(userId, recent);
}
function encryptedCredentials(cipher, credentials, workspaceId, contextId, provider) {
    return cipher.encrypt(JSON.stringify(credentials), {
        workspaceId,
        recordId: contextId,
        provider,
        purpose: "provider_credentials",
    });
}
function decryptCredentials(cipher, row, workspaceId) {
    const plaintext = cipher.decrypt({
        algorithm: row.encryption_algorithm,
        keyVersion: row.key_version,
        ciphertext: row.ciphertext,
    }, {
        workspaceId,
        recordId: row.encryption_context_id,
        provider: row.provider,
        purpose: "provider_credentials",
    });
    let parsed;
    try {
        parsed = JSON.parse(plaintext);
    }
    catch {
        throw new CredentialCipherError();
    }
    const credentials = ProviderCredentialsSchema.safeParse(parsed);
    if (!credentials.success)
        throw new CredentialCipherError();
    return credentials.data;
}
function encryptedPayload(encrypted, expiresAt) {
    return {
        algorithm: encrypted.algorithm,
        keyVersion: encrypted.keyVersion,
        ciphertext: encrypted.ciphertext,
        expiresAt: expiresAt === null ? null : new Date(expiresAt).toISOString(),
    };
}
function safeStateHash(state) {
    return createHash("sha256").update(state, "utf8").digest("hex");
}
function safeState(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{40,100}$/.test(value) ? value : null;
}
function safeCode(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 4096 ? value : null;
}
export function createAdvertisingIntegrationsRouter(apiConfig, verifyToken, dependencies = {}) {
    const router = express.Router();
    // Prompt 14 keeps every provider transport disabled in every environment.
    // Local configuration is planning metadata only; provider credentials in an
    // environment must never activate OAuth, discovery, verification, or calls.
    function providerTransportEnabled(_config) { return false; }
    if (!providerTransportEnabled(apiConfig)) {
        const disabled = (_request, response) => {
            response.status(409).json({ status: "error", error: {
                    code: "provider_integrations_disabled",
                    message: "External provider connections are not available. Prepare and validate configuration locally.",
                } });
        };
        router.use("/api/workspaces/:workspaceId/integrations", disabled);
        router.use("/api/integrations", disabled);
        return router;
    }
    const authenticate = createRequireAuthenticatedUser(verifyToken);
    const repositoryFactory = dependencies.userRepositoryFactory
        ?? ((token) => createIntegrationUserRepository(token, apiConfig));
    const callbackRepositoryFactory = dependencies.callbackRepositoryFactory
        ?? (() => createIntegrationCallbackRepository(apiConfig));
    const providers = dependencies.providerSet ?? createAdvertisingProviders(apiConfig, dependencies.fetcher);
    const cipher = getCipher(apiConfig, dependencies.credentialCipher);
    function userRepository(response) {
        const repository = repositoryFactory(accessToken(response));
        if (!repository)
            throw new HttpError(503, "integration_service_unavailable", "The integration service is temporarily unavailable.");
        return repository;
    }
    async function requireRole(response, workspaceId, permission) {
        const user = authenticatedUser(response);
        const repository = userRepository(response);
        const roleValue = await repository.getRole(workspaceId, user.id);
        const role = WorkspaceRoleSchema.safeParse(roleValue);
        if (!role.success)
            throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
        if (!hasWorkspacePermission(role.data, permission)) {
            throw new HttpError(403, "integration_forbidden", "Your workspace role cannot perform this integration action.");
        }
        return { user, role: role.data, repository };
    }
    async function integrationPayload(workspaceId, role, repository) {
        const rows = await repository.list(workspaceId);
        const connectionsByProvider = new Map();
        for (const row of rows.connections) {
            const connection = connectionFromRow(row);
            connectionsByProvider.set(connection.provider, connection);
        }
        const accountsByConnection = new Map();
        for (const row of rows.accounts) {
            const account = accountFromRow(row);
            const list = accountsByConnection.get(account.connectionId) ?? [];
            list.push(account);
            accountsByConnection.set(account.connectionId, list);
        }
        const providersData = ["google_ads", "meta_ads"].map((provider) => {
            const configured = providerConfiguration(provider, providers, apiConfig, cipher);
            const connection = connectionsByProvider.get(provider) ?? null;
            return AdvertisingProviderStateSchema.parse({
                provider,
                displayName: providers[provider].displayName,
                configured: configured.configured,
                setupRequirements: configured.missing,
                connection,
                accounts: connection ? accountsByConnection.get(connection.id) ?? [] : [],
            });
        });
        return AdvertisingIntegrationsResponseSchema.parse({
            workspaceId,
            role,
            canManage: hasWorkspacePermission(role, "integrations.manage"),
            providers: providersData,
        });
    }
    router.get("/api/workspaces/:workspaceId/integrations", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace");
        const { role, repository } = await requireRole(response, workspaceId, "integrations.read");
        response.status(200).json(await integrationPayload(workspaceId, role, repository));
    }));
    router.post("/api/workspaces/:workspaceId/integrations/:provider/start", authenticate, asyncRoute(async (request, response) => {
        if (!z.object({}).strict().safeParse(request.body ?? {}).success) {
            throw new HttpError(400, "invalid_oauth_request", "The authorization request is invalid.");
        }
        const workspaceId = parseId(request.params.workspaceId, "workspace");
        const provider = providerId(request.params.provider);
        const { user, repository } = await requireRole(response, workspaceId, "integrations.manage");
        consumeStartRateLimit(user.id);
        if (!cipher)
            throw new HttpError(503, "credential_encryption_unavailable", "Secure credential storage is not configured for integrations.");
        const readiness = providerConfiguration(provider, providers, apiConfig, cipher);
        if (!readiness.configured) {
            throw new HttpError(503, "provider_setup_required", `Provider setup is incomplete. Configure: ${readiness.missing.join(", ")}.`);
        }
        const adapter = providers[provider];
        const state = randomBytes(32).toString("base64url");
        const attemptId = randomUUID();
        let authorization;
        try {
            authorization = adapter.createAuthorization({ state, redirectUri: providerRedirectUri(provider, apiConfig) });
        }
        catch (error) {
            if (error instanceof ProviderError && error.code === "provider_not_configured") {
                throw new HttpError(503, "provider_setup_required", "Provider setup is incomplete.");
            }
            throw error;
        }
        const encryptedVerifier = authorization.pkceVerifier
            ? cipher.encrypt(authorization.pkceVerifier, {
                workspaceId, recordId: attemptId, provider, purpose: "oauth_pkce_verifier",
            })
            : null;
        await repository.startAttempt({
            attemptId,
            workspaceId,
            provider,
            stateHash: safeStateHash(state),
            pkce: encryptedVerifier ? {
                algorithm: encryptedVerifier.algorithm,
                keyVersion: encryptedVerifier.keyVersion,
                ciphertext: encryptedVerifier.ciphertext,
            } : null,
            expiresAt: new Date(Date.now() + 8 * 60_000).toISOString(),
        });
        logIntegrationEvent(apiConfig, "oauth_started", { workspaceId, provider, result: "started" });
        response.status(200).json({ authorizationUrl: verifyAuthorizationUrl(provider, authorization.authorizationUrl) });
    }));
    router.get("/api/integrations/:provider/callback", asyncRoute(async (request, response) => {
        const provider = providerId(request.params.provider);
        const state = safeState(request.query.state);
        if (!state) {
            response.status(400).json({ status: "error", error: { code: "oauth_state_invalid", message: "Authorization could not be verified. Start again from Integrations." } });
            return;
        }
        const callbackRepository = callbackRepositoryFactory();
        if (!callbackRepository)
            throw new HttpError(503, "integration_callback_unavailable", "The integration callback is temporarily unavailable.");
        let attempt;
        try {
            attempt = await callbackRepository.consumeAttempt(provider, safeStateHash(state));
        }
        catch {
            response.status(400).json({ status: "error", error: { code: "oauth_state_invalid", message: "Authorization could not be verified. Start again from Integrations." } });
            return;
        }
        if (request.query.error !== undefined) {
            logIntegrationEvent(apiConfig, "oauth_denied", { workspaceId: attempt.workspace_id, provider, result: "denied" });
            sendAppReturn(response, apiConfig, provider, "denied");
            return;
        }
        const code = safeCode(request.query.code);
        if (!code) {
            logIntegrationEvent(apiConfig, "oauth_failed", { workspaceId: attempt.workspace_id, provider, result: "missing_code" });
            sendAppReturn(response, apiConfig, provider, "error");
            return;
        }
        if (!cipher) {
            logIntegrationEvent(apiConfig, "oauth_failed", { workspaceId: attempt.workspace_id, provider, result: "setup_required" });
            sendAppReturn(response, apiConfig, provider, "setup_required");
            return;
        }
        try {
            const adapter = providers[provider];
            const redirectUri = providerRedirectUri(provider, apiConfig);
            let verifier = null;
            if (attempt.pkce_ciphertext) {
                if (!attempt.pkce_algorithm || !attempt.pkce_key_version)
                    throw new CredentialCipherError();
                verifier = cipher.decrypt({
                    algorithm: attempt.pkce_algorithm,
                    keyVersion: attempt.pkce_key_version,
                    ciphertext: attempt.pkce_ciphertext,
                }, {
                    workspaceId: attempt.workspace_id,
                    recordId: attempt.attempt_id,
                    provider,
                    purpose: "oauth_pkce_verifier",
                });
            }
            let credentials = await adapter.exchangeAuthorizationCode({ code, redirectUri, pkceVerifier: verifier });
            credentials = await adapter.validateAuthorization(credentials);
            if (!credentials.scopes.some((scope) => adapter.requestedScopes.includes(scope))) {
                throw new ProviderError("provider_permission_required");
            }
            if (provider === "google_ads" && !credentials.refreshToken)
                throw new ProviderError("refresh_token_missing");
            const accounts = (await adapter.listAccessibleAccounts(credentials)).map(parseProviderAccount);
            const encrypted = encryptedCredentials(cipher, credentials, attempt.workspace_id, attempt.attempt_id, provider);
            await callbackRepository.finalize({
                attempt,
                credentials: encryptedPayload(encrypted, credentials.expiresAt),
                identityReference: credentials.identityReference,
                scopes: credentials.scopes,
                accounts,
            });
            logIntegrationEvent(apiConfig, "oauth_completed", { workspaceId: attempt.workspace_id, provider, result: accounts.length ? "accounts_available" : "no_accounts" });
            sendAppReturn(response, apiConfig, provider, accounts.length ? "accounts_available" : "no_accounts");
        }
        catch (error) {
            const code = providerErrorCode(error);
            const result = code === "authorization_expired" ? "reauthorization_required" : code === "provider_permission_required" ? "permission_required" : "error";
            logIntegrationEvent(apiConfig, "oauth_failed", { workspaceId: attempt.workspace_id, provider, result });
            sendAppReturn(response, apiConfig, provider, result);
        }
    }));
    router.get("/api/workspaces/:workspaceId/integrations/:connectionId/accounts", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace");
        const connectionId = parseId(request.params.connectionId, "connection");
        const { repository } = await requireRole(response, workspaceId, "integrations.read");
        const connectionRow = await repository.getConnection(workspaceId, connectionId);
        if (!connectionRow)
            throw new HttpError(404, "integration_not_found", "The requested integration could not be found.");
        const connection = connectionFromRow(connectionRow);
        const rows = await repository.list(workspaceId);
        response.status(200).json({ connection, accounts: rows.accounts.map(accountFromRow).filter((account) => account.connectionId === connectionId) });
    }));
    router.post("/api/workspaces/:workspaceId/integrations/:connectionId/accounts/select", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace");
        const connectionId = parseId(request.params.connectionId, "connection");
        const parsed = SelectAdvertisingAccountsInputSchema.safeParse(request.body);
        if (!parsed.success)
            throw new HttpError(400, "invalid_account_selection", "Review the account selection and try again.");
        const { repository } = await requireRole(response, workspaceId, "integrations.manage");
        const exists = await repository.getConnection(workspaceId, connectionId);
        if (!exists)
            throw new HttpError(404, "integration_not_found", "The requested integration could not be found.");
        await repository.selectAccounts(workspaceId, connectionId, parsed.data.accountIds);
        const connection = connectionFromRow(exists);
        logIntegrationEvent(apiConfig, "accounts_selected", { workspaceId, provider: connection.provider, connectionId, selectedAccountCount: parsed.data.accountIds.length });
        response.status(200).json({ status: "ok", message: "Workspace account selection saved." });
    }));
    router.post("/api/workspaces/:workspaceId/integrations/:connectionId/verify", authenticate, asyncRoute(async (request, response) => {
        if (!z.object({}).strict().safeParse(request.body ?? {}).success) {
            throw new HttpError(400, "invalid_verification_request", "The verification request is invalid.");
        }
        const workspaceId = parseId(request.params.workspaceId, "workspace");
        const connectionId = parseId(request.params.connectionId, "connection");
        const { user, repository } = await requireRole(response, workspaceId, "integrations.manage");
        const connectionRow = await repository.getConnection(workspaceId, connectionId);
        if (!connectionRow)
            throw new HttpError(404, "integration_not_found", "The requested integration could not be found.");
        const connection = connectionFromRow(connectionRow);
        const callbackRepository = callbackRepositoryFactory();
        if (!callbackRepository || !cipher)
            throw new HttpError(503, "credential_storage_unavailable", "Secure credential storage is not configured for integrations.");
        const encrypted = await callbackRepository.getCredential(workspaceId, connectionId, user.id);
        if (!encrypted)
            throw new HttpError(409, "reauthorization_required", "Reconnect this provider to verify access.");
        try {
            let credentials = decryptCredentials(cipher, encrypted, workspaceId);
            const adapter = providers[connection.provider];
            if (credentials.expiresAt !== null && credentials.expiresAt <= Date.now() + 60_000) {
                const refreshed = await adapter.refreshCredentialsIfSupported(credentials);
                if (!refreshed)
                    throw new ProviderError("authorization_expired");
                credentials = refreshed;
            }
            credentials = await adapter.validateAuthorization(credentials);
            const accounts = (await adapter.listAccessibleAccounts(credentials)).map(parseProviderAccount);
            const encryptedAgain = encryptedCredentials(cipher, credentials, workspaceId, encrypted.encryption_context_id, connection.provider);
            await callbackRepository.sync({
                workspaceId,
                connectionId,
                actorUserId: user.id,
                encryptionContextId: encrypted.encryption_context_id,
                provider: connection.provider,
                credentials: encryptedPayload(encryptedAgain, credentials.expiresAt),
                identityReference: credentials.identityReference,
                scopes: credentials.scopes,
                accounts,
            });
            logIntegrationEvent(apiConfig, "connection_verified", { workspaceId, provider: connection.provider, connectionId, result: "verified" });
            response.status(200).json({ status: "ok", message: "Provider access was verified and account details were refreshed." });
        }
        catch (error) {
            const publicCode = providerErrorCode(error);
            try {
                await callbackRepository.markError(workspaceId, connectionId, user.id, publicCode);
            }
            catch { /* Keep the provider failure response private. */ }
            logIntegrationEvent(apiConfig, "connection_verification_failed", { workspaceId, provider: connection.provider, connectionId, result: publicCode });
            throw new HttpError(409, publicCode, safeProviderMessage(publicCode));
        }
    }));
    router.delete("/api/workspaces/:workspaceId/integrations/:connectionId", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace");
        const connectionId = parseId(request.params.connectionId, "connection");
        const { repository } = await requireRole(response, workspaceId, "integrations.manage");
        const exists = await repository.getConnection(workspaceId, connectionId);
        if (!exists)
            throw new HttpError(404, "integration_not_found", "The requested integration could not be found.");
        await repository.unlink(workspaceId, connectionId);
        const connection = connectionFromRow(exists);
        logIntegrationEvent(apiConfig, "connection_unlinked", { workspaceId, provider: connection.provider, connectionId, result: "unlinked" });
        response.status(200).json({ status: "ok", message: "This workspace connection was removed. Provider authorization was not revoked." });
    }));
    return router;
}
