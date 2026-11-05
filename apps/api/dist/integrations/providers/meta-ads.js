import { AdvertisingProviderSchema } from "@ai-ads/shared";
import { ProviderError } from "./types.js";
import { isRecord, numericExpiration, optionalString, requestJson } from "./http.js";
const META_ADS_SCOPE = "ads_read";
const ACCOUNT_FIELDS = "id,account_id,name,account_status,currency,timezone_name";
function record(value) {
    if (!isRecord(value))
        throw new ProviderError("provider_response_invalid");
    return value;
}
function mapAccount(value, managerReference = null) {
    const account = record(value);
    const externalAccountId = optionalString(account, "account_id") ?? optionalString(account, "id");
    if (!externalAccountId || !/^(?:act_)?\d{1,30}$/.test(externalAccountId)) {
        throw new ProviderError("provider_response_invalid");
    }
    const name = optionalString(account, "name") ?? `Unnamed Meta ad account (${externalAccountId})`;
    const status = account.account_status;
    return {
        externalAccountId,
        name,
        accountStatus: typeof status === "number" ? String(status) : optionalString(account, "account_status"),
        currency: optionalString(account, "currency"),
        timezone: optionalString(account, "timezone_name"),
        isManager: null,
        managerReference,
        businessContext: optionalString(account, "business_name"),
    };
}
export class MetaAdsProvider {
    config;
    fetcher;
    id = AdvertisingProviderSchema.enum.meta_ads;
    displayName = "Meta Ads";
    requestedScopes = [META_ADS_SCOPE];
    requiredConfiguration = [
        "META_APP_ID",
        "META_APP_SECRET",
        "META_REDIRECT_URI",
        "META_GRAPH_API_VERSION",
        "SUPABASE_SERVICE_ROLE_KEY",
        "INTEGRATION_CREDENTIAL_KEYS_JSON",
    ];
    configured;
    constructor(config, fetcher = fetch) {
        this.config = config;
        this.fetcher = fetcher;
        this.configured = Boolean(config.appId && config.appSecret && config.redirectUri);
    }
    createAuthorization(input) {
        this.assertConfigured();
        const url = new URL(`https://www.facebook.com/${this.config.graphApiVersion}/dialog/oauth`);
        const params = {
            client_id: this.config.appId,
            redirect_uri: input.redirectUri,
            response_type: "code",
            scope: META_ADS_SCOPE,
            state: input.state,
            auth_type: "rerequest",
        };
        if (this.config.loginConfigId)
            params.config_id = this.config.loginConfigId;
        url.search = new URLSearchParams(params).toString();
        return { authorizationUrl: url.toString(), pkceVerifier: null };
    }
    async exchangeAuthorizationCode(input) {
        this.assertConfigured();
        const url = new URL(`https://graph.facebook.com/${this.config.graphApiVersion}/oauth/access_token`);
        url.search = new URLSearchParams({
            client_id: this.config.appId,
            client_secret: this.config.appSecret,
            redirect_uri: input.redirectUri,
            code: input.code,
        }).toString();
        const shortLived = record(await requestJson(url, { method: "GET" }, { fetcher: this.fetcher }));
        const accessToken = optionalString(shortLived, "access_token");
        if (!accessToken)
            throw new ProviderError("provider_response_invalid");
        let tokenPayload = shortLived;
        try {
            const longLivedUrl = new URL(`https://graph.facebook.com/${this.config.graphApiVersion}/oauth/access_token`);
            longLivedUrl.search = new URLSearchParams({
                grant_type: "fb_exchange_token",
                client_id: this.config.appId,
                client_secret: this.config.appSecret,
                fb_exchange_token: accessToken,
            }).toString();
            tokenPayload = record(await requestJson(longLivedUrl, { method: "GET" }, { fetcher: this.fetcher }));
        }
        catch {
            // Keep the valid short-lived token with its actual expiry; it will require reauthorization.
        }
        const finalAccessToken = optionalString(tokenPayload, "access_token") ?? accessToken;
        return {
            accessToken: finalAccessToken,
            refreshToken: null,
            expiresAt: numericExpiration(tokenPayload.expires_in) ?? numericExpiration(shortLived.expires_in),
            scopes: [],
            identityReference: null,
        };
    }
    async validateAuthorization(credentials) {
        this.assertConfigured();
        const me = await this.graphGet("me", { fields: "id" }, credentials.accessToken);
        const identityReference = optionalString(me, "id");
        if (!identityReference)
            throw new ProviderError("provider_response_invalid");
        const permissions = await this.graphGet("me/permissions", {}, credentials.accessToken);
        const data = Array.isArray(permissions.data) ? permissions.data : [];
        const granted = data
            .filter(isRecord)
            .filter((permission) => permission.status === "granted")
            .map((permission) => optionalString(permission, "permission"))
            .filter((permission) => Boolean(permission));
        if (!granted.includes(META_ADS_SCOPE))
            throw new ProviderError("provider_permission_required");
        return { ...credentials, identityReference, scopes: granted };
    }
    async listAccessibleAccounts(credentials) {
        this.assertConfigured();
        const found = new Map();
        let after = null;
        for (let page = 0; page < 10; page += 1) {
            const params = { fields: ACCOUNT_FIELDS, limit: "100" };
            if (after)
                params.after = after;
            const result = await this.graphGet("me/adaccounts", params, credentials.accessToken, true);
            const rows = Array.isArray(result.data) ? result.data : [];
            for (const row of rows) {
                const account = mapAccount(row);
                if (!found.has(account.externalAccountId) && found.size >= 500)
                    throw new ProviderError("provider_account_limit_exceeded");
                found.set(account.externalAccountId, account);
            }
            const paging = isRecord(result.paging) ? result.paging : {};
            const cursors = isRecord(paging.cursors) ? paging.cursors : {};
            after = optionalString(cursors, "after");
            if (!after)
                break;
        }
        if (after)
            throw new ProviderError("provider_account_limit_exceeded");
        return [...found.values()];
    }
    async getAccountDetails(externalAccountId, credentials, managerReference) {
        if (!/^(?:act_)?\d{1,30}$/.test(externalAccountId))
            throw new ProviderError("account_id_invalid");
        const account = await this.graphGet(externalAccountId, { fields: ACCOUNT_FIELDS }, credentials.accessToken);
        return mapAccount(account, managerReference ?? null);
    }
    async refreshCredentialsIfSupported() {
        // Meta user tokens use documented exchange/expiry semantics, not a silent refresh grant.
        return null;
    }
    async verifyConnection(credentials) {
        const validated = await this.validateAuthorization(credentials);
        return this.listAccessibleAccounts(validated);
    }
    async revokeAuthorizationIfSupported() {
        // Disconnect removes only the workspace-scoped Tandem Ads credential. Revocation is not automatic.
        return false;
    }
    async graphGet(path, params, accessToken, retryReadOnly = false) {
        const safePath = path.split("/").every((part) => /^[A-Za-z0-9_]+$/.test(part));
        if (!safePath)
            throw new ProviderError("provider_url_rejected");
        const url = new URL(`https://graph.facebook.com/${this.config.graphApiVersion}/${path}`);
        url.search = new URLSearchParams(params).toString();
        return record(await requestJson(url, {
            method: "GET",
            headers: { authorization: `Bearer ${accessToken}` },
        }, { retryReadOnly, fetcher: this.fetcher }));
    }
    assertConfigured() {
        if (!this.configured)
            throw new ProviderError("provider_not_configured");
    }
}
