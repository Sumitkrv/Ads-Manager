import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { HealthResponseSchema, MeResponseSchema } from "@ai-ads/shared";
import type { Express } from "express";
import type { AuthenticatedApiUser, TokenVerifier } from "./auth.js";
import { createApp } from "./app.js";
import { config } from "./config.js";

const testUser: AuthenticatedApiUser = {
  id: "6bfc5b42-a6bb-4be7-9163-71a61c740a4e",
  email: "person@example.invalid",
  emailConfirmedAt: "2026-01-02T03:04:05.000Z",
  createdAt: "2026-01-02T03:04:05.000Z",
};

const validTestVerifier: TokenVerifier = async (token) =>
  token === "verified-test-access-token"
    ? { status: "verified", user: testUser }
    : { status: "invalid" };

async function requestWithServer<T>(
  app: Express,
  run: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    return await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("GET /api/health returns a validated service response", async (context) => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch("http://127.0.0.1:" + address.port + "/api/health");
  const payload: unknown = await response.json();
  const parsed = HealthResponseSchema.safeParse(payload);

  assert.equal(response.status, 200);
  assert.equal(parsed.success, true);

  if (parsed.success) {
    assert.equal(parsed.data.status, "ok");
    assert.equal(parsed.data.service, "ai-ads-api");
    assert.ok(parsed.data.version.length > 0);
  }
});

test("API rejects browser origins outside its allowlist", async (context) => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    "http://127.0.0.1:" + address.port + "/api/health",
    { headers: { origin: "https://unapproved.example" } },
  );
  const payload = (await response.json()) as { error?: { code?: string } };

  assert.equal(response.status, 403);
  assert.equal(payload.error?.code, "origin_not_allowed");
});

test("GET /api/me rejects requests without a bearer token", async () => {
  let verifierCalled = false;
  const verifier: TokenVerifier = async () => {
    verifierCalled = true;
    return { status: "verified", user: testUser };
  };

  const response = await requestWithServer(createApp(config, verifier), (baseUrl) =>
    fetch(baseUrl + "/api/me"),
  );
  const payload = (await response.json()) as { error?: { code?: string } };

  assert.equal(response.status, 401);
  assert.equal(payload.error?.code, "authentication_required");
  assert.equal(verifierCalled, false);
});

test("GET /api/me rejects invalid bearer tokens", async () => {
  const response = await requestWithServer(createApp(config, validTestVerifier), (baseUrl) =>
    fetch(baseUrl + "/api/me", { headers: { authorization: "Bearer invalid-token" } }),
  );
  const payload = (await response.json()) as { error?: { code?: string } };

  assert.equal(response.status, 401);
  assert.equal(payload.error?.code, "invalid_bearer_token");
});

test("GET /api/me returns only the user fields from a verified auth result", async () => {
  const response = await requestWithServer(createApp(config, validTestVerifier), (baseUrl) =>
    fetch(baseUrl + "/api/me", {
      headers: { authorization: "Bearer verified-test-access-token" },
    }),
  );
  const parsed = MeResponseSchema.safeParse(await response.json());

  assert.equal(response.status, 200);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.user.id, testUser.id);
    assert.equal(parsed.data.user.email, testUser.email);
    assert.equal(parsed.data.user.emailConfirmedAt, testUser.emailConfirmedAt);
    assert.deepEqual(Object.keys(parsed.data.user).sort(), [
      "createdAt",
      "email",
      "emailConfirmedAt",
      "id",
    ]);
  }
});

test("GET /api/me handles verification outages without leaking provider details", async () => {
  const verifier: TokenVerifier = async () => ({ status: "unavailable" });
  const response = await requestWithServer(createApp(config, verifier), (baseUrl) =>
    fetch(baseUrl + "/api/me", {
      headers: { authorization: "Bearer verified-test-access-token" },
    }),
  );
  const payload = (await response.json()) as {
    error?: { code?: string; message?: string };
  };

  assert.equal(response.status, 503);
  assert.equal(payload.error?.code, "auth_verification_unavailable");
  assert.equal(payload.error?.message, "Authentication could not be verified right now.");
  assert.equal(JSON.stringify(payload).includes("verified-test-access-token"), false);
});

test("GET /api/me safely handles a thrown token-verification error", async () => {
  const verifier: TokenVerifier = async () => {
    throw new Error("private provider diagnostic");
  };
  const response = await requestWithServer(createApp(config, verifier), (baseUrl) =>
    fetch(baseUrl + "/api/me", {
      headers: { authorization: "Bearer verified-test-access-token" },
    }),
  );
  const body = await response.text();

  assert.equal(response.status, 503);
  assert.equal(body.includes("private provider diagnostic"), false);
});

test("demo mode blocks provider OAuth callbacks even when the route is reached", async () => {
  const response = await requestWithServer(createApp(config, validTestVerifier), (baseUrl) =>
    fetch(baseUrl + "/api/integrations/google_ads/callback?code=discarded&state=discarded"),
  );
  const payload = (await response.json()) as { error?: { code?: string } };
  assert.equal(response.status, 409);
  assert.equal(payload.error?.code, "provider_integrations_disabled");
});

test("campaign endpoints require an authenticated session and create no sample data", async () => {
  const response = await requestWithServer(createApp(config, validTestVerifier), (baseUrl) =>
    fetch(baseUrl + "/api/workspaces/62000000-0000-4000-8000-000000000001/campaigns"),
  );
  const payload = (await response.json()) as { error?: { code?: string } };
  assert.equal(response.status, 401);
  assert.equal(payload.error?.code, "authentication_required");
});
