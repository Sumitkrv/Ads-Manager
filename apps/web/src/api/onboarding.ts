import {
  OnboardingApiResponseSchema, ProductTourProgressApiResponseSchema, RecordOnboardingEventResponseSchema,
  UserOnboardingPreferencesInputSchema, WorkspaceActivationResponseSchema, WorkspaceOnboardingApiResponseSchema,
  WorkspaceOnboardingPatchSchema, type UserOnboardingPreferencesInput,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export class OnboardingApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "OnboardingApiError"; }
}
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

async function request<T>(path: string, token: string, schema: Schema<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch { throw new OnboardingApiError(0, "The onboarding service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new OnboardingApiError(response.status, "The onboarding service returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      && typeof payload.error === "object" && payload.error !== null && "message" in payload.error
      && typeof payload.error.message === "string" ? payload.error.message : "The onboarding request could not be completed.";
    throw new OnboardingApiError(response.status, message);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new OnboardingApiError(502, "The onboarding service returned an invalid response.");
  return parsed.data;
}
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
function workspacePath(workspaceId: string, suffix: string) {
  return "/api/workspaces/" + encodeURIComponent(workspaceId) + "/" + suffix;
}

export async function getUserOnboarding(token: string) {
  return (await request("/api/me/onboarding", token, OnboardingApiResponseSchema)).preferences;
}
export async function saveUserOnboarding(token: string, input: UserOnboardingPreferencesInput) {
  const parsed = UserOnboardingPreferencesInputSchema.parse(input);
  return (await request("/api/me/onboarding", token, OnboardingApiResponseSchema, json("PATCH", parsed))).preferences;
}
export async function getWorkspaceOnboarding(token: string, workspaceId: string) {
  return (await request(workspacePath(workspaceId, "onboarding"), token, WorkspaceOnboardingApiResponseSchema)).onboarding;
}
export async function saveWorkspaceOnboarding(token: string, workspaceId: string, input: unknown) {
  const parsed = WorkspaceOnboardingPatchSchema.parse(input);
  return (await request(workspacePath(workspaceId, "onboarding"), token, WorkspaceOnboardingApiResponseSchema, json("PATCH", parsed))).onboarding;
}
export async function getWorkspaceActivation(token: string, workspaceId: string) {
  return request(workspacePath(workspaceId, "activation"), token, WorkspaceActivationResponseSchema);
}
export async function recordActivationEvent(token: string, workspaceId: string, eventKey: "demo_mode_reviewed" | "report_viewed") {
  return request(workspacePath(workspaceId, "activation/events"), token, RecordOnboardingEventResponseSchema, json("POST", { eventKey }));
}
export async function getProductTourProgress(token: string, workspaceId: string) {
  const query = new URLSearchParams({ workspaceId });
  return (await request("/api/me/product-tours?" + query, token, ProductTourProgressApiResponseSchema)).progress;
}
export async function saveProductTourProgress(
  token: string,
  input: { tourId: string; workspaceId: string; stepIndex: number; status: "running" | "skipped" | "completed" },
) {
  return (await request("/api/me/product-tours/" + encodeURIComponent(input.tourId) + "/progress", token, ProductTourProgressApiResponseSchema, json("POST", input))).progress[0];
}
