import { describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_PREFERENCES, DEFAULT_WORKSPACE_PREFERENCES } from "@ai-ads/shared";
import { getUserPreferences, getWorkspacePreferences, updateUserPreferences, updateWorkspacePreferences, SettingsApiError } from "./settings";

describe("settings API client", () => {
  it("loads personal preferences with a private no-store bearer request", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer account-session");
      expect(init?.cache).toBe("no-store");
      return new Response(JSON.stringify({ preferences: DEFAULT_USER_PREFERENCES }), { status: 200 });
    });
    await expect(getUserPreferences("account-session", fetcher)).resolves.toEqual(DEFAULT_USER_PREFERENCES);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sends a typed personal preference patch without profile or role fields", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(String(init?.body))).toEqual({ themePreference: "dark" });
      return new Response(JSON.stringify({ preferences: { ...DEFAULT_USER_PREFERENCES, themePreference: "dark" } }), { status: 200 });
    });
    const result = await updateUserPreferences("account-session", { themePreference: "dark" }, fetcher);
    expect(result.themePreference).toBe("dark");
  });

  it("rejects invalid workspace defaults before making a request", async () => {
    const fetcher = vi.fn();
    await expect(updateWorkspacePreferences("account-session", "workspace/id", { displayDensity: "giant" } as never, fetcher)).rejects.toBeInstanceOf(SettingsApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("encodes the selected workspace in its defaults lookup", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("workspace%2Fid");
      return new Response(JSON.stringify({ preferences: DEFAULT_WORKSPACE_PREFERENCES }), { status: 200 });
    });
    await expect(getWorkspacePreferences("account-session", "workspace/id", fetcher)).resolves.toEqual(DEFAULT_WORKSPACE_PREFERENCES);
  });

  it("surfaces role denials without exposing access credentials", async () => {
    const token = "private-access-token";
    const fetcher = vi.fn(async () => new Response("{}", { status: 403 }));
    const error = await getUserPreferences(token, fetcher).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(SettingsApiError);
    expect(error).toMatchObject({ status: 403 });
    expect(error instanceof Error ? error.message : "").not.toContain(token);
  });
});
