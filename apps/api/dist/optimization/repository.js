import { createClient } from "@supabase/supabase-js";
import { CampaignRecordSchema, CampaignSummarySchema, DEFAULT_USER_PREFERENCES } from "@ai-ads/shared";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
function mapError(error) {
    if (error?.code === "42501")
        throw new HttpError(403, "optimization_forbidden", "Your workspace role cannot perform this action.");
    if (error?.code === "P0002")
        throw new HttpError(404, "optimization_record_not_found", "The requested workspace record was not found.");
    if (error?.code === "40001")
        throw new HttpError(409, "optimization_version_conflict", "This record changed. Reload the latest version and try again.");
    if (["22023", "23514", "23503", "23505"].includes(error?.code ?? ""))
        throw new HttpError(400, "optimization_request_invalid", "The optimization request could not be applied.");
    throw new HttpError(503, "optimization_service_unavailable", "Optimization storage is temporarily unavailable.");
}
function rows(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "object" && item !== null) : [];
}
const notificationPreferenceByType = {
    approval_required: "campaign_reviews",
    recommendation_decision: "campaign_reviews",
    campaign_review: "campaign_reviews",
    optimization_opportunity: "automation_activity",
    rule_execution: "automation_activity",
    rule_failed: "automation_activity",
    demo_threshold: "usage_limit_alerts",
    agency_collaboration: "agency_collaboration",
    agency_invitation: "team_invitations",
    agency_assignment: "agency_collaboration",
    client_task: "client_approvals",
    client_comment: "client_approvals",
};
export function notificationIsEnabled(value, preferences) {
    const category = notificationPreferenceByType[String(value.notification_type ?? "")];
    if (!category || !preferences || typeof preferences !== "object" || Array.isArray(preferences))
        return true;
    return preferences[category] !== false;
}
function campaignFromRow(row) {
    const summary = CampaignSummarySchema.parse({
        id: row.id, workspaceId: row.workspace_id, name: row.name, platform: row.platform, objective: row.objective,
        status: row.lifecycle_status, revision: row.revision, approvedRevision: row.approved_revision,
        generatedAt: row.generated_at, createdAt: row.created_at, updatedAt: row.updated_at,
        executionMode: row.execution_mode, publishedExternally: row.published_externally,
    });
    return CampaignRecordSchema.parse({ ...summary, brief: row.brief, plan: row.plan });
}
function one(value) {
    const row = Array.isArray(value) ? value[0] : value;
    if (typeof row !== "object" || row === null)
        throw new HttpError(503, "optimization_response_invalid", "Optimization storage returned an invalid response.");
    return row;
}
export function createSupabaseOptimizationRepository(accessToken, apiConfig = config) {
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
        async campaigns(workspaceId) {
            const { data, error } = await client.from("campaigns").select("*").eq("workspace_id", workspaceId).neq("lifecycle_status", "archived").order("updated_at", { ascending: false }).limit(200);
            if (error)
                mapError(error);
            return (data ?? []).map((row) => campaignFromRow(row));
        },
        async analytics(workspaceId, campaignId) {
            let query = client.from("demo_campaign_analytics").select("id,workspace_id,campaign_id,scenario,seed,metrics,data_source,simulated_at").eq("workspace_id", workspaceId).eq("data_source", "demo_simulation").order("simulated_at", { ascending: false }).limit(500);
            if (campaignId)
                query = query.eq("campaign_id", campaignId);
            const { data, error } = await query;
            if (error)
                mapError(error);
            return rows(data);
        },
        async recommendations(workspaceId) {
            const { data, error } = await client.from("optimization_recommendations").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200);
            if (error)
                mapError(error);
            return rows(data);
        },
        async createRecommendation(workspaceId, campaignId, analyticsId, type) {
            const { data, error } = await client.rpc("create_optimization_recommendation", { p_workspace_id: workspaceId, p_campaign_id: campaignId, p_analytics_id: analyticsId, p_type: type });
            if (error)
                mapError(error);
            return one(data);
        },
        async transitionRecommendation(id, version, action, comments) {
            const { data, error } = await client.rpc("transition_optimization_recommendation", { p_id: id, p_expected_version: version, p_action: action, p_comments: comments });
            if (error)
                mapError(error);
            return one(data);
        },
        async scenarios(workspaceId) {
            const { data, error } = await client.from("optimization_scenarios").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200);
            if (error)
                mapError(error);
            return rows(data);
        },
        async createScenario(workspaceId, campaignId, analyticsId, name, budget, adjustment) {
            const { data, error } = await client.rpc("create_optimization_scenario", { p_workspace_id: workspaceId, p_campaign_id: campaignId, p_analytics_id: analyticsId, p_name: name, p_proposed_budget: budget, p_adjustment: adjustment });
            if (error)
                mapError(error);
            return one(data);
        },
        async transitionScenario(id, version, action, comments) {
            const { data, error } = await client.rpc("transition_optimization_scenario", { p_id: id, p_expected_version: version, p_action: action, p_comments: comments });
            if (error)
                mapError(error);
            return one(data);
        },
        async rules(workspaceId) {
            const { data, error } = await client.from("automation_rules").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("updated_at", { ascending: false }).limit(200);
            if (error)
                mapError(error);
            return rows(data);
        },
        async saveRule(workspaceId, id, version, name, definition, enabled) {
            const { data, error } = await client.rpc("save_automation_rule", { p_workspace_id: workspaceId, p_rule_id: id, p_expected_version: version, p_name: name, p_definition: definition, p_enabled: enabled });
            if (error)
                mapError(error);
            return one(data);
        },
        async executeRule(workspaceId, ruleId, campaignId, idempotencyKey) {
            const { data, error } = await client.rpc("execute_automation_rule", { p_workspace_id: workspaceId, p_rule_id: ruleId, p_campaign_id: campaignId, p_idempotency_key: idempotencyKey });
            if (error)
                mapError(error);
            return one(data);
        },
        async executions(workspaceId, page, pageSize) {
            const from = (page - 1) * pageSize;
            const { data, error, count } = await client.from("automation_executions").select("*", { count: "exact" }).eq("workspace_id", workspaceId).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
            if (error)
                mapError(error);
            return { rows: rows(data), total: count ?? 0 };
        },
        async decideExecution(id, version, ruleVersion, decision, comments) {
            const { data, error } = await client.rpc("decide_automation_execution", { p_id: id, p_expected_version: version, p_expected_rule_version: ruleVersion, p_decision: decision, p_comments: comments });
            if (error)
                mapError(error);
            return one(data);
        },
        async notifications(workspaceId, userId) {
            const [{ data, error }, { data: preferenceRow, error: preferenceError }] = await Promise.all([
                client.from("workspace_notifications").select("*").eq("workspace_id", workspaceId).eq("recipient_user_id", userId).is("dismissed_at", null).order("created_at", { ascending: false }).limit(100),
                client.from("user_preferences").select("notification_preferences").eq("user_id", userId).maybeSingle(),
            ]);
            if (error)
                mapError(error);
            if (preferenceError)
                mapError(preferenceError);
            const preferences = preferenceRow?.notification_preferences ?? DEFAULT_USER_PREFERENCES.notifications;
            return rows(data).filter((notification) => notificationIsEnabled(notification, preferences));
        },
        async updateNotification(id, action) {
            const { data, error } = await client.rpc("update_workspace_notification", { p_id: id, p_action: action });
            if (error)
                mapError(error);
            return one(data);
        },
        async activity(workspaceId, page, pageSize) {
            const from = (page - 1) * pageSize;
            const { data, error, count } = await client.from("optimization_activity").select("*", { count: "exact" }).eq("workspace_id", workspaceId).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
            if (error)
                mapError(error);
            return { rows: rows(data), total: count ?? 0 };
        },
    };
}
