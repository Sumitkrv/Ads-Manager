import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
function mapError(error) {
    if (error?.code === "42501")
        throw new HttpError(403, "agency_forbidden", "Your current workspace membership does not allow this action.");
    if (error?.code === "P0002")
        throw new HttpError(404, "agency_record_not_found", "The requested collaboration record was not found.");
    if (error?.code === "40001")
        throw new HttpError(409, "agency_version_conflict", "This record changed. Reload it before trying again.");
    if (["22023", "23514", "23503", "23505"].includes(error?.code ?? ""))
        throw new HttpError(409, "agency_request_conflict", "The collaboration request could not be applied in its current state.");
    throw new HttpError(503, "agency_service_unavailable", "Agency collaboration storage is temporarily unavailable.");
}
function rows(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "object" && item !== null) : [];
}
function row(value) {
    const item = Array.isArray(value) ? value[0] : value;
    if (typeof item !== "object" || item === null)
        throw new HttpError(503, "agency_response_invalid", "Agency storage returned an invalid response.");
    return item;
}
export function createSupabaseAgencyRepository(accessToken, apiConfig = config) {
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
        async agencyProfile(workspaceId) {
            const { data, error } = await client.from("agency_profiles").select("agency_workspace_id,description,website_url,specializations,created_by,created_at,updated_at").eq("agency_workspace_id", workspaceId).maybeSingle();
            if (error)
                mapError(error);
            return data ? data : null;
        },
        async saveAgencyProfile(workspaceId, input) {
            const { data, error } = await client.rpc("save_agency_profile", { p_workspace_id: workspaceId, p_description: input.description, p_website_url: input.websiteUrl, p_specializations: input.specializations });
            if (error)
                mapError(error);
            return row(data);
        },
        async relationships(workspaceId, side) {
            const column = side === "agency" ? "agency_workspace_id" : "client_workspace_id";
            const { data, error } = await client.from("agency_client_relationships").select("id,agency_workspace_id,client_workspace_id,request_direction,status,decision,requested_by,responded_by,requested_at,responded_at,created_at,updated_at").eq(column, workspaceId).order("updated_at", { ascending: false }).limit(250);
            if (error)
                mapError(error);
            return rows(data);
        },
        async requestRelationship(workspaceId, otherWorkspaceId, side) {
            const result = side === "agency"
                ? await client.rpc("request_agency_client_relationship", { p_agency_workspace_id: workspaceId, p_client_workspace_id: otherWorkspaceId })
                : await client.rpc("request_client_agency_relationship", { p_client_workspace_id: workspaceId, p_agency_workspace_id: otherWorkspaceId });
            if (result.error)
                mapError(result.error);
            return row(result.data);
        },
        async transitionRelationship(id, action) {
            const { data, error } = await client.rpc("transition_agency_client_relationship", { p_relationship_id: id, p_action: action });
            if (error)
                mapError(error);
            return row(data);
        },
        async memberWorkspaceIds(userId) {
            const { data, error } = await client.from("workspace_memberships").select("workspace_id").eq("user_id", userId).limit(500);
            if (error)
                mapError(error);
            return (data ?? []).map((item) => item.workspace_id).filter((id) => typeof id === "string");
        },
        async clientWorkspaces(ids) {
            if (!ids.length)
                return [];
            const { data, error } = await client.from("workspaces").select("id,name,slug,industry_key,industry_custom_label,website_url,logo_url,created_at,updated_at").in("id", ids).limit(100);
            if (error)
                mapError(error);
            return rows(data);
        },
        async agencyOverview(workspaceId) {
            const { data, error } = await client.rpc("agency_overview_counts", { p_agency_workspace_id: workspaceId });
            if (error)
                mapError(error);
            return row(data);
        },
        async clientOverview(workspaceId) {
            const { data, error } = await client.rpc("client_portal_overview", { p_client_workspace_id: workspaceId });
            if (error)
                mapError(error);
            return row(data);
        },
        async teamMembers(workspaceId) {
            const { data, error } = await client.from("workspace_memberships").select("id,workspace_id,user_id,role,created_at,updated_at").eq("workspace_id", workspaceId).order("created_at", { ascending: true }).limit(500);
            if (error)
                mapError(error);
            return rows(data);
        },
        async assignments(workspaceId) {
            const { data, error } = await client.from("agency_team_assignments").select("id,relationship_id,agency_workspace_id,client_workspace_id,assignee_user_id,responsibility,status,created_by,created_at,updated_at,revoked_at").eq("agency_workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(500);
            if (error)
                mapError(error);
            return rows(data);
        },
        async createAssignment(relationshipId, userId, responsibility) {
            const { data, error } = await client.rpc("create_agency_team_assignment", { p_relationship_id: relationshipId, p_user_id: userId, p_responsibility: responsibility });
            if (error)
                mapError(error);
            return row(data);
        },
        async revokeAssignment(id) {
            const { data, error } = await client.rpc("revoke_agency_team_assignment", { p_assignment_id: id });
            if (error)
                mapError(error);
            return row(data);
        },
        async removeTeamMember(workspaceId, userId) {
            const { data, error } = await client.rpc("remove_agency_team_member", { p_agency_workspace_id: workspaceId, p_user_id: userId });
            if (error)
                mapError(error);
            return row(data);
        },
        async invitations(workspaceId) {
            const { data, error } = await client.from("workspace_invitations").select("id,workspace_id,relationship_id,invited_email,invited_role,status,created_by,accepted_by,accepted_at,expires_at,created_at,updated_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
            if (error)
                mapError(error);
            return rows(data);
        },
        async createInvitation(input) {
            const { data, error } = await client.rpc("create_workspace_invitation", {
                p_workspace_id: input.workspaceId, p_relationship_id: input.relationshipId, p_email: input.email,
                p_role: input.role, p_token_hash: input.tokenHash, p_expires_at: input.expiresAt,
            });
            if (error)
                mapError(error);
            return row(data);
        },
        async revokeInvitation(id) {
            const { data, error } = await client.rpc("revoke_workspace_invitation", { p_invitation_id: id });
            if (error)
                mapError(error);
            return row(data);
        },
        async acceptInvitation(tokenHash, action) {
            const { data, error } = await client.rpc("accept_workspace_invitation", { p_token_hash: tokenHash, p_action: action });
            if (error)
                mapError(error);
            return row(data);
        },
        async tasks(workspaceId) {
            const { data, error } = await client.from("client_tasks").select("id,workspace_id,relationship_id,title,description,assigned_user_id,created_by,due_date,priority,status,visibility,related_resource_type,related_resource_id,version,created_at,updated_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(200);
            if (error)
                mapError(error);
            return rows(data);
        },
        async createTask(workspaceId, input) {
            const { data, error } = await client.rpc("create_client_task", {
                p_workspace_id: workspaceId, p_relationship_id: input.relationshipId ?? null, p_title: input.title,
                p_description: input.description ?? null, p_assigned_user_id: input.assignedUserId ?? null,
                p_due_date: input.dueDate ?? null, p_priority: input.priority ?? "normal", p_visibility: input.visibility ?? "client_visible",
                p_resource_type: input.relatedResourceType ?? null, p_resource_id: input.relatedResourceId ?? null,
            });
            if (error)
                mapError(error);
            return row(data);
        },
        async updateTask(workspaceId, taskId, expectedVersion, patch) {
            const { data, error } = await client.rpc("update_client_task", { p_workspace_id: workspaceId, p_task_id: taskId, p_expected_version: expectedVersion, p_patch: patch });
            if (error)
                mapError(error);
            return row(data);
        },
        async comments(workspaceId, resourceType, resourceId) {
            let query = client.from("client_collaboration_comments").select("id,workspace_id,relationship_id,related_resource_type,related_resource_id,parent_comment_id,author_user_id,visibility,body,resolved_at,resolved_by,created_at,updated_at").eq("workspace_id", workspaceId).order("created_at", { ascending: true }).limit(300);
            if (resourceType)
                query = query.eq("related_resource_type", resourceType);
            if (resourceId)
                query = query.eq("related_resource_id", resourceId);
            const { data, error } = await query;
            if (error)
                mapError(error);
            return rows(data);
        },
        async createComment(workspaceId, input) {
            const { data, error } = await client.rpc("create_client_comment", {
                p_workspace_id: workspaceId, p_relationship_id: input.relationshipId ?? null,
                p_resource_type: input.relatedResourceType, p_resource_id: input.relatedResourceId ?? null,
                p_parent_id: input.parentCommentId ?? null, p_visibility: input.visibility ?? "client_visible", p_body: input.body,
            });
            if (error)
                mapError(error);
            return row(data);
        },
        async resolveComment(workspaceId, commentId, resolve) {
            const { data, error } = await client.rpc("resolve_client_comment", { p_workspace_id: workspaceId, p_comment_id: commentId, p_resolve: resolve });
            if (error)
                mapError(error);
            return row(data);
        },
        async activity(workspaceId, side, page, pageSize) {
            const from = (page - 1) * pageSize;
            const column = side === "agency" ? "agency_workspace_id" : "client_workspace_id";
            let query = client.from("agency_activity_events").select("id,agency_workspace_id,client_workspace_id,relationship_id,actor_user_id,action_type,target_type,target_id,visibility,summary,request_id,created_at", { count: "exact" }).eq(column, workspaceId).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
            if (side === "client")
                query = query.eq("visibility", "client_visible");
            const { data, count, error } = await query;
            if (error)
                mapError(error);
            return { rows: rows(data), total: count ?? 0 };
        },
    };
}
