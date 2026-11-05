import { describe, expect, it, vi } from "vitest";
import {
  getAdvertisingIntegrations,
  selectAdvertisingAccounts,
  startAdvertisingConnection,
  IntegrationApiError,
} from "./integrations";

const workspaceId = "21000000-0000-4000-8000-000000000001";
const response = {
  workspaceId,
  role: "viewer",
  canManage: false,
  providers: [
    { provider: "google_ads", displayName: "Google Ads", configured: false, setupRequirements: ["GOOGLE_ADS_CLIENT_ID"], connection: null, accounts: [] },
    { provider: "meta_ads", displayName: "Meta Ads", configured: false, setupRequirements: ["META_APP_ID"], connection: null, accounts: [] },
  ],
};

describe("advertising integration API client", () => {
  it("requests the active workspace's persisted provider state with the user bearer token", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(`/api/workspaces/${workspaceId}/integrations`);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer member-access-token");
      expect(init?.cache).toBe("no-store");
      return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
    });
    const result = await getAdvertisingIntegrations("member-access-token", workspaceId, fetcher);
    expect(result.workspaceId).toBe(workspaceId);
    expect(result.providers.map((provider) => provider.provider)).toEqual(["google_ads", "meta_ads"]);
    expect(result.providers.every((provider) => provider.connection === null && provider.accounts.length === 0)).toBe(true);
  });

  it("starts authorization without sending roles or return destinations", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe("{}");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer owner-access-token");
      return new Response(JSON.stringify({ authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=fixture-state" }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const result = await startAdvertisingConnection("owner-access-token", workspaceId, "google_ads", fetcher);
    expect(new URL(result.authorizationUrl).hostname).toBe("accounts.google.com");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate account selection ids before making a request", async () => {
    const fetcher = vi.fn();
    expect(() => selectAdvertisingAccounts(
      "owner-access-token", workspaceId, "31000000-0000-4000-8000-000000000001",
      ["41000000-0000-4000-8000-000000000001", "41000000-0000-4000-8000-000000000001"], fetcher,
    )).toThrow(IntegrationApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps role denial messages safe", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Your workspace role cannot perform this integration action." } }), { status: 403 }));
    const error = await getAdvertisingIntegrations("secret-fixture-token", workspaceId, fetcher).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IntegrationApiError);
    expect(error).toMatchObject({ status: 403 });
    expect(error instanceof Error ? error.message : "").not.toContain("secret-fixture-token");
  });
});
