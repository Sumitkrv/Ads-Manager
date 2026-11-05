import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import test from "node:test";
import { createAdvertisingIntegrationsRouter, type IntegrationRouteDependencies } from "./integrations/routes.js";
import { CredentialCipher } from "./integrations/credentials/credential-cipher.js";
import { GoogleAdsProvider } from "./integrations/providers/google-ads.js";
import { MetaAdsProvider } from "./integrations/providers/meta-ads.js";
import { ProviderError, type AdvertisingProviderAdapter } from "./integrations/providers/types.js";
import type { IntegrationUserRepository } from "./integrations/repository.js";
import type { TokenVerifier } from "./auth.js";
import { config, type ApiConfig } from "./config.js";
import { HttpError } from "./errors.js";

const userId = "6bfc5b42-a6bb-4be7-9163-71a61c740a4e";
const workspaceId = "21000000-0000-4000-8000-000000000001";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function mockAdapter(overrides: Partial<AdvertisingProviderAdapter> = {}): AdvertisingProviderAdapter {
  const adapter: AdvertisingProviderAdapter = {
    id: "google_ads",
    displayName: "Google Ads",
    requiredConfiguration: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_REDIRECT_URI", "SUPABASE_SERVICE_ROLE_KEY", "INTEGRATION_CREDENTIAL_KEYS_JSON"],
    requestedScopes: ["https://www.googleapis.com/auth/adwords"],
    configured: true,
    createAuthorization: ({ state }) => ({
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`,
      pkceVerifier: "test-pkce-verifier-value",
    }),
    exchangeAuthorizationCode: async () => ({
      accessToken: "fixture-access-token",
      refreshToken: "fixture-refresh-token",
      expiresAt: Date.now() + 3_600_000,
      scopes: ["https://www.googleapis.com/auth/adwords"],
      identityReference: null,
    }),
    validateAuthorization: async (credentials) => ({ ...credentials, identityReference: "provider-user-id" }),
    listAccessibleAccounts: async () => [],
    getAccountDetails: async () => ({
      externalAccountId: "1234567890", name: "Fixture account", accountStatus: "ENABLED",
      currency: "USD", timezone: "UTC", isManager: false, managerReference: null, businessContext: null,
    }),
    refreshCredentialsIfSupported: async (credentials) => credentials,
    verifyConnection: async () => [],
    revokeAuthorizationIfSupported: async () => false,
  };
  return Object.assign(adapter, overrides);
}

function configuredApi(cipherKey: Buffer): ApiConfig {
  return {
    ...config,
    // Exercise the retained route flow with injected mocks only. The app runtime
    // remains hard-fixed to demo mode in this milestone.
    ADS_EXECUTION_MODE: "live",
    SUPABASE_URL: "https://database.example.invalid",
    SUPABASE_PUBLISHABLE_KEY: "public-key-fixture",
    SUPABASE_SERVICE_ROLE_KEY: "server-key-fixture",
    INTEGRATIONS_APP_RETURN_URL: "https://app.example.invalid/app/integrations",
    INTEGRATION_CREDENTIAL_ACTIVE_KEY_VERSION: "v1",
    INTEGRATION_CREDENTIAL_KEYS_JSON: JSON.stringify({ v1: cipherKey.toString("base64") }),
    GOOGLE_ADS_CLIENT_ID: "google-client-fixture",
    GOOGLE_ADS_CLIENT_SECRET: "google-secret-fixture",
    GOOGLE_ADS_DEVELOPER_TOKEN: "google-developer-token-fixture",
    GOOGLE_ADS_REDIRECT_URI: "https://api.example.invalid/api/integrations/google_ads/callback",
  } as unknown as ApiConfig;
}

async function requestWithRouter<T>(
  dependencies: IntegrationRouteDependencies,
  apiConfig: ApiConfig,
  run: (baseUrl: string) => Promise<T>,
) {
  const app = express();
  app.use(express.json());
  const verifier: TokenVerifier = async (token) => token === "user-access-fixture"
    ? { status: "verified", user: { id: userId, email: null, emailConfirmedAt: null, createdAt: "2026-01-01T00:00:00.000Z" } }
    : { status: "invalid" };
  app.use(createAdvertisingIntegrationsRouter(apiConfig, verifier, dependencies));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      response.status(error.statusCode).json({ status: "error", error: { code: error.code, message: error.message } });
      return;
    }
    response.status(500).json({ status: "error", error: { code: "internal_error", message: "Unexpected error." } });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function fakeUserRepository(role: string, starts: Array<Record<string, unknown>> = []): IntegrationUserRepository {
  return {
    getRole: async () => role,
    list: async () => ({ connections: [], accounts: [] }),
    getConnection: async () => null,
    startAttempt: async (input) => { starts.push(input); },
    selectAccounts: async () => undefined,
    unlink: async () => undefined,
  };
}

test("credential encryption binds ciphertext to workspace, record and purpose", () => {
  const cipher = new CredentialCipher("v1", new Map([["v1", Buffer.alloc(32, 5)]]));
  const context = { workspaceId, recordId: "31000000-0000-4000-8000-000000000001", provider: "google_ads" as const, purpose: "provider_credentials" as const };
  const encrypted = cipher.encrypt("short-lived-fixture-secret", context);
  assert.notEqual(encrypted.ciphertext, "short-lived-fixture-secret");
  assert.equal(cipher.decrypt(encrypted, context), "short-lived-fixture-secret");
  assert.throws(() => cipher.decrypt(encrypted, { ...context, workspaceId: "21000000-0000-4000-8000-000000000002" }));
  assert.throws(() => cipher.decrypt(encrypted, { ...context, recordId: "31000000-0000-4000-8000-000000000002" }));
  assert.throws(() => cipher.decrypt(encrypted, { ...context, purpose: "oauth_pkce_verifier" }));
  const [nonce, tag, encodedBody] = encrypted.ciphertext.split(".");
  const body = Buffer.from(encodedBody ?? "", "base64url");
  body[0] = (body[0] ?? 0) ^ 1;
  const tampered = { ...encrypted, ciphertext: `${nonce}.${tag}.${body.toString("base64url")}` };
  assert.throws(() => cipher.decrypt(tampered, context));
});

test("credential cipher can read an old key version and write with the active rotation key", () => {
  const keyOne = Buffer.alloc(32, 1);
  const keyTwo = Buffer.alloc(32, 2);
  const context = { workspaceId, recordId: "31000000-0000-4000-8000-000000000002", provider: "meta_ads" as const, purpose: "provider_credentials" as const };
  const originalCipher = new CredentialCipher("v1", new Map([["v1", keyOne]]));
  const oldValue = originalCipher.encrypt("fixture-credential", context);
  const rotatedCipher = new CredentialCipher("v2", new Map([["v1", keyOne], ["v2", keyTwo]]));
  assert.equal(rotatedCipher.decrypt(oldValue, context), "fixture-credential");
  const rotatedValue = rotatedCipher.encrypt("fixture-credential", context);
  assert.equal(rotatedValue.keyVersion, "v2");
  assert.equal(rotatedCipher.decrypt(rotatedValue, context), "fixture-credential");
});

test("Google Ads discovery handles no accounts and uses the configured API version", async () => {
  const urls: string[] = [];
  const provider = new GoogleAdsProvider({
    clientId: "client", clientSecret: "secret", developerToken: "developer-token",
    redirectUri: "https://api.example.invalid/google/callback", apiVersion: "v26",
  }, async (input) => {
    urls.push(String(input));
    return jsonResponse({ resourceNames: [] });
  });
  const accounts = await provider.listAccessibleAccounts({
    accessToken: "fixture-token", refreshToken: "fixture-refresh", expiresAt: Date.now() + 60_000,
    scopes: ["https://www.googleapis.com/auth/adwords"], identityReference: null,
  });
  assert.deepEqual(accounts, []);
  assert.equal(urls.length, 1);
  assert.match(urls[0] ?? "", /\/v26\/customers:listAccessibleCustomers$/);
});

test("Google Ads discovery traverses manager accounts, paginates results and retains returned metadata", async () => {
  const requestLog: Array<{ url: string; headers: Headers; query: string; pageToken: string | null }> = [];
  const provider = new GoogleAdsProvider({
    clientId: "client", clientSecret: "secret", developerToken: "developer-token",
    redirectUri: "https://api.example.invalid/google/callback", apiVersion: "v26",
  }, async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as { query: string; pageToken?: string } : { query: "" };
    const query = body.query;
    requestLog.push({ url: url.toString(), headers, query, pageToken: body.pageToken ?? null });
    if (url.pathname.endsWith("customers:listAccessibleCustomers")) {
      return jsonResponse({ resourceNames: ["customers/1111111111"] });
    }
    if (query.includes("customer_client")) {
      const customer = url.pathname.match(/customers\/(\d+)/)?.[1];
      if (customer === "1111111111" && body.pageToken) return jsonResponse({ results: [] });
      const children = customer === "1111111111"
        ? [
            { clientCustomer: "customers/2222222222", id: "2222222222", descriptiveName: "Search Manager", manager: true, status: "ENABLED" },
            { clientCustomer: "customers/3333333333", id: "3333333333", descriptiveName: "Retail Account", manager: false, status: "ENABLED", currencyCode: "USD", timeZone: "America/New_York" },
          ]
        : [{ clientCustomer: "customers/4444444444", id: "4444444444", descriptiveName: "Search Campaigns", manager: false, status: "ENABLED" }];
      return jsonResponse({ results: children.map((customerClient) => ({ customerClient })), ...(customer === "1111111111" ? { nextPageToken: "manager-page-2" } : {}) });
    }
    return jsonResponse({ results: [{ customer: { id: "1111111111", descriptiveName: "Northstar Manager", manager: true, status: "ENABLED", currencyCode: "USD", timeZone: "UTC" } }] });
  });
  const accounts = await provider.listAccessibleAccounts({
    accessToken: "fixture-token", refreshToken: "fixture-refresh", expiresAt: Date.now() + 60_000,
    scopes: ["https://www.googleapis.com/auth/adwords"], identityReference: null,
  });
  assert.deepEqual(accounts.map((account) => account.externalAccountId), ["1111111111", "2222222222", "3333333333", "4444444444"]);
  assert.equal(accounts[2]?.currency, "USD");
  assert.equal(accounts[2]?.timezone, "America/New_York");
  assert.equal(accounts[1]?.managerReference, "1111111111");
  assert.equal(requestLog.some((entry) => entry.headers.get("login-customer-id") === "1111111111"), true);
  assert.equal(requestLog.some((entry) => entry.url.includes("/v26/")), true);
  assert.equal(requestLog.some((entry) => entry.pageToken === "manager-page-2"), true);
});

test("Meta authorization asks only for ads_read and account discovery parses provider responses", async () => {
  const seen: Array<{ url: URL; headers: Headers }> = [];
  const provider = new MetaAdsProvider({ appId: "app-id", appSecret: "app-secret", redirectUri: "https://api.example.invalid/meta/callback", graphApiVersion: "v26.0" }, async (input, init) => {
    const url = new URL(String(input));
    seen.push({ url, headers: new Headers(init?.headers) });
    return jsonResponse({ data: [{ id: "act_987654321", account_id: "987654321", name: "Meta Retail", account_status: 1, currency: "EUR", timezone_name: "Europe/Paris", business_name: "Retail Group" }] });
  });
  const authorization = provider.createAuthorization({ state: "random-state-fixture-value", redirectUri: "https://api.example.invalid/meta/callback" });
  const authorizationUrl = new URL(authorization.authorizationUrl);
  assert.equal(authorizationUrl.searchParams.get("scope"), "ads_read");
  assert.equal(authorizationUrl.searchParams.has("ads_management"), false);
  const accounts = await provider.listAccessibleAccounts({
    accessToken: "fixture-token", refreshToken: null, expiresAt: Date.now() + 60_000,
    scopes: ["ads_read"], identityReference: "meta-user-id",
  });
  assert.equal(accounts.length, 1);
  assert.deepEqual(accounts[0], {
    externalAccountId: "987654321", name: "Meta Retail", accountStatus: "1", currency: "EUR",
    timezone: "Europe/Paris", isManager: null, managerReference: null, businessContext: "Retail Group",
  });
  assert.equal(seen[0]?.url.pathname, "/v26.0/me/adaccounts");
  assert.equal(seen[0]?.headers.get("authorization"), "Bearer fixture-token");
});

test("Meta authorization rejects users who did not grant ads_read", async () => {
  const provider = new MetaAdsProvider({ appId: "app-id", appSecret: "app-secret", redirectUri: "https://api.example.invalid/meta/callback", graphApiVersion: "v26.0" }, async (input) => {
    const path = new URL(String(input)).pathname;
    return path.endsWith("/me") ? jsonResponse({ id: "meta-user-id" }) : jsonResponse({ data: [{ permission: "ads_read", status: "declined" }] });
  });
  await assert.rejects(() => provider.validateAuthorization({
    accessToken: "fixture-token", refreshToken: null, expiresAt: Date.now() + 60_000, scopes: [], identityReference: null,
  }), (error: unknown) => error instanceof ProviderError && error.code === "provider_permission_required");
});

test("provider integrations block OAuth initiation before membership or provider logic", async () => {
  let startCalled = false;
  const dependencies: IntegrationRouteDependencies = {
    userRepositoryFactory: () => ({
      ...fakeUserRepository("viewer"),
      startAttempt: async () => { startCalled = true; },
    }),
    callbackRepositoryFactory: () => null,
  };
  const response = await requestWithRouter(dependencies, config, (baseUrl) => fetch(
    `${baseUrl}/api/workspaces/${workspaceId}/integrations/google_ads/start`,
    { method: "POST", headers: { authorization: "Bearer user-access-fixture", "content-type": "application/json" }, body: "{}" },
  ));
  const body = await response.json() as { error?: { code?: string; message?: string } };
  assert.equal(response.status, 409);
  assert.equal(body.error?.code, "provider_integrations_disabled");
  assert.equal(startCalled, false);
  assert.equal(JSON.stringify(body).includes("fixture"), false);
});

test("provider integrations block callbacks before reading state or invoking privileged repositories", async () => {
  let repositoryRequested = false;
  const dependencies: IntegrationRouteDependencies = {
    callbackRepositoryFactory: () => { repositoryRequested = true; return null; },
  };
  const response = await requestWithRouter(dependencies, config, (baseUrl) => fetch(
    `${baseUrl}/api/integrations/google_ads/callback?error=access_denied`,
  ));
  const body = await response.json() as { error?: { code?: string } };
  assert.equal(response.status, 409);
  assert.equal(body.error?.code, "provider_integrations_disabled");
  assert.equal(repositoryRequested, false);
});

test("provider transports stay disabled even when live credentials are configured", async () => {
  let repositoryRequested = false;
  let providerCall = false;
  const key = Buffer.alloc(32, 42);
  const dependencies: IntegrationRouteDependencies = {
    userRepositoryFactory: () => { repositoryRequested = true; return fakeUserRepository("owner"); },
    callbackRepositoryFactory: () => { repositoryRequested = true; return null; },
    providerSet: {
      google_ads: mockAdapter({ createAuthorization: () => { providerCall = true; throw new Error("must remain disabled"); } }),
      meta_ads: mockAdapter({ id: "meta_ads", displayName: "Meta Ads", createAuthorization: () => { providerCall = true; throw new Error("must remain disabled"); } }),
    },
    fetcher: async () => { providerCall = true; throw new Error("must remain disabled"); },
  };
  await requestWithRouter(dependencies, configuredApi(key), async (baseUrl) => {
    const start = await fetch(`${baseUrl}/api/workspaces/${workspaceId}/integrations/google_ads/start`, {
      method: "POST", headers: { authorization: "Bearer user-access-fixture", "content-type": "application/json" }, body: "{}",
    });
    assert.equal(start.status, 409);
    assert.equal((await start.json() as { error: { code: string } }).error.code, "provider_integrations_disabled");
    const callback = await fetch(`${baseUrl}/api/integrations/google_ads/callback?state=${"a".repeat(43)}&code=synthetic-code`);
    assert.equal(callback.status, 409);
  });
  assert.equal(repositoryRequested, false);
  assert.equal(providerCall, false);
});
