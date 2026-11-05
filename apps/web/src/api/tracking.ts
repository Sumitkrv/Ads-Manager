const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class TrackingApiError extends Error {
  constructor(readonly status: number, message: string, readonly payload?: unknown) { super(message); this.name = "TrackingApiError"; }
}
function root(workspaceId: string) { return `/api/workspaces/${encodeURIComponent(workspaceId)}/tracking`; }

export async function trackingRequest<T>(token: string, workspaceId: string, path: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(apiBaseUrl + root(workspaceId) + path, {
      ...init, cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch { throw new TrackingApiError(0, "The tracking service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new TrackingApiError(response.status, "The tracking service returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string"
      ? payload.error.message : "The tracking request could not be completed.";
    throw new TrackingApiError(response.status, message, payload);
  }
  return payload as T;
}

export function trackingJson(method: "POST" | "PUT" | "PATCH", value: unknown): RequestInit { return { method, body: JSON.stringify(value) }; }
export function getTrackingOverview(token: string, workspaceId: string, fetcher?: typeof fetch) {
  return trackingRequest<Record<string, unknown>>(token, workspaceId, "/overview", {}, fetcher);
}
