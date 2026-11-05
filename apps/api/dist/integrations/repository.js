import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
function mapError(error) {
    if (error?.code === "42501")
        throw new HttpError(403, "integration_forbidden", "Your workspace role cannot manage this integration.");
    if (error?.code === "P0002")
        throw new HttpError(404, "integration_not_found", "The requested integration could not be found.");
    if (error?.code === "22023" || error?.code === "23514" || error?.code === "23503") {
        throw new HttpError(400, "integration_request_invalid", "The integration request is invalid.");
    }
    if (error?.code === "23505")
        throw new HttpError(409, "integration_conflict", "An integration change is already in progress.");
    throw new HttpError(503, "integration_service_unavailable", "The integration service is temporarily unavailable.");
}
function userClient(accessToken, apiConfig) {
    if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY)
        return null;
    return createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}
function serviceClient(apiConfig) {
    if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_SERVICE_ROLE_KEY)
        return null;
    return createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
}
export function createIntegrationUserRepository(accessToken, apiConfig = config) {
    const client = userClient(accessToken, apiConfig);
    if (!client)
        return null;
    return {
        async getRole(workspaceId, userId) {
            const { data, error } = await client.from("workspace_memberships")
                .select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
            if (error)
                mapError(error);
            return typeof data?.role === "string" ? data.role : null;
        },
        async list(workspaceId) {
            const [connectionResult, accountResult] = await Promise.all([
                client.from("advertising_connections")
                    .select("id,workspace_id,provider,connection_status,connected_by_user_id,provider_identity_reference,granted_scopes,verified_at,last_error_code,created_at,updated_at")
                    .eq("workspace_id", workspaceId).order("provider"),
                client.from("advertising_accounts")
                    .select("id,workspace_id,connection_id,provider,external_account_id,external_account_name,account_status,currency,timezone,is_manager,manager_reference,business_context,selected,last_synced_at,created_at,updated_at")
                    .eq("workspace_id", workspaceId).order("external_account_name"),
            ]);
            if (connectionResult.error)
                mapError(connectionResult.error);
            if (accountResult.error)
                mapError(accountResult.error);
            return {
                connections: connectionResult.data ?? [],
                accounts: accountResult.data ?? [],
            };
        },
        async getConnection(workspaceId, connectionId) {
            const { data, error } = await client.from("advertising_connections")
                .select("id,workspace_id,provider,connection_status,connected_by_user_id,provider_identity_reference,granted_scopes,verified_at,last_error_code,created_at,updated_at")
                .eq("workspace_id", workspaceId).eq("id", connectionId).maybeSingle();
            if (error)
                mapError(error);
            return data;
        },
        async startAttempt(input) {
            const { error } = await client.rpc("start_advertising_oauth_attempt", {
                p_attempt_id: input.attemptId,
                p_workspace_id: input.workspaceId,
                p_provider: input.provider,
                p_state_hash: input.stateHash,
                p_pkce_algorithm: input.pkce?.algorithm ?? null,
                p_pkce_key_version: input.pkce?.keyVersion ?? null,
                p_pkce_ciphertext: input.pkce?.ciphertext ?? null,
                p_expires_at: input.expiresAt,
            });
            if (error)
                mapError(error);
        },
        async selectAccounts(workspaceId, connectionId, accountIds) {
            const { error } = await client.rpc("select_advertising_accounts", {
                p_workspace_id: workspaceId, p_connection_id: connectionId, p_account_ids: accountIds,
            });
            if (error)
                mapError(error);
        },
        async unlink(workspaceId, connectionId) {
            const { error } = await client.rpc("unlink_advertising_connection", {
                p_workspace_id: workspaceId, p_connection_id: connectionId,
            });
            if (error)
                mapError(error);
        },
    };
}
export function createIntegrationCallbackRepository(apiConfig = config) {
    const client = serviceClient(apiConfig);
    if (!client)
        return null;
    return {
        async consumeAttempt(provider, stateHash) {
            const { data, error } = await client.rpc("consume_advertising_oauth_attempt", {
                p_provider: provider, p_state_hash: stateHash,
            });
            if (error)
                mapError(error);
            const row = Array.isArray(data) ? data[0] : null;
            if (!row || typeof row !== "object")
                throw new HttpError(400, "oauth_state_invalid", "Authorization could not be verified. Start again from Integrations.");
            return row;
        },
        async finalize(input) {
            const { error } = await client.rpc("finalize_advertising_oauth", {
                p_attempt_id: input.attempt.attempt_id,
                p_workspace_id: input.attempt.workspace_id,
                p_user_id: input.attempt.initiating_user_id,
                p_provider: input.attempt.provider,
                p_identity_reference: input.identityReference,
                p_scopes: input.scopes,
                p_credential_algorithm: input.credentials.algorithm,
                p_credential_key_version: input.credentials.keyVersion,
                p_credential_ciphertext: input.credentials.ciphertext,
                p_expires_at: input.credentials.expiresAt,
                p_accounts: input.accounts,
            });
            if (error)
                mapError(error);
        },
        async getCredential(workspaceId, connectionId, actorUserId) {
            const { data, error } = await client.rpc("get_advertising_credential", {
                p_workspace_id: workspaceId, p_connection_id: connectionId, p_actor_user_id: actorUserId,
            });
            if (error)
                mapError(error);
            const row = Array.isArray(data) ? data[0] : null;
            return row && typeof row === "object" ? row : null;
        },
        async sync(input) {
            const { error } = await client.rpc("sync_advertising_connection", {
                p_workspace_id: input.workspaceId,
                p_connection_id: input.connectionId,
                p_provider: input.provider,
                p_identity_reference: input.identityReference,
                p_scopes: input.scopes,
                p_credential_algorithm: input.credentials.algorithm,
                p_credential_key_version: input.credentials.keyVersion,
                p_credential_ciphertext: input.credentials.ciphertext,
                p_expires_at: input.credentials.expiresAt,
                p_accounts: input.accounts,
                p_actor_user_id: input.actorUserId,
                p_encryption_context_id: input.encryptionContextId,
            });
            if (error)
                mapError(error);
        },
        async markError(workspaceId, connectionId, actorUserId, errorCode) {
            const { error } = await client.rpc("mark_advertising_connection_error", {
                p_workspace_id: workspaceId, p_connection_id: connectionId, p_error_code: errorCode, p_actor_user_id: actorUserId,
            });
            if (error)
                mapError(error);
        },
    };
}
