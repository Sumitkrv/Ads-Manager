import { createHash, randomBytes } from "node:crypto";
import { AdvertisingProviderSchema } from "@ai-ads/shared";
import { ProviderError } from "./types.js";
import { isRecord, numericExpiration, optionalString, requestJson } from "./http.js";
const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const CUSTOMER_FIELDS_QUERY = "SELECT customer.id, customer.descriptive_name, customer.status, customer.currency_code, customer.time_zone, customer.manager FROM customer";
const CUSTOMER_CLIENT_QUERY = "SELECT customer_client.client_customer, customer_client.level, customer_client.manager, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.id, customer_client.status FROM customer_client WHERE customer_client.level <= 1";
function record(value) {
    if (!isRecord(value))
        throw new ProviderError("provider_response_invalid");
    return value;
}
function customerIdFromResourceName(value) {
    if (typeof value !== "string")
        throw new ProviderError("provider_response_invalid");
    const match = value.match(/^customers\/(\d{1,20})$/);
    if (!match?.[1])
        throw new ProviderError("provider_response_invalid");
    return match[1];
}
function valueAt(row, camel, snake) {
    return row[camel] ?? row[snake];
}
function mapCustomer(customer, managerReference) {
    const id = customer.id;
    const externalAccountId = typeof id === "number" || typeof id === "string"
        ? String(id)
        : customerIdFromResourceName(customer.resourceName ?? customer.resource_name);
    const name = optionalString(customer, "descriptiveName")
        ?? optionalString(customer, "descriptive_name")
        ?? `Unnamed Google Ads account (${externalAccountId})`;
    const manager = valueAt(customer, "manager", "manager");
    const accountStatus = optionalString(customer, "status");
    const currency = optionalString(customer, "currencyCode") ?? optionalString(customer, "currency_code");
    const timezone = optionalString(customer, "timeZone") ?? optionalString(customer, "time_zone");
    return {
        externalAccountId,
        name,
        accountStatus,
        currency,
        timezone,
        isManager: typeof manager === "boolean" ? manager : null,
        managerReference,
        businessContext: null,
    };
}
function googleCustomerId(accountId) {
    const normalized = accountId.replace(/-/g, "");
    if (!/^\d{1,20}$/.test(normalized))
        throw new ProviderError("account_id_invalid");
    return normalized;
}
export class GoogleAdsProvider {
    config;
    fetcher;
    id = AdvertisingProviderSchema.enum.google_ads;
    displayName = "Google Ads";
    requestedScopes = [GOOGLE_ADS_SCOPE];
    requiredConfiguration = [
        "GOOGLE_ADS_CLIENT_ID",
        "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_DEVELOPER_TOKEN",
        "GOOGLE_ADS_REDIRECT_URI",
        "SUPABASE_SERVICE_ROLE_KEY",
        "INTEGRATION_CREDENTIAL_KEYS_JSON",
    ];
    configured;
    constructor(config, fetcher = fetch) {
        this.config = config;
        this.fetcher = fetcher;
        this.configured = Boolean(config.clientId && config.clientSecret && config.developerToken && config.redirectUri);
    }
    createAuthorization(input) {
        this.assertConfigured();
        const verifier = randomBytes(32).toString("base64url");
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.search = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: input.redirectUri,
            response_type: "code",
            scope: GOOGLE_ADS_SCOPE,
            state: input.state,
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
            code_challenge: challenge,
            code_challenge_method: "S256",
        }).toString();
        return { authorizationUrl: url.toString(), pkceVerifier: verifier };
    }
    async exchangeAuthorizationCode(input) {
        this.assertConfigured();
        if (!input.pkceVerifier)
            throw new ProviderError("pkce_verifier_missing");
        const body = new URLSearchParams({
            code: input.code,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            redirect_uri: input.redirectUri,
            grant_type: "authorization_code",
            code_verifier: input.pkceVerifier,
        });
        const response = record(await requestJson(new URL("https://oauth2.googleapis.com/token"), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }, { fetcher: this.fetcher }));
        const accessToken = response.access_token;
        if (typeof accessToken !== "string" || !accessToken)
            throw new ProviderError("provider_response_invalid");
        const scope = optionalString(response, "scope");
        const scopes = scope?.split(/\s+/).filter(Boolean) ?? [];
        if (!scopes.includes(GOOGLE_ADS_SCOPE))
            throw new ProviderError("provider_permission_required");
        return {
            accessToken,
            refreshToken: optionalString(response, "refresh_token"),
            expiresAt: numericExpiration(response.expires_in),
            scopes,
            identityReference: null,
        };
    }
    async validateAuthorization(credentials) {
        await this.listAccessibleCustomerIds(credentials.accessToken);
        return credentials;
    }
    async listAccessibleAccounts(credentials) {
        const seedIds = await this.listAccessibleCustomerIds(credentials.accessToken);
        if (seedIds.length > 500)
            throw new ProviderError("provider_account_limit_exceeded");
        const accounts = new Map();
        const managers = [];
        for (const id of seedIds) {
            const account = await this.getAccountDetails(id, credentials);
            accounts.set(id, account);
            if (account.isManager)
                managers.push(id);
        }
        const visitedManagers = new Set();
        while (managers.length > 0 && accounts.size < 500) {
            const managerId = managers.shift();
            if (!managerId || visitedManagers.has(managerId))
                continue;
            visitedManagers.add(managerId);
            const clients = await this.listManagerChildren(managerId, credentials.accessToken);
            for (const client of clients) {
                const id = client.externalAccountId;
                if (id === managerId)
                    continue;
                if (!accounts.has(id) && accounts.size >= 500)
                    throw new ProviderError("provider_account_limit_exceeded");
                if (!accounts.has(id))
                    accounts.set(id, client);
                if (client.isManager && !visitedManagers.has(id))
                    managers.push(id);
            }
        }
        if (managers.some((managerId) => !visitedManagers.has(managerId))) {
            throw new ProviderError("provider_account_limit_exceeded");
        }
        return [...accounts.values()];
    }
    async getAccountDetails(externalAccountId, credentials, managerReference) {
        const customerId = googleCustomerId(externalAccountId);
        const rows = await this.search(customerId, CUSTOMER_FIELDS_QUERY, credentials.accessToken, managerReference);
        const first = rows[0];
        const customer = isRecord(first) ? first.customer ?? first.customer_client : null;
        if (!isRecord(customer))
            throw new ProviderError("provider_response_invalid");
        return mapCustomer(customer, managerReference ?? null);
    }
    async refreshCredentialsIfSupported(credentials) {
        if (!credentials.expiresAt || credentials.expiresAt > Date.now() + 60_000)
            return credentials;
        if (!credentials.refreshToken)
            return null;
        this.assertConfigured();
        const body = new URLSearchParams({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: "refresh_token",
            refresh_token: credentials.refreshToken,
        });
        const response = record(await requestJson(new URL("https://oauth2.googleapis.com/token"), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }, { fetcher: this.fetcher }));
        const accessToken = response.access_token;
        if (typeof accessToken !== "string" || !accessToken)
            throw new ProviderError("provider_response_invalid");
        return {
            ...credentials,
            accessToken,
            refreshToken: optionalString(response, "refresh_token") ?? credentials.refreshToken,
            expiresAt: numericExpiration(response.expires_in),
            scopes: optionalString(response, "scope")?.split(/\s+/).filter(Boolean) ?? credentials.scopes,
        };
    }
    async verifyConnection(credentials) {
        const refreshed = await this.refreshCredentialsIfSupported(credentials);
        if (!refreshed)
            throw new ProviderError("authorization_expired");
        return this.listAccessibleAccounts(refreshed);
    }
    async revokeAuthorizationIfSupported(credentials) {
        const token = credentials.refreshToken ?? credentials.accessToken;
        const body = new URLSearchParams({ token });
        await requestJson(new URL("https://oauth2.googleapis.com/revoke"), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }, { fetcher: this.fetcher });
        return true;
    }
    async listAccessibleCustomerIds(accessToken) {
        this.assertConfigured();
        const url = new URL(`https://googleads.googleapis.com/${this.config.apiVersion}/customers:listAccessibleCustomers`);
        const response = record(await requestJson(url, {
            method: "GET",
            headers: {
                authorization: `Bearer ${accessToken}`,
                "developer-token": this.config.developerToken,
                "content-type": "application/json",
            },
        }, { retryReadOnly: true, fetcher: this.fetcher }));
        const names = response.resourceNames ?? response.resource_names;
        if (!Array.isArray(names))
            throw new ProviderError("provider_response_invalid");
        return names.map(customerIdFromResourceName);
    }
    async listManagerChildren(managerId, accessToken) {
        const rows = await this.search(managerId, CUSTOMER_CLIENT_QUERY, accessToken, managerId);
        const children = [];
        for (const rowValue of rows) {
            if (!isRecord(rowValue))
                continue;
            const client = rowValue.customerClient ?? rowValue.customer_client;
            if (!isRecord(client))
                continue;
            const resourceName = valueAt(client, "clientCustomer", "client_customer");
            let id;
            try {
                id = customerIdFromResourceName(resourceName);
            }
            catch {
                continue;
            }
            const child = { ...client, id };
            const account = mapCustomer(child, managerId);
            if (account.externalAccountId !== managerId)
                children.push(account);
        }
        return children;
    }
    async search(customerId, query, accessToken, loginCustomerId) {
        const url = new URL(`https://googleads.googleapis.com/${this.config.apiVersion}/customers/${googleCustomerId(customerId)}/googleAds:search`);
        const headers = {
            authorization: `Bearer ${accessToken}`,
            "developer-token": this.config.developerToken,
            "content-type": "application/json",
        };
        if (loginCustomerId)
            headers["login-customer-id"] = googleCustomerId(loginCustomerId);
        const results = [];
        let pageToken = null;
        for (let page = 0; page < 10; page += 1) {
            const body = { query, pageSize: 1000 };
            if (pageToken)
                body.pageToken = pageToken;
            const response = record(await requestJson(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            }, { retryReadOnly: true, fetcher: this.fetcher }));
            if (Array.isArray(response.results))
                results.push(...response.results);
            pageToken = optionalString(response, "nextPageToken") ?? optionalString(response, "next_page_token");
            if (!pageToken)
                return results;
        }
        if (pageToken)
            throw new ProviderError("provider_account_limit_exceeded");
        return results;
    }
    assertConfigured() {
        if (!this.configured)
            throw new ProviderError("provider_not_configured");
    }
}
