import {
  ClosureRequestResponseSchema,
  UserPreferencesSchema,
  WorkspaceInvitationCreateSchema,
  WorkspacePreferencesPatchSchema,
  WorkspacePreferencesSchema,
  WorkspaceTeamResponseSchema,
  type UserPreferences,
  type UserPreferencesPatch,
  type WorkspacePreferences,
  type WorkspacePreferencesPatch,
  type WorkspaceTeamResponse,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class SettingsApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "SettingsApiError";
  }
}

type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

async function request<T>(path: string, token: string, schema: Schema<T>, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(apiBaseUrl + path, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new SettingsApiError(0, "The settings service could not be reached.");
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new SettingsApiError(response.status, "The settings service returned an unreadable response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string"
      ? payload.error.message
      : response.status === 401 ? "Your session could not be verified. Sign in again to continue."
        : response.status === 403 ? "Your current role does not allow this settings action."
          : "The settings request could not be completed.";
    throw new SettingsApiError(response.status, message);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new SettingsApiError(502, "The settings service returned an invalid response.");
  return parsed.data;
}

const obj = <T extends object>(schema: Schema<T>): Schema<T> => ({ safeParse(value) {
  return schema.safeParse(value);
} });
const rowSchema = obj<{ [key: string]: unknown }>({ safeParse(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { success: true, data: value as { [key: string]: unknown } } : { success: false };
} });

const prefsSchema = obj<{ preferences: UserPreferences }>({ safeParse(value) {
  if (!value || typeof value !== "object" || !("preferences" in value)) return { success: false };
  const preferences = UserPreferencesSchema.safeParse(value.preferences);
  return preferences.success ? { success: true, data: { preferences: preferences.data } } : { success: false };
} });
const workspacePrefsSchema = obj<{ preferences: WorkspacePreferences }>({ safeParse(value) {
  if (!value || typeof value !== "object" || !("preferences" in value)) return { success: false };
  const preferences = WorkspacePreferencesSchema.safeParse(value.preferences);
  return preferences.success ? { success: true, data: { preferences: preferences.data } } : { success: false };
} });
const teamSchema = obj<WorkspaceTeamResponse>(WorkspaceTeamResponseSchema);
const closureSchema = obj<ReturnType<typeof ClosureRequestResponseSchema.parse>>({ safeParse(value) {
  const result = ClosureRequestResponseSchema.safeParse(value);
  return result.success ? { success: true, data: result.data } : { success: false };
} });

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const workspacePath = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}`;

export async function getUserPreferences(token: string, fetcher?: typeof fetch): Promise<UserPreferences> {
  return (await request("/api/me/preferences", token, prefsSchema, {}, fetcher)).preferences;
}

export async function updateUserPreferences(token: string, patch: UserPreferencesPatch, fetcher?: typeof fetch): Promise<UserPreferences> {
  return (await request("/api/me/preferences", token, prefsSchema, json("PATCH", patch), fetcher)).preferences;
}

export async function getWorkspacePreferences(token: string, workspaceId: string, fetcher?: typeof fetch): Promise<WorkspacePreferences> {
  return (await request(`${workspacePath(workspaceId)}/preferences`, token, workspacePrefsSchema, {}, fetcher)).preferences;
}

export async function updateWorkspacePreferences(token: string, workspaceId: string, patch: WorkspacePreferencesPatch, fetcher?: typeof fetch): Promise<WorkspacePreferences> {
  const parsed = WorkspacePreferencesPatchSchema.safeParse(patch);
  if (!parsed.success) throw new SettingsApiError(400, "Review the workspace defaults and try again.");
  return (await request(`${workspacePath(workspaceId)}/preferences`, token, workspacePrefsSchema, json("PATCH", parsed.data), fetcher)).preferences;
}

export function getSettingsTeam(token: string, workspaceId: string, fetcher?: typeof fetch): Promise<WorkspaceTeamResponse> {
  return request(`${workspacePath(workspaceId)}/team`, token, teamSchema, {}, fetcher);
}

export function createTeamInvitation(token: string, workspaceId: string, email: string, role: "admin" | "editor" | "viewer", fetcher?: typeof fetch) {
  const parsed = WorkspaceInvitationCreateSchema.safeParse({ email, role });
  if (!parsed.success) throw new SettingsApiError(400, "Enter a valid email address and permitted team role.");
  return request(`${workspacePath(workspaceId)}/team/invitations`, token, rowSchema, json("POST", parsed.data), fetcher);
}

export function revokeTeamInvitation(token: string, workspaceId: string, invitationId: string, fetcher?: typeof fetch) {
  return request(`${workspacePath(workspaceId)}/team/invitations/${encodeURIComponent(invitationId)}/revoke`, token, rowSchema, json("POST", {}), fetcher);
}

export function changeTeamMemberRole(token: string, workspaceId: string, userId: string, role: "admin" | "editor" | "viewer", fetcher?: typeof fetch) {
  return request(`${workspacePath(workspaceId)}/team/${encodeURIComponent(userId)}`, token, rowSchema, json("PATCH", { role }), fetcher);
}

export function removeTeamMember(token: string, workspaceId: string, userId: string, fetcher?: typeof fetch) {
  return request(`${workspacePath(workspaceId)}/team/${encodeURIComponent(userId)}`, token, rowSchema, { method: "DELETE" }, fetcher);
}

export function getWorkspaceSettingsActivity(token: string, workspaceId: string, fetcher?: typeof fetch) {
  return request(`${workspacePath(workspaceId)}/security/activity`, token, rowSchema, {}, fetcher);
}

export function requestAccountClosure(token: string, fetcher?: typeof fetch) {
  return request("/api/me/closure-requests", token, closureSchema, json("POST", {}), fetcher);
}

export function requestWorkspaceClosure(token: string, workspaceId: string, fetcher?: typeof fetch) {
  return request(`${workspacePath(workspaceId)}/closure-requests`, token, closureSchema, json("POST", {}), fetcher);
}

export function getClosureRequests(token: string, workspaceId?: string, fetcher?: typeof fetch) {
  const path = workspaceId ? `${workspacePath(workspaceId)}/closure-requests` : "/api/me/closure-requests";
  return request(path, token, rowSchema, {}, fetcher);
}

export async function downloadSettingsExport(token: string, scope: "account" | "workspace", workspaceId?: string, fetcher: typeof fetch = fetch): Promise<Blob> {
  if (scope === "workspace" && !workspaceId) throw new SettingsApiError(400, "Select a workspace to export.");
  let response: Response;
  try {
    response = await fetcher(scope === "account" ? apiBaseUrl + "/api/me/export" : apiBaseUrl + workspacePath(workspaceId!) + "/export", {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch { throw new SettingsApiError(0, "The export could not be downloaded."); }
  if (!response.ok) throw new SettingsApiError(response.status, response.status === 403 ? "Your role does not allow this export." : "The export could not be downloaded.");
  return response.blob();
}
