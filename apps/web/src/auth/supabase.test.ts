import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthService, supabaseClient } from "./supabase";

afterEach(() => localStorage.clear());

describe("Supabase local session cleanup", () => {
  it("clears an invalid session locally without calling Supabase sign-out", async () => {
    const sdkSignOut = vi.fn(async () => ({ error: null }));
    const client = {
      auth: { signOut: sdkSignOut },
    } as unknown as NonNullable<typeof supabaseClient>;
    const service = createAuthService(client, "sb-test-auth-token");
    localStorage.setItem("sb-test-auth-token", "stale session");

    await service.clearLocalSession();

    expect(localStorage.getItem("sb-test-auth-token")).toBeNull();
    expect(sdkSignOut).not.toHaveBeenCalled();

    localStorage.setItem("sb-test-auth-token", "session to sign out");
    await service.signOut();
    expect(localStorage.getItem("sb-test-auth-token")).toBeNull();
    expect(sdkSignOut).toHaveBeenCalledOnce();
    expect(sdkSignOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
