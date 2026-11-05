const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class AnalyticsApiError extends Error {
  constructor(readonly status: number, message: string, readonly payload?: unknown) { super(message); this.name = "AnalyticsApiError"; }
}
type ObjectSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };
const objectSchema: ObjectSchema<Record<string, unknown>> = { safeParse(value) { return value && typeof value === "object" && !Array.isArray(value) ? { success: true, data: value as Record<string, unknown> } : { success: false }; } };
function root(workspaceId: string, area: "analytics" | "reports") { return `/api/workspaces/${encodeURIComponent(workspaceId)}/${area}`; }
function queryString(params: Record<string, unknown>) { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") query.set(key, String(value)); return query.size ? `?${query}` : ""; }
async function request<T>(path: string, token: string, schema: ObjectSchema<T> = objectSchema as ObjectSchema<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, { ...init, cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  } catch { throw new AnalyticsApiError(0, "The analytics service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new AnalyticsApiError(response.status, "The analytics service returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "The reporting request could not be completed.";
    throw new AnalyticsApiError(response.status, message, payload);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AnalyticsApiError(502, "The analytics service returned an invalid response.");
  return parsed.data;
}
async function fileRequest(path: string, token: string, init: RequestInit = {}) {
  let response: Response;
  try { response = await fetch(apiBaseUrl + path, { ...init, cache: "no-store", headers: { Authorization: `Bearer ${token}`, Accept: "text/csv, application/pdf", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } }); }
  catch { throw new AnalyticsApiError(0, "The export service could not be reached."); }
  if (!response.ok) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "The export could not be generated.";
    throw new AnalyticsApiError(response.status, message, payload);
  }
  const blob = await response.blob();
  if (!blob.size) throw new AnalyticsApiError(502, "The export was empty.");
  return { blob, filename: response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1] ?? "tandem-export", exportId: response.headers.get("x-report-export-id") };
}
const json = (method: string, value?: unknown): RequestInit => ({ method, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });

export function getAnalyticsOverview(token: string, workspaceId: string, params: Record<string, unknown> = {}, signal?: AbortSignal) { return request(`${root(workspaceId,"analytics")}/overview${queryString(params)}`, token, objectSchema, signal ? { signal } : {}); }
export function getAnalyticsCampaigns(token: string, workspaceId: string, params: Record<string, unknown> = {}, signal?: AbortSignal) { return request(`${root(workspaceId,"analytics")}/campaigns${queryString(params)}`, token, objectSchema, signal ? { signal } : {}); }
export function getAnalyticsPlatforms(token: string, workspaceId: string, params: Record<string, unknown> = {}, signal?: AbortSignal) { return request(`${root(workspaceId,"analytics")}/platforms${queryString(params)}`, token, objectSchema, signal ? { signal } : {}); }
export function getAnalyticsCreatives(token: string, workspaceId: string, params: Record<string, unknown> = {}, signal?: AbortSignal) { return request(`${root(workspaceId,"analytics")}/creatives${queryString(params)}`, token, objectSchema, signal ? { signal } : {}); }
export function getAnalyticsSavedViews(token: string, workspaceId: string) { return request(`${root(workspaceId,"analytics")}/saved-views`, token, objectSchema); }
export function saveAnalyticsView(token: string, workspaceId: string, value: unknown) { return request(`${root(workspaceId,"analytics")}/saved-views`, token, objectSchema, json("POST", value)); }
export function exportCampaignAnalytics(token: string, workspaceId: string, params: Record<string, unknown> = {}) { return fileRequest(`${root(workspaceId,"analytics")}/export.csv${queryString(params)}`, token); }

export function getReports(token: string, workspaceId: string) { return request(`${root(workspaceId,"reports")}`, token, objectSchema); }
export function getReport(token: string, workspaceId: string, reportId: string) { return request(`${root(workspaceId,"reports")}/${encodeURIComponent(reportId)}`, token, objectSchema); }
export function createReport(token: string, workspaceId: string, value: unknown) { return request(`${root(workspaceId,"reports")}`, token, objectSchema, json("POST", value)); }
export function saveReport(token: string, workspaceId: string, reportId: string, value: unknown) { return request(`${root(workspaceId,"reports")}/${encodeURIComponent(reportId)}`, token, objectSchema, json("PATCH", value)); }
export function duplicateReport(token: string, workspaceId: string, reportId: string, name?: string) { return request(`${root(workspaceId,"reports")}/${encodeURIComponent(reportId)}/duplicate`, token, objectSchema, json("POST", name ? { name } : {})); }
export function archiveReport(token: string, workspaceId: string, reportId: string, expectedVersion: number) { return request(`${root(workspaceId,"reports")}/${encodeURIComponent(reportId)}/archive`, token, objectSchema, json("POST", { expectedVersion })); }
export function getReportHistory(token: string, workspaceId: string, reportId: string) { return request(`${root(workspaceId,"reports")}/${encodeURIComponent(reportId)}/history`, token, objectSchema); }
export function exportReport(token: string, workspaceId: string, reportId: string, format: "csv" | "pdf") { return fileRequest(`${root(workspaceId,"reports")}/${encodeURIComponent(reportId)}/export`, token, json("POST", { format })); }

export function downloadExport(file: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(file.blob); const link = document.createElement("a");
  link.href = url; link.download = file.filename; link.rel = "noopener"; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
