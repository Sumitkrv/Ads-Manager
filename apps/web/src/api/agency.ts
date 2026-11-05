const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class AgencyApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "AgencyApiError"; }
}

type Row = Record<string, unknown>;
const rowSchema = { safeParse(value: unknown): { success: true; data: Row } | { success: false } {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { success: true, data: value as Row }
    : { success: false };
} };
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

async function request<T extends Row = Row>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch { throw new AgencyApiError(0, "The collaboration service could not be reached."); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new AgencyApiError(response.status, "The collaboration service returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string"
      ? payload.error.message : "The collaboration request could not be completed.";
    throw new AgencyApiError(response.status, message);
  }
  const parsed = rowSchema.safeParse(payload);
  if (!parsed.success) throw new AgencyApiError(502, "The collaboration service returned an invalid response.");
  return parsed.data as T;
}

const base = (workspaceId: string, area: "agency" | "client") => `/api/workspaces/${encodeURIComponent(workspaceId)}/${area}`;

export function getAgencyOverview(token: string, workspaceId: string) { return request(`${base(workspaceId, "agency")}/overview`, token); }
export function saveAgencyProfile(token: string, workspaceId: string, value: { description: string | null; websiteUrl: string | null; specializations: string[] }) { return request(`${base(workspaceId, "agency")}/profile`, token, json("PUT", value)); }
export function getAgencyClients(token: string, workspaceId: string, query: Record<string, string> = {}) { const params = new URLSearchParams(query); return request(`${base(workspaceId, "agency")}/clients${params.size ? `?${params}` : ""}`, token); }
export function requestAgencyRelationship(token: string, workspaceId: string, otherWorkspaceId: string) { return request(`${base(workspaceId, "agency")}/relationships`, token, json("POST", { otherWorkspaceId })); }
export function decideAgencyRelationship(token: string, workspaceId: string, relationshipId: string, action: string) { return request(`${base(workspaceId, "agency")}/relationships/${encodeURIComponent(relationshipId)}/decision`, token, json("POST", { action })); }
export function getAgencyTeam(token: string, workspaceId: string) { return request(`${base(workspaceId, "agency")}/team`, token); }
export function createAgencyAssignment(token: string, workspaceId: string, relationshipId: string, assigneeUserId: string, responsibility: string) { return request(`${base(workspaceId, "agency")}/assignments`, token, json("POST", { relationshipId, assigneeUserId, responsibility })); }
export function revokeAgencyAssignment(token: string, workspaceId: string, assignmentId: string) { return request(`${base(workspaceId, "agency")}/assignments/${encodeURIComponent(assignmentId)}`, token, { method: "DELETE" }); }
export function removeAgencyMember(token: string, workspaceId: string, userId: string) { return request(`${base(workspaceId, "agency")}/team/${encodeURIComponent(userId)}`, token, { method: "DELETE" }); }
export function createAgencyInvitation(token: string, workspaceId: string, email: string, role: "admin" | "editor" | "viewer") { return request(`${base(workspaceId, "agency")}/invitations`, token, json("POST", { email, role })); }
export function getAgencyActivity(token: string, workspaceId: string) { return request(`${base(workspaceId, "agency")}/activity`, token); }

export function getClientOverview(token: string, workspaceId: string) { return request(`${base(workspaceId, "client")}/overview`, token); }
export function getClientRelationships(token: string, workspaceId: string) { return request(`${base(workspaceId, "client")}/relationships`, token); }
export function requestClientRelationship(token: string, workspaceId: string, otherWorkspaceId: string) { return request(`${base(workspaceId, "client")}/relationships`, token, json("POST", { otherWorkspaceId })); }
export function decideClientRelationship(token: string, workspaceId: string, relationshipId: string, action: string) { return request(`${base(workspaceId, "client")}/relationships/${encodeURIComponent(relationshipId)}/decision`, token, json("POST", { action })); }
export function inviteAgencyMemberToClient(token: string, workspaceId: string, relationshipId: string, email: string, role: "editor" | "viewer") { return request(`${base(workspaceId, "client")}/agency-invitations`, token, json("POST", { relationshipId, email, role })); }
export function getClientTasks(token: string, workspaceId: string) { return request(`${base(workspaceId, "client")}/tasks`, token); }
export function createClientTask(token: string, workspaceId: string, value: Row) { return request(`${base(workspaceId, "client")}/tasks`, token, json("POST", value)); }
export function updateClientTask(token: string, workspaceId: string, taskId: string, value: Row) { return request(`${base(workspaceId, "client")}/tasks/${encodeURIComponent(taskId)}`, token, json("PATCH", value)); }
export function getClientComments(token: string, workspaceId: string) { return request(`${base(workspaceId, "client")}/comments`, token); }
export function createClientComment(token: string, workspaceId: string, value: Row) { return request(`${base(workspaceId, "client")}/comments`, token, json("POST", value)); }
export function getClientActivity(token: string, workspaceId: string) { return request(`${base(workspaceId, "client")}/activity`, token); }
export function acceptWorkspaceInvitation(token: string, invitationToken: string, action: "accept" | "decline" = "accept") {
  return request(action === "accept" ? "/api/invitations/accept" : "/api/invitations/decline", token, json("POST", { token: invitationToken }));
}
