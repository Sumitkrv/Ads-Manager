const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class BillingApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "BillingApiError"; }
}
type Row = Record<string, unknown>;
async function request<T = Row>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, {
      ...init, cache: "no-store",
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch { throw new BillingApiError(0, "Billing service could not be reached."); }
  if (!response.ok) {
    let message = "Billing request could not be completed.";
    try { const payload = await response.json() as { error?: { message?: unknown } }; if (typeof payload.error?.message === "string") message = payload.error.message; } catch { /* use safe fallback */ }
    throw new BillingApiError(response.status, message);
  }
  return (response.headers.get("content-type")?.includes("application/pdf") ? response.blob() : response.json()) as Promise<T>;
}
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const path = (workspaceId: string, suffix: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/${suffix}`;
export const getBillingPlans = () => request<{ mode: "simulation"; plans: Row[] }>("/api/billing/plans");
export const getBillingSummary = (token: string, workspaceId: string) => request<Row>(path(workspaceId, "subscription"), token);
export const getBillingUsage = (token: string, workspaceId: string) => request<Row>(path(workspaceId, "usage"), token);
export const getBillingHistory = (token: string, workspaceId: string) => request<{ events: Row[]; invoices: Row[] }>(path(workspaceId, "history"), token);
export const requestBillingPlan = (token: string, workspaceId: string, planId: string, interval: "monthly" | "annual", idempotencyKey: string) => request<Row>(path(workspaceId, "change-requests"), token, json("POST", { planId, interval, idempotencyKey }));
export const requestBillingCancellation = (token: string, workspaceId: string, idempotencyKey: string, reason: string) => request<Row>(path(workspaceId, "cancel-request"), token, json("POST", { idempotencyKey, reason }));
export const requestBillingReactivation = (token: string, workspaceId: string, idempotencyKey: string) => request<Row>(path(workspaceId, "reactivate-request"), token, json("POST", { idempotencyKey }));
export const getDemoInvoicePdf = (token: string, workspaceId: string, invoiceId: string) => request<Blob>(path(workspaceId, `invoices/${encodeURIComponent(invoiceId)}/pdf`), token);
export const getBillingAdminAccess = (token: string) => request<{ allowed: boolean; mode: string; environment: string }>("/api/platform-admin/billing/access", token);
export const getBillingAdminPlans = (token: string) => request<{ plans: Row[]; mode: string }>("/api/platform-admin/billing/plans", token);
export const getBillingAdminSubscriptions = (token: string) => request<{ subscriptions: Row[]; mode: string }>("/api/platform-admin/billing/subscriptions", token);
export const saveBillingAdminPlan = (token: string, input: Row) => request<Row>("/api/platform-admin/billing/plans", token, json("POST", input));
export const activateBillingDemoRequest = (token: string, requestId: string) => request<Row>("/api/platform-admin/billing/demo-transitions", token, json("POST", { requestId }));
export const simulateBillingRenewal = (token: string, workspaceId: string, idempotencyKey: string) => request<Row>("/api/platform-admin/billing/renewals", token, json("POST", { workspaceId, idempotencyKey }));
