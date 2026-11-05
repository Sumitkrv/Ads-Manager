import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
export const TRACKING_TABLES = {
    configs: "workspace_integration_configs",
    readiness: "integration_readiness_responses",
    goals: "conversion_goals",
    events: "conversion_event_definitions",
    mappings: "conversion_event_mappings",
    templates: "utm_templates",
    campaigns: "campaign_tracking_configs",
    plans: "workspace_tracking_plans",
    preferences: "workspace_tracking_preferences",
    tests: "tracking_test_runs",
    audit: "integration_configuration_audit",
};
function rows(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "object" && item !== null) : [];
}
function record(value) {
    const found = Array.isArray(value) ? value[0] : value;
    return typeof found === "object" && found !== null ? found : null;
}
function mapError(error) {
    if (error?.code === "42501")
        throw new HttpError(403, "tracking_forbidden", "Your workspace role or plan does not allow this tracking action.");
    if (error?.code === "P0002")
        throw new HttpError(404, "tracking_record_not_found", "The requested tracking record was not found.");
    if (error?.code === "54000")
        throw new HttpError(409, "tracking_workspace_read_only", "This workspace is currently read-only for new tracking configuration.");
    if (["22023", "23514", "23503", "23505", "40001"].includes(error?.code ?? ""))
        throw new HttpError(400, "tracking_request_invalid", "The tracking request conflicts with workspace data or validation rules.");
    throw new HttpError(503, "tracking_storage_unavailable", "Tracking storage is temporarily unavailable.");
}
export function createSupabaseTrackingRepository(accessToken, apiConfig = config) {
    if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY)
        return null;
    const client = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    return {
        async getRole(workspaceId, userId) {
            const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
            if (error)
                mapError(error);
            return typeof data?.role === "string" ? data.role : null;
        },
        async billingSummary(workspaceId) {
            const { data, error } = await client.rpc("billing_workspace_summary", { p_workspace_id: workspaceId });
            if (error)
                mapError(error);
            const result = record(data);
            if (!result)
                throw new HttpError(503, "tracking_billing_unavailable", "Workspace entitlements could not be confirmed.");
            return result;
        },
        async list(table, workspaceId) {
            const { data, error } = await client.from(table).select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500);
            if (error)
                mapError(error);
            return rows(data);
        },
        async upsert(table, payload, conflict) {
            const { data, error } = await client.from(table).upsert(payload, { onConflict: conflict }).select("*").single();
            if (error)
                mapError(error);
            const result = record(data);
            if (!result)
                throw new HttpError(503, "tracking_response_invalid", "Tracking storage did not confirm the saved record.");
            return result;
        },
        async update(table, workspaceId, id, payload) {
            const { data, error } = await client.from(table).update(payload).eq("workspace_id", workspaceId).eq("id", id).select("*").maybeSingle();
            if (error)
                mapError(error);
            return record(data);
        },
        async audit(workspaceId) {
            const { data, error } = await client.from(TRACKING_TABLES.audit).select("id,entity_type,entity_id,action,actor_user_id,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
            if (error)
                mapError(error);
            return rows(data);
        },
    };
}
