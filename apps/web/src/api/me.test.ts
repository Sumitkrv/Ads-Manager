import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, getCurrentUser } from "./me";

describe("authenticated API client", () => {
  it("sends the Supabase access token as a bearer token", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer verified-access-token");
      return new Response(
        JSON.stringify({
          user: {
            id: "6bfc5b42-a6bb-4be7-9163-71a61c740a4e",
            email: "person@example.invalid",
            emailConfirmedAt: null,
            createdAt: "2026-01-02T03:04:05.000Z",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const response = await getCurrentUser("verified-access-token", fetcher);
    expect(response.user.id).toBe("6bfc5b42-a6bb-4be7-9163-71a61c740a4e");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("handles an expired or rejected session without exposing the token", async () => {
    const accessToken = "private-test-token";
    const fetcher = vi.fn(async () => new Response("{}", { status: 401 }));
    const error = await getCurrentUser(accessToken, fetcher).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 401 });
    expect(error instanceof Error ? error.message : "").not.toContain(accessToken);
  });

  it("reports API outages as a temporary unavailable state", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 503 }));
    await expect(getCurrentUser("verified-access-token", fetcher)).rejects.toBeInstanceOf(ApiRequestError);
    await expect(getCurrentUser("verified-access-token", fetcher)).rejects.toThrow(
      "Authentication verification is temporarily unavailable.",
    );
  });
});
