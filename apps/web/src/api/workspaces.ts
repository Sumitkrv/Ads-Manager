import {
  CreateWorkspaceInputSchema,
  WorkspaceMembersResponseSchema,
  WorkspaceResponseSchema,
  WorkspaceSettingsInputSchema,
  WorkspacesResponseSchema,
  type CreateWorkspaceInput,
  type WorkspaceMembersResponse,
  type WorkspaceResponse,
  type WorkspaceSettingsInput,
  type WorkspacesResponse,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class WorkspaceApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(apiBaseUrl + path, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + accessToken,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new WorkspaceApiError(0, "The workspace service could not be reached.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new WorkspaceApiError(401, "Your session could not be verified. Sign in again to continue.");
    }
    if (response.status === 403) {
      throw new WorkspaceApiError(403, "Your role does not allow this workspace action.");
    }
    if (response.status === 404) {
      throw new WorkspaceApiError(404, "This workspace is no longer available to your account.");
    }
    if (response.status === 409) {
      throw new WorkspaceApiError(409, "That workspace URL is already in use. Choose another.");
    }
    if (response.status === 400) {
      throw new WorkspaceApiError(400, "Review the workspace details and try again.");
    }
    throw new WorkspaceApiError(response.status, "Workspace service is temporarily unavailable.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WorkspaceApiError(502, "Workspace service returned an invalid response.");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new WorkspaceApiError(502, "Workspace service returned an invalid response.");
  return parsed.data;
}

export function getWorkspaces(accessToken: string, fetcher?: typeof fetch): Promise<WorkspacesResponse> {
  return request("/api/workspaces", accessToken, WorkspacesResponseSchema, {}, fetcher);
}

export function createWorkspace(
  accessToken: string,
  input: CreateWorkspaceInput,
  fetcher?: typeof fetch,
): Promise<WorkspaceResponse> {
  const parsed = CreateWorkspaceInputSchema.safeParse(input);
  if (!parsed.success) throw new WorkspaceApiError(400, "Review the workspace details and try again.");
  return request(
    "/api/workspaces",
    accessToken,
    WorkspaceResponseSchema,
    { method: "POST", body: JSON.stringify(parsed.data) },
    fetcher,
  );
}

export function getWorkspace(
  accessToken: string,
  workspaceId: string,
  fetcher?: typeof fetch,
): Promise<WorkspaceResponse> {
  return request(
    "/api/workspaces/" + encodeURIComponent(workspaceId),
    accessToken,
    WorkspaceResponseSchema,
    {},
    fetcher,
  );
}

export function updateWorkspace(
  accessToken: string,
  workspaceId: string,
  input: WorkspaceSettingsInput,
  fetcher?: typeof fetch,
): Promise<WorkspaceResponse> {
  const parsed = WorkspaceSettingsInputSchema.safeParse(input);
  if (!parsed.success) throw new WorkspaceApiError(400, "Review the business settings and try again.");
  return request(
    "/api/workspaces/" + encodeURIComponent(workspaceId),
    accessToken,
    WorkspaceResponseSchema,
    { method: "PATCH", body: JSON.stringify(parsed.data) },
    fetcher,
  );
}

export function getWorkspaceMembers(
  accessToken: string,
  workspaceId: string,
  fetcher?: typeof fetch,
): Promise<WorkspaceMembersResponse> {
  return request(
    "/api/workspaces/" + encodeURIComponent(workspaceId) + "/members",
    accessToken,
    WorkspaceMembersResponseSchema,
    {},
    fetcher,
  );
}
