import { createClient } from "@supabase/supabase-js";
import { WorkspaceBusinessInputSchema, WorkspaceMembersResponseSchema, WorkspaceRoleSchema, WorkspaceRowSchema, WorkspaceSettingsInputSchema, WorkspaceWithRoleSchema, workspaceFromRow, } from "@ai-ads/shared";
import { config } from "./config.js";
import { HttpError } from "./errors.js";
const WORKSPACE_COLUMNS = "id,name,slug,industry_key,industry_custom_label,website_url,country_code,timezone,logo_url,created_by,created_at,updated_at";
function mapSupabaseError(error) {
    if (error?.code === "23505") {
        throw new HttpError(409, "workspace_conflict", "That workspace URL is already in use. Choose another.");
    }
    if (error?.code === "22023" || error?.code === "23514" || error?.code === "23503") {
        throw new HttpError(400, "invalid_workspace", "The workspace details are invalid.");
    }
    if (error?.code === "42501") {
        throw new HttpError(403, "workspace_forbidden", "You do not have permission to perform this action.");
    }
    if (error?.code === "P0002") {
        throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    }
    throw new HttpError(503, "workspace_service_unavailable", "Workspace service is temporarily unavailable.");
}
function parseWorkspaceRow(value) {
    const row = WorkspaceRowSchema.safeParse(value);
    if (!row.success) {
        throw new HttpError(503, "workspace_response_invalid", "Workspace service returned an invalid response.");
    }
    return workspaceFromRow(row.data);
}
function parseWorkspaceRpcResult(value) {
    if (!Array.isArray(value) || value.length !== 1) {
        throw new HttpError(503, "workspace_response_invalid", "Workspace service returned an invalid response.");
    }
    return parseWorkspaceRow(value[0]);
}
export function createSupabaseWorkspaceRepository(accessToken) {
    if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY)
        return null;
    const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: "Bearer " + accessToken } },
    });
    return {
        async listForUser(userId) {
            const { data: memberships, error: membershipError } = await client
                .from("workspace_memberships")
                .select("workspace_id,role")
                .eq("user_id", userId);
            if (membershipError)
                mapSupabaseError(membershipError);
            if (!memberships?.length)
                return [];
            const { data: rows, error } = await client
                .from("workspaces")
                .select(WORKSPACE_COLUMNS)
                .in("id", memberships.map((membership) => membership.workspace_id))
                .order("created_at", { ascending: true });
            if (error)
                mapSupabaseError(error);
            const rolesByWorkspace = new Map();
            for (const membership of memberships) {
                const parsedRole = WorkspaceRoleSchema.safeParse(membership.role);
                if (!parsedRole.success) {
                    throw new HttpError(503, "workspace_response_invalid", "Workspace membership returned an invalid role.");
                }
                rolesByWorkspace.set(membership.workspace_id, parsedRole.data);
            }
            return (rows ?? []).map((row) => {
                const workspace = parseWorkspaceRow(row);
                const role = rolesByWorkspace.get(workspace.id);
                if (!role) {
                    throw new HttpError(503, "workspace_response_invalid", "Workspace membership could not be confirmed.");
                }
                return WorkspaceWithRoleSchema.parse({ ...workspace, role });
            });
        },
        async create(input) {
            const { data, error } = await client.rpc("create_workspace", {
                p_name: input.name,
                p_slug: input.slug,
                p_industry_key: input.industryKey,
                p_industry_custom_label: input.industryCustomLabel,
                p_website_url: input.websiteUrl,
                p_country_code: input.countryCode,
                p_timezone: input.timezone,
                p_request_id: input.requestId,
            });
            if (error)
                mapSupabaseError(error);
            return parseWorkspaceRpcResult(data);
        },
        async get(workspaceId) {
            const { data, error } = await client
                .from("workspaces")
                .select(WORKSPACE_COLUMNS)
                .eq("id", workspaceId)
                .maybeSingle();
            if (error)
                mapSupabaseError(error);
            return data ? parseWorkspaceRow(data) : null;
        },
        async getRole(workspaceId, userId) {
            const { data, error } = await client
                .from("workspace_memberships")
                .select("role")
                .eq("workspace_id", workspaceId)
                .eq("user_id", userId)
                .maybeSingle();
            if (error)
                mapSupabaseError(error);
            if (!data)
                return null;
            const parsed = WorkspaceRoleSchema.safeParse(data.role);
            if (!parsed.success) {
                throw new HttpError(503, "workspace_response_invalid", "Workspace membership returned an invalid role.");
            }
            return parsed.data;
        },
        async update(workspaceId, input) {
            const validated = WorkspaceSettingsInputSchema.parse(input);
            const current = await this.get(workspaceId);
            if (!current)
                return null;
            const merged = WorkspaceBusinessInputSchema.safeParse({
                name: validated.name ?? current.name,
                slug: current.slug,
                industryKey: validated.industryKey ?? current.industryKey,
                industryCustomLabel: validated.industryCustomLabel === undefined
                    ? current.industryCustomLabel
                    : validated.industryCustomLabel,
                websiteUrl: validated.websiteUrl === undefined ? current.websiteUrl : validated.websiteUrl,
                countryCode: validated.countryCode === undefined ? current.countryCode : validated.countryCode,
                timezone: validated.timezone ?? current.timezone,
            });
            if (!merged.success) {
                throw new HttpError(400, "invalid_workspace_settings", "Review the business settings and try again.");
            }
            const { data, error } = await client.rpc("update_workspace_settings", {
                p_workspace_id: workspaceId,
                p_name: merged.data.name,
                p_industry_key: merged.data.industryKey,
                p_industry_custom_label: merged.data.industryCustomLabel,
                p_website_url: merged.data.websiteUrl,
                p_country_code: merged.data.countryCode,
                p_timezone: merged.data.timezone,
            });
            if (error)
                mapSupabaseError(error);
            return parseWorkspaceRpcResult(data);
        },
        async listMembers(workspaceId) {
            const { data, error } = await client
                .from("workspace_memberships")
                .select("id,workspace_id,user_id,role,created_at")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: true });
            if (error)
                mapSupabaseError(error);
            const parsed = WorkspaceMembersResponseSchema.safeParse({
                members: (data ?? []).map((member) => ({
                    id: member.id,
                    workspaceId: member.workspace_id,
                    userId: member.user_id,
                    role: member.role,
                    createdAt: member.created_at,
                })),
            });
            if (!parsed.success) {
                throw new HttpError(503, "workspace_response_invalid", "Workspace service returned invalid membership data.");
            }
            return parsed.data.members;
        },
    };
}
