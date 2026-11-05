import {
  CampaignActionResponseSchema, CampaignListQuerySchema, CampaignListResponseSchema,
  CampaignResponseSchema, CampaignValidationResponseSchema, CampaignWriteSchema,
  type CampaignBrief, type CampaignRecord, type CampaignSummary,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
// Keep UI generation offline in Prompt 14 even when an external key is present.
export const campaignGenerationMode = "simulation";
export class CampaignApiError extends Error {
  constructor(readonly status: number, message: string, readonly payload?: unknown) { super(message); this.name = "CampaignApiError"; }
}
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };
async function request<T>(path: string, token: string, schema: Schema<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, { ...init, cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  } catch { throw new CampaignApiError(0, "The campaign service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new CampaignApiError(response.status, "The campaign service returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "The campaign request could not be completed.";
    throw new CampaignApiError(response.status, message, payload);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new CampaignApiError(502, "The campaign service returned an invalid response.");
  return parsed.data;
}
function root(workspaceId: string) { return `/api/workspaces/${encodeURIComponent(workspaceId)}/campaigns`; }
function idPath(workspaceId: string, campaignId: string) { return `${root(workspaceId)}/${encodeURIComponent(campaignId)}`; }
const json = (method: string, value: unknown): RequestInit => ({ method, body: JSON.stringify(value) });

export async function listCampaigns(token: string, workspaceId: string, params: Record<string, unknown> = {}) {
  const query = CampaignListQuerySchema.parse(params);
  const qs = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request(`${root(workspaceId)}?${qs}`, token, CampaignListResponseSchema);
}
export async function getCampaign(token: string, workspaceId: string, campaignId: string): Promise<CampaignRecord> {
  return (await request(idPath(workspaceId, campaignId), token, CampaignResponseSchema)).campaign;
}
export async function createCampaign(token: string, workspaceId: string, input: { name: string; platform: "google_ads" | "meta_ads"; objective: string; brief: CampaignBrief; plan: null }) {
  const parsed = CampaignWriteSchema.parse(input);
  return (await request(root(workspaceId), token, CampaignResponseSchema, json("POST", parsed))).campaign;
}
export async function saveCampaign(token: string, workspaceId: string, campaignId: string, input: { name: string; platform: "google_ads" | "meta_ads"; objective: string; brief: CampaignBrief; plan: CampaignRecord["plan"]; expectedRevision: number }) {
  const parsed = CampaignWriteSchema.parse(input);
  return (await request(idPath(workspaceId, campaignId), token, CampaignResponseSchema, json("PATCH", parsed))).campaign;
}
export async function generateCampaignDemo(token: string, workspaceId: string, campaignId: string, seed?: number) {
  const result = await request(idPath(workspaceId, campaignId) + "/generate-demo", token, CampaignResponseSchema, json("POST", { idempotencyKey: crypto.randomUUID(), ...(seed === undefined ? {} : { seed }) }));
  return result.campaign;
}
export async function generateCampaignOpenAI(token: string, workspaceId: string, campaignId: string) {
  const result = await request(idPath(workspaceId, campaignId) + "/generate-openai", token, CampaignResponseSchema, json("POST", {
    idempotencyKey: crypto.randomUUID(),
    consentToExternalProcessing: true,
  }));
  return result.campaign;
}
export async function validateCampaignDraft(token: string, workspaceId: string, campaignId: string) {
  return request(idPath(workspaceId, campaignId) + "/validate", token, CampaignValidationResponseSchema, json("POST", {}));
}
export async function submitCampaignReview(token: string, workspaceId: string, campaignId: string, comments = "") {
  return (await request(idPath(workspaceId, campaignId) + "/submit-review", token, CampaignResponseSchema, json("POST", { comments }))).campaign;
}
export async function decideCampaignReview(token: string, workspaceId: string, campaignId: string, action: "approve-demo" | "request-changes" | "reopen", comments = "") {
  return (await request(idPath(workspaceId, campaignId) + `/${action}`, token, CampaignResponseSchema, json("POST", { comments }))).campaign;
}
export async function duplicateCampaign(token: string, workspaceId: string, campaignId: string, name: string) {
  return (await request(idPath(workspaceId, campaignId) + "/duplicate", token, CampaignResponseSchema, json("POST", { name }))).campaign;
}
export async function archiveCampaign(token: string, workspaceId: string, campaignId: string) {
  return (await request(idPath(workspaceId, campaignId) + "/archive", token, CampaignResponseSchema, json("POST", {}))).campaign;
}
export async function simulatePublish(token: string, workspaceId: string, campaignId: string, scenario: "success" | "provider_unavailable", metricsScenario = "average") {
  return request(idPath(workspaceId, campaignId) + "/simulate-publish", token, CampaignActionResponseSchema, json("POST", { scenario, scenarioMetrics: metricsScenario }));
}
export async function getCampaignActivity(token: string, workspaceId: string, campaignId: string) {
  return request(idPath(workspaceId, campaignId) + "/activity", token, { safeParse: (value: unknown) => value && typeof value === "object" && "activity" in value ? { success: true as const, data: value as { activity: Array<Record<string, unknown>> } } : { success: false as const } });
}
export async function getCampaignReviews(token: string, workspaceId: string, campaignId: string) {
  return request(idPath(workspaceId, campaignId) + "/reviews", token, { safeParse: (value: unknown) => value && typeof value === "object" && "reviews" in value ? { success: true as const, data: value as { reviews: Array<Record<string, unknown>> } } : { success: false as const } });
}
export async function getCampaignRevisions(token: string, workspaceId: string, campaignId: string) {
  return request(idPath(workspaceId, campaignId) + "/revisions", token, { safeParse: (value: unknown) => value && typeof value === "object" && "revisions" in value ? { success: true as const, data: value as { revisions: Array<Record<string, unknown>> } } : { success: false as const } });
}
export async function getDemoAnalytics(token: string, workspaceId: string, campaignId: string) {
  return request(idPath(workspaceId, campaignId) + "/demo-analytics", token, { safeParse: (value: unknown) => value && typeof value === "object" && "analytics" in value ? { success: true as const, data: value as { label: string; analytics: Array<{ id: string; scenario: string; seed: number; metrics: { days: Array<{ date: string; impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number; cpa: number | null; roas: number | null }> }; dataSource: string; simulatedAt: string }> } } : { success: false as const } });
}
export async function getDemoPublishingAttempts(token: string, workspaceId: string, campaignId: string) {
  return request(idPath(workspaceId, campaignId) + "/demo-publishing", token, { safeParse: (value: unknown) => value && typeof value === "object" && "attempts" in value ? { success: true as const, data: value as { label: string; attempts: Array<{ id: string; status: string; scenario: string; failureCode: string | null; localDemoReference: string; revision: number; publishedExternally: false; createdAt: string; completedAt: string | null }> } } : { success: false as const } });
}
export type { CampaignSummary };
