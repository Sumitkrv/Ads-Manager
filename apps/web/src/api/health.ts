import {
  HealthResponseSchema,
  type HealthResponse,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(apiBaseUrl + "/api/health", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("The API returned an unsuccessful health response.");
  }

  const parsed = HealthResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("The API returned an invalid health response.");
  }

  return parsed.data;
}
