import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
function mapError(error) {
    if (error?.code === "42501")
        throw new HttpError(403, "billing_forbidden", "You do not have permission to manage this workspace billing record.");
    if (error?.code === "P0002")
        throw new HttpError(404, "billing_record_not_found", "The requested billing record was not found.");
    if (error?.code === "54000")
        throw new HttpError(409, "billing_limit_reached", "The current subscription does not allow this operation. Existing data is preserved.");
    if (error?.code === "40001" || error?.code === "23505")
        throw new HttpError(409, "billing_conflict", "The billing request changed or has already been processed.");
    if (error?.code === "22023" || error?.code === "23514")
        throw new HttpError(400, "billing_input_invalid", "The billing request is invalid.");
    throw new HttpError(503, "billing_service_unavailable", "Billing simulation is temporarily unavailable.");
}
export function createSupabaseBillingRepository(accessToken, apiConfig = config) {
    if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY)
        return null;
    const client = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
    });
    async function rpc(name, args = {}) {
        const { data, error } = await client.rpc(name, args);
        if (error)
            mapError(error);
        return data;
    }
    return {
        plans: () => rpc("billing_public_plans"),
        summary: (workspaceId) => rpc("billing_workspace_summary", { p_workspace_id: workspaceId }),
        usage: (workspaceId) => rpc("billing_workspace_usage", { p_workspace_id: workspaceId }),
        history: (workspaceId) => rpc("billing_workspace_history", { p_workspace_id: workspaceId }),
        invoice: (workspaceId, invoiceId) => rpc("billing_invoice_document", { p_workspace_id: workspaceId, p_invoice_id: invoiceId }),
        requestPlan: (workspaceId, planId, interval, idempotencyKey) => rpc("billing_request_plan_change", {
            p_workspace_id: workspaceId, p_plan_id: planId, p_interval: interval, p_idempotency_key: idempotencyKey,
        }),
        cancel: (workspaceId, idempotencyKey, reason) => rpc("billing_request_cancellation", {
            p_workspace_id: workspaceId, p_idempotency_key: idempotencyKey, p_reason: reason,
        }),
        reactivate: (workspaceId, idempotencyKey) => rpc("billing_request_reactivation", {
            p_workspace_id: workspaceId, p_idempotency_key: idempotencyKey,
        }),
    };
}
export function createSupabaseBillingAdminRepository(apiConfig = config) {
    if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_SERVICE_ROLE_KEY)
        return null;
    // This privileged client is server-only and only exposes three named billing
    // RPCs. It is never returned to a user-scoped route or generic table proxy.
    const client = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    async function rpc(name, args = {}) {
        const { data, error } = await client.rpc(name, args);
        if (error)
            mapError(error);
        return data;
    }
    return {
        catalog: () => rpc("billing_admin_plan_catalog"),
        subscriptions: () => rpc("billing_admin_subscriptions"),
        renew: (workspaceId, actorId, idempotencyKey) => rpc("billing_simulate_renewal", { p_workspace_id: workspaceId, p_actor_id: actorId, p_idempotency_key: idempotencyKey }),
        activate: (requestId, actorId) => rpc("billing_simulate_plan_activation", { p_request_id: requestId, p_actor_id: actorId }),
        savePlan: (input, actorId) => rpc("billing_admin_save_plan", { p_plan: input, p_actor_id: actorId }),
    };
}
