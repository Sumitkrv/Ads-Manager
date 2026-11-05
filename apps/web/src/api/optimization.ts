import {
  AutomationRuleInputSchema, AutomationRunInputSchema, BudgetScenarioInputSchema,
  NotificationUpdateSchema, RecommendationDecisionSchema, type AutomationRule,
  type BudgetScenario, type OptimizationRecommendation,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export class OptimizationApiError extends Error {
  constructor(readonly status: number, message: string, readonly payload?: unknown) { super(message); this.name = "OptimizationApiError"; }
}
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };
const objectSchema: Schema<Record<string, unknown>> = { safeParse(value) { return typeof value === "object" && value !== null ? { success: true, data: value as Record<string, unknown> } : { success: false }; } };
async function request<T>(path: string, token: string, schema: Schema<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, { ...init, cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  } catch { throw new OptimizationApiError(0, "The optimization service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new OptimizationApiError(response.status, "The optimization service returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "The optimization request could not be completed.";
    throw new OptimizationApiError(response.status, message, payload);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new OptimizationApiError(502, "The optimization service returned an invalid response.");
  return parsed.data;
}
const json = (method: string, value: unknown): RequestInit => ({ method, body: JSON.stringify(value) });
const root = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}`;
const listSchema: Schema<{ recommendations: OptimizationRecommendation[] }> = { safeParse(value) { const item = objectSchema.safeParse(value); return item.success && Array.isArray(item.data.recommendations) ? { success: true, data: item.data as unknown as { recommendations: OptimizationRecommendation[] } } : { success: false }; } };
const scenariosSchema: Schema<{ scenarios: BudgetScenario[] }> = { safeParse(value) { const item = objectSchema.safeParse(value); return item.success && Array.isArray(item.data.scenarios) ? { success: true, data: item.data as unknown as { scenarios: BudgetScenario[] } } : { success: false }; } };

export function getOptimizationOverview(token: string, workspaceId: string) { return request(`${root(workspaceId)}/optimization/overview`, token, objectSchema); }
export function getOptimizationRecommendations(token: string, workspaceId: string) { return request(`${root(workspaceId)}/optimization/recommendations`, token, listSchema); }
export function analyzeDemoCampaign(token: string, workspaceId: string, campaignId: string) { return request(`${root(workspaceId)}/optimization/analyze`, token, objectSchema, json("POST", { campaignId })); }
export function decideRecommendation(token: string, workspaceId: string, id: string, input: { action: "review" | "approve" | "reject" | "dismiss"; expectedVersion: number; comments?: string }) {
  const body = RecommendationDecisionSchema.parse(input);
  return request(`${root(workspaceId)}/optimization/recommendations/${encodeURIComponent(id)}/decision`, token, objectSchema, json("POST", body));
}
export function getBudgetScenarios(token: string, workspaceId: string) { return request(`${root(workspaceId)}/optimization/scenarios`, token, scenariosSchema); }
export function createBudgetScenario(token: string, workspaceId: string, input: unknown) { return request(`${root(workspaceId)}/optimization/scenarios`, token, objectSchema, json("POST", BudgetScenarioInputSchema.parse(input))); }
export function transitionBudgetScenario(token: string, workspaceId: string, id: string, action: "submit" | "approve" | "reject" | "apply", expectedVersion: number, comments = "") {
  return request(`${root(workspaceId)}/optimization/scenarios/${encodeURIComponent(id)}/transition`, token, objectSchema, json("POST", { action, expectedVersion, comments }));
}
export function getCreativeInsights(token: string, workspaceId: string) { return request(`${root(workspaceId)}/optimization/creative-insights`, token, objectSchema); }
export function getOptimizationHistory(token: string, workspaceId: string) { return request(`${root(workspaceId)}/optimization/history`, token, objectSchema); }
export function getAutomationRules(token: string, workspaceId: string) { return request(`${root(workspaceId)}/automation/rules`, token, objectSchema); }
export function saveAutomationRule(token: string, workspaceId: string, input: unknown, id?: string) {
  const body = AutomationRuleInputSchema.parse(input);
  return request(`${root(workspaceId)}/automation/rules${id ? `/${encodeURIComponent(id)}` : ""}`, token, objectSchema, json(id ? "PATCH" : "POST", body));
}
export function testAutomationRule(token: string, workspaceId: string, ruleId: string, campaignId: string) { return request(`${root(workspaceId)}/automation/rules/${encodeURIComponent(ruleId)}/test`, token, objectSchema, json("POST", { campaignId })); }
export function runAutomationRule(token: string, workspaceId: string, ruleId: string, input: unknown) { return request(`${root(workspaceId)}/automation/rules/${encodeURIComponent(ruleId)}/run`, token, objectSchema, json("POST", AutomationRunInputSchema.parse(input))); }
export function getAutomationExecutions(token: string, workspaceId: string) { return request(`${root(workspaceId)}/automation/executions`, token, objectSchema); }
export function decideAutomationExecution(token: string, workspaceId: string, id: string, input: { decision: "approve" | "reject" | "apply"; expectedVersion: number; expectedRuleVersion: number; comments?: string }) {
  return request(`${root(workspaceId)}/automation/executions/${encodeURIComponent(id)}/decision`, token, objectSchema, json("POST", input));
}
export function getWorkspaceNotifications(token: string, workspaceId: string) { return request(`${root(workspaceId)}/notifications`, token, objectSchema); }
export function updateWorkspaceNotification(token: string, workspaceId: string, id: string, action: "read" | "unread" | "dismiss") {
  return request(`${root(workspaceId)}/notifications/${encodeURIComponent(id)}`, token, objectSchema, json("PATCH", NotificationUpdateSchema.parse({ action })));
}

export type { AutomationRule };
