import { ProviderError } from "./types.js";
const PROVIDER_ORIGINS = new Set([
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://googleads.googleapis.com",
    "https://www.facebook.com",
    "https://graph.facebook.com",
]);
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function requestJson(url, init = {}, options = {}) {
    if (!PROVIDER_ORIGINS.has(url.origin))
        throw new ProviderError("provider_url_rejected");
    const fetcher = options.fetcher ?? fetch;
    const attempts = options.retryReadOnly ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        let response;
        try {
            response = await fetcher(url, {
                ...init,
                signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
            });
        }
        catch {
            if (attempt + 1 < attempts)
                continue;
            throw new ProviderError("provider_unavailable", true);
        }
        if (response.status === 429 || response.status >= 500) {
            if (attempt + 1 < attempts) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                continue;
            }
            throw new ProviderError(response.status === 429 ? "provider_rate_limited" : "provider_unavailable", true);
        }
        let payload;
        try {
            const body = await response.text();
            if (body.length > 1_000_000)
                throw new Error("response_too_large");
            payload = body ? JSON.parse(body) : {};
        }
        catch {
            throw new ProviderError("provider_response_invalid");
        }
        if (!response.ok) {
            const record = isRecord(payload) ? payload : {};
            const error = isRecord(record.error) ? record.error : {};
            const providerCode = String(error.code ?? error.type ?? record.error_code ?? "");
            const providerStatus = String(error.status ?? "");
            const joined = `${providerCode} ${providerStatus}`.toLowerCase();
            if (response.status === 401 || joined.includes("invalid_grant") || joined.includes("token_expired") || providerCode === "190") {
                throw new ProviderError("authorization_expired");
            }
            if (response.status === 403 || joined.includes("permission") || joined.includes("access_denied")) {
                throw new ProviderError("provider_permission_required");
            }
            if (response.status === 400 && joined.includes("developer_token")) {
                throw new ProviderError("developer_credentials_invalid");
            }
            throw new ProviderError("provider_request_rejected");
        }
        return payload;
    }
    throw new ProviderError("provider_unavailable", true);
}
export function requiredString(record, key) {
    const value = record[key];
    if (typeof value !== "string" || value.length === 0)
        throw new ProviderError("provider_response_invalid");
    return value;
}
export function optionalString(record, key) {
    const value = record[key];
    return typeof value === "string" && value.length > 0 ? value : null;
}
export function numericExpiration(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? Date.now() + value * 1000
        : null;
}
