import { describe, expect, it, vi } from "vitest";
import { createWorkspace, getWorkspaces, updateWorkspace, WorkspaceApiError } from "./workspaces";

const workspace = {
  id: "21000000-0000-4000-8000-000000000001",
  name: "Northstar Studio",
  slug: "northstar-studio",
  industryKey: "professional_services",
  industryCustomLabel: null,
  websiteUrl: null,
  countryCode: "US",
  timezone: "America/New_York",
  logoUrl: null,
  createdBy: "6bfc5b42-a6bb-4be7-9163-71a61c740a4e",
  createdAt: "2026-10-27T12:00:00.000Z",
  updatedAt: "2026-10-27T12:00:00.000Z",
};

describe("workspace API client", () => {
  it("scopes workspace discovery to the authenticated bearer token", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer user-access-token");
      expect(init?.cache).toBe("no-store");
      return new Response(JSON.stringify({ workspaces: [{ ...workspace, role: "owner" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await getWorkspaces("user-access-token", fetcher);
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0]?.id).toBe(workspace.id);
  });

  it("sends workspace creation input to the authenticated API", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer user-access-token");
      return new Response(JSON.stringify({ workspace, role: "owner" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await createWorkspace("user-access-token", {
      requestId: "41000000-0000-4000-8000-000000000001",
      name: "Northstar Studio",
      slug: "northstar-studio",
      industryKey: "professional_services",
      industryCustomLabel: null,
      websiteUrl: null,
      countryCode: "US",
      timezone: "America/New_York",
    }, fetcher);
    expect(result.workspace.id).toBe(workspace.id);
    expect(result.role).toBe("owner");
  });

  it("rejects forged role fields before making a settings request", async () => {
    const fetcher = vi.fn();
    expect(() => updateWorkspace("user-access-token", workspace.id, { role: "owner" } as never, fetcher))
      .toThrow(WorkspaceApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("turns a server role denial into a safe client error", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 403 }));
    const error = await updateWorkspace("private-token", workspace.id, { name: "Updated Studio" }, fetcher)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WorkspaceApiError);
    expect(error).toMatchObject({ status: 403 });
    expect(error instanceof Error ? error.message : "").not.toContain("private-token");
  });
});
