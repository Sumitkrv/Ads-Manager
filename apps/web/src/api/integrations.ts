import {
  AdvertisingAccountsResponseSchema,
  AdvertisingAuthorizationStartResponseSchema,
  AdvertisingIntegrationsResponseSchema,
  AdvertisingMutationResponseSchema,
  SelectAdvertisingAccountsInputSchema,
  type AdvertisingAccountsResponse,
  type AdvertisingAuthorizationStartResponse,
  type AdvertisingIntegrationsResponse,
  type AdvertisingMutationResponse,
  type AdvertisingProvider,
} from "@ai-ads/shared";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class IntegrationApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "IntegrationApiError";
  }
}

type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

async function request<T>(
  path: string,
  accessToken: string,
  schema: Schema<T>,
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
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new IntegrationApiError(0, "The integrations service could not be reached.");
  }

  if (!response.ok) {
    let message = "The integrations service is temporarily unavailable.";
    try {
      const payload = await response.json() as { error?: { message?: unknown } };
      if (typeof payload.error?.message === "string" && payload.error.message.length <= 300) message = payload.error.message;
    } catch {
      // Use the safe fallback when a response body is absent or malformed.
    }
    throw new IntegrationApiError(response.status, message);
  }

  let payload: unknown;
  try { payload = await response.json(); } catch { throw new IntegrationApiError(502, "The integrations service returned an invalid response."); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new IntegrationApiError(502, "The integrations service returned an invalid response.");
  return parsed.data;
}

function workspacePath(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/integrations`;
}

export function getAdvertisingIntegrations(
  accessToken: string,
  workspaceId: string,
  fetcher?: typeof fetch,
): Promise<AdvertisingIntegrationsResponse> {
  return request(workspacePath(workspaceId), accessToken, AdvertisingIntegrationsResponseSchema, {}, fetcher).then((result) => {
    if (result.workspaceId !== workspaceId) throw new IntegrationApiError(502, "The integrations service returned another workspace context.");
    return result;
  });
}

export function startAdvertisingConnection(
  accessToken: string,
  workspaceId: string,
  provider: AdvertisingProvider,
  fetcher?: typeof fetch,
): Promise<AdvertisingAuthorizationStartResponse> {
  return request(
    `${workspacePath(workspaceId)}/${provider}/start`,
    accessToken,
    AdvertisingAuthorizationStartResponseSchema,
    { method: "POST", body: "{}" },
    fetcher,
  );
}

export function selectAdvertisingAccounts(
  accessToken: string,
  workspaceId: string,
  connectionId: string,
  accountIds: string[],
  fetcher?: typeof fetch,
): Promise<AdvertisingMutationResponse> {
  const parsed = SelectAdvertisingAccountsInputSchema.safeParse({ accountIds });
  if (!parsed.success) throw new IntegrationApiError(400, "Review the selected accounts and try again.");
  return request(
    `${workspacePath(workspaceId)}/${encodeURIComponent(connectionId)}/accounts/select`,
    accessToken,
    AdvertisingMutationResponseSchema,
    { method: "POST", body: JSON.stringify(parsed.data) },
    fetcher,
  );
}

export function verifyAdvertisingConnection(
  accessToken: string,
  workspaceId: string,
  connectionId: string,
  fetcher?: typeof fetch,
): Promise<AdvertisingMutationResponse> {
  return request(
    `${workspacePath(workspaceId)}/${encodeURIComponent(connectionId)}/verify`,
    accessToken,
    AdvertisingMutationResponseSchema,
    { method: "POST", body: "{}" },
    fetcher,
  );
}

export function disconnectAdvertisingConnection(
  accessToken: string,
  workspaceId: string,
  connectionId: string,
  fetcher?: typeof fetch,
): Promise<AdvertisingMutationResponse> {
  return request(
    `${workspacePath(workspaceId)}/${encodeURIComponent(connectionId)}`,
    accessToken,
    AdvertisingMutationResponseSchema,
    { method: "DELETE" },
    fetcher,
  );
}

export function getAdvertisingAccounts(
  accessToken: string,
  workspaceId: string,
  connectionId: string,
  fetcher?: typeof fetch,
): Promise<AdvertisingAccountsResponse> {
  return request(
    `${workspacePath(workspaceId)}/${encodeURIComponent(connectionId)}/accounts`,
    accessToken,
    AdvertisingAccountsResponseSchema,
    {},
    fetcher,
  );
}
