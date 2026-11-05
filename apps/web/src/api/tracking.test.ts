import { describe, expect, it, vi } from "vitest";
import { getTrackingOverview, trackingRequest, TrackingApiError } from "./tracking";

const workspaceId = "21000000-0000-4000-8000-000000000001";

describe("tracking API client", () => {
  it("scopes requests to the selected workspace and forwards the user JWT", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(`/api/workspaces/${workspaceId}/tracking/overview`);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer user-session-token");
      expect(init?.cache).toBe("no-store");
      return new Response(JSON.stringify({ workspaceId, externalConnectionsEnabled: false }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const result = await getTrackingOverview("user-session-token", workspaceId, fetcher);
    expect(result.externalConnectionsEnabled).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not include credentials in safe API errors", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Your workspace role cannot perform this tracking action." } }), { status: 403 }));
    await expect(trackingRequest("private-fixture-token", workspaceId, "/goals", {}, fetcher)).rejects.toMatchObject({ status: 403, message: "Your workspace role cannot perform this tracking action." });
    try { await trackingRequest("private-fixture-token", workspaceId, "/goals", {}, fetcher); }
    catch (error) { expect(error).toBeInstanceOf(TrackingApiError); expect(String(error)).not.toContain("private-fixture-token"); }
  });
});
