import {
  BrandKitInputSchema,
  BrandKitResponseSchema,
  CreativeAssetListQuerySchema,
  CreativeAssetResponseSchema,
  CreativeAssetsResponseSchema,
  CreativeListQuerySchema,
  CreativeProjectResponseSchema,
  CreativeProjectsResponseSchema,
  CreativeProjectWriteSchema,
  CreativeTemplatesResponseSchema,
  CreativeVariationInputSchema,
  CreativeVariationsResponseSchema,
  type BrandKitInput,
  type CreativeProject,
  type CreativeProjectWrite,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class CreativeApiError extends Error {
  constructor(readonly status: number, message: string, readonly payload?: unknown) { super(message); this.name = "CreativeApiError"; }
}
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

async function request<T>(path: string, token: string, schema: Schema<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, {
      ...init, cache: "no-store",
      headers: { Accept: "application/json", Authorization: "Bearer " + token, ...(init.body && !(init.body instanceof Blob) && !(init.body instanceof ArrayBuffer) ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch { throw new CreativeApiError(0, "The Creative Studio service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new CreativeApiError(response.status, "The Creative Studio returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "The creative request could not be completed.";
    throw new CreativeApiError(response.status, message, payload);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new CreativeApiError(502, "The Creative Studio returned an invalid response.");
  return parsed.data;
}
function root(workspaceId: string) { return "/api/workspaces/" + encodeURIComponent(workspaceId); }
function projectPath(workspaceId: string, creativeId: string) { return root(workspaceId) + "/creatives/" + encodeURIComponent(creativeId); }
function assetsQueryPath(workspaceId: string, query: Record<string, unknown> = {}) {
  const parsed = CreativeAssetListQuerySchema.parse(query);
  const params = new URLSearchParams(Object.entries(parsed).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return root(workspaceId) + "/assets?" + params;
}
const json = (method: string, value: unknown): RequestInit => ({ method, body: JSON.stringify(value) });

export async function getBrandKit(token: string, workspaceId: string) {
  return (await request(root(workspaceId) + "/brand-kit", token, BrandKitResponseSchema)).brandKit;
}
export async function saveBrandKit(token: string, workspaceId: string, input: BrandKitInput) {
  const parsed = BrandKitInputSchema.parse(input);
  return (await request(root(workspaceId) + "/brand-kit", token, BrandKitResponseSchema, json("PUT", parsed))).brandKit;
}
export async function listCreativeAssets(token: string, workspaceId: string, params: Record<string, unknown> = {}) {
  return request(assetsQueryPath(workspaceId, params), token, CreativeAssetsResponseSchema);
}
export async function getCreativeAssetUrl(token: string, workspaceId: string, assetId: string) {
  return request(root(workspaceId) + "/assets/" + encodeURIComponent(assetId) + "/download", token, {
    safeParse: (value: unknown) => value && typeof value === "object" && "url" in value && typeof value.url === "string"
      ? { success: true as const, data: value as { url: string; expiresInSeconds: number } }
      : { success: false as const },
  });
}
export async function uploadCreativeAsset(token: string, workspaceId: string, file: File, type: "logo" | "image") {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + root(workspaceId) + "/assets", {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        "Content-Type": file.type,
        "X-Asset-Filename": encodeURIComponent(file.name),
        "X-Asset-Type": type,
      },
      body: await file.arrayBuffer(),
    });
  } catch { throw new CreativeApiError(0, "The asset storage service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new CreativeApiError(response.status, "Asset storage returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "The image could not be uploaded.";
    throw new CreativeApiError(response.status, message, payload);
  }
  const parsed = CreativeAssetResponseSchema.safeParse(payload);
  if (!parsed.success) throw new CreativeApiError(502, "Asset storage returned invalid metadata.");
  return parsed.data.asset;
}
export async function archiveCreativeAsset(token: string, workspaceId: string, assetId: string) {
  return request(root(workspaceId) + "/assets/" + encodeURIComponent(assetId), token, { safeParse: (value: unknown) => value && typeof value === "object" && "archived" in value ? { success: true as const, data: value as { archived: boolean; cleanupPending: boolean; message?: string } } : { success: false as const } }, { method: "DELETE" });
}
export async function listCreatives(token: string, workspaceId: string, params: Record<string, unknown> = {}) {
  const query = CreativeListQuerySchema.parse(params);
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return request(root(workspaceId) + "/creatives?" + search, token, CreativeProjectsResponseSchema);
}
export async function getCreative(token: string, workspaceId: string, creativeId: string): Promise<CreativeProject> {
  return (await request(projectPath(workspaceId, creativeId), token, CreativeProjectResponseSchema)).project;
}
export async function createCreative(token: string, workspaceId: string, input: CreativeProjectWrite): Promise<CreativeProject> {
  const parsed = CreativeProjectWriteSchema.parse(input);
  return (await request(root(workspaceId) + "/creatives", token, CreativeProjectResponseSchema, json("POST", parsed))).project;
}
export async function saveCreative(token: string, workspaceId: string, creativeId: string, input: CreativeProjectWrite): Promise<CreativeProject> {
  const parsed = CreativeProjectWriteSchema.parse(input);
  return (await request(projectPath(workspaceId, creativeId), token, CreativeProjectResponseSchema, json("PATCH", parsed))).project;
}
export async function duplicateCreative(token: string, workspaceId: string, creativeId: string, name: string): Promise<CreativeProject> {
  return (await request(projectPath(workspaceId, creativeId) + "/duplicate", token, CreativeProjectResponseSchema, json("POST", { name }))).project;
}
export async function changeCreativeArchiveState(token: string, workspaceId: string, creativeId: string, expectedRevision: number, archived: boolean) {
  return (await request(projectPath(workspaceId, creativeId) + (archived ? "/archive" : "/restore"), token, CreativeProjectResponseSchema, json("POST", { expectedRevision }))).project;
}
export async function listCreativeTemplates(token: string, workspaceId: string, industry?: string) {
  const query = industry ? "?industry=" + encodeURIComponent(industry) : "";
  return request(root(workspaceId) + "/creatives/templates" + query, token, CreativeTemplatesResponseSchema);
}
export async function generateCreativeVariations(token: string, workspaceId: string, input: Record<string, unknown>) {
  const parsed = CreativeVariationInputSchema.parse({ ...input, idempotencyKey: input.idempotencyKey ?? crypto.randomUUID() });
  return request(root(workspaceId) + "/creatives/variations", token, CreativeVariationsResponseSchema, json("POST", parsed));
}
export async function listCreativeRevisions(token: string, workspaceId: string, creativeId: string) {
  return request(projectPath(workspaceId, creativeId) + "/revisions", token, { safeParse: (value: unknown) => value && typeof value === "object" && "revisions" in value ? { success: true as const, data: value as { revisions: Array<Record<string, unknown>> } } : { success: false as const } });
}
export async function restoreCreativeRevision(token: string, workspaceId: string, creativeId: string, revision: number) {
  return (await request(projectPath(workspaceId, creativeId) + "/revisions/restore", token, CreativeProjectResponseSchema, json("POST", { revision }))).project;
}
export async function listCreativeReviews(token: string, workspaceId: string, creativeId: string) {
  return request(projectPath(workspaceId, creativeId) + "/reviews", token, { safeParse: (value: unknown) => value && typeof value === "object" && "reviews" in value ? { success: true as const, data: value as { reviews: Array<Record<string, unknown>> } } : { success: false as const } });
}
export async function reviewCreative(token: string, workspaceId: string, creativeId: string, input: { decision: "submitted" | "approved" | "changes_requested" | "reopened"; comments?: string; expectedRevision: number }) {
  return (await request(projectPath(workspaceId, creativeId) + "/review", token, CreativeProjectResponseSchema, json("POST", input))).project;
}
export async function getCreativeCampaignLinks(token: string, workspaceId: string, campaignId: string) {
  return request(root(workspaceId) + "/campaigns/" + encodeURIComponent(campaignId) + "/creatives", token, { safeParse: (value: unknown) => value && typeof value === "object" && "projects" in value ? { success: true as const, data: value as { projects: CreativeProject[] } } : { success: false as const } });
}
export async function attachCreativeToCampaign(token: string, workspaceId: string, campaignId: string, creativeId: string) {
  return request(root(workspaceId) + "/campaigns/" + encodeURIComponent(campaignId) + "/creatives/attach", token, { safeParse: (value: unknown) => value && typeof value === "object" && "attached" in value ? { success: true as const, data: value as { attached: boolean; project: CreativeProject } } : { success: false as const } }, json("POST", { creativeId }));
}
export async function detachCreativeFromCampaign(token: string, workspaceId: string, campaignId: string, creativeId: string) {
  return request(root(workspaceId) + "/campaigns/" + encodeURIComponent(campaignId) + "/creatives/" + encodeURIComponent(creativeId), token, { safeParse: (value: unknown) => value && typeof value === "object" && "detached" in value ? { success: true as const, data: value as { detached: boolean } } : { success: false as const } }, { method: "DELETE" });
}

