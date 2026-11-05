import { MeResponseSchema, type MeResponse } from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function getCurrentUser(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<MeResponse> {
  let response: Response;
  try {
    response = await fetcher(apiBaseUrl + "/api/me", {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + accessToken,
      },
    });
  } catch {
    throw new ApiRequestError(0, "The API could not be reached.");
  }

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      response.status === 401
        ? "This session could not be verified. Sign in again to continue."
        : response.status === 503
          ? "Authentication verification is temporarily unavailable."
          : "The API request could not be completed.",
    );
  }

  const parsed = MeResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new ApiRequestError(502, "The API returned an invalid response.");
  return parsed.data;
}
