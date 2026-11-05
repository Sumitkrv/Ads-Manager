import express from "express";
import { z } from "zod";
import { PlatformTourProgressInputSchema } from "@ai-ads/shared";
import { createRequireAuthenticatedUser } from "../auth.js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { verifySupabaseAccessToken } from "../supabase-auth.js";
import { createSupabasePlatformAdminRepository, createWorkspaceSupportRepository } from "./repository.js";
const Id = z.string().uuid();
const Page = z.coerce.number().int().min(1).max(100000).default(1);
const PageSize = z.coerce.number().int().min(1).max(100).default(25);
const TenantStatus = z.enum(["UNDER_REVIEW", "SUSPENSION_PENDING", "SUSPENDED", "RESTORATION_PENDING", "ACTIVE"]);
const SupportCategory = z.enum(["authentication", "onboarding", "permissions", "billing", "storage", "campaigns", "reports", "agency", "other"]);
const SupportStatus = z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]);
const Flag = z.enum(["campaign_studio_enabled", "creative_studio_enabled", "optimization_studio_enabled", "automation_studio_enabled", "advanced_analytics_enabled", "agency_portal_enabled", "demo_publishing_enabled", "billing_simulation_enabled"]);
function asyncRoute(fn) { return (req, res, next) => { void fn(req, res).catch(next); }; }
function user(res) {
    const value = res.locals.authenticatedUser;
    if (!value)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return value;
}
function repo(res, deps, apiConfig) {
    const value = (deps.repositoryFactory ?? createSupabasePlatformAdminRepository)(apiConfig);
    if (!value)
        throw new HttpError(503, "platform_admin_unconfigured", "Platform administration is not configured on this server.");
    return value;
}
async function requireCapability(res, deps, apiConfig, capability) {
    const actor = user(res);
    const repository = repo(res, deps, apiConfig);
    if (!await repository.hasCapability(actor.id, capability)) {
        await repository.rpc("platform_admin_record_denied_attempt", { p_actor: actor.id, p_capability: capability }).catch(() => undefined);
        throw new HttpError(403, "platform_capability_required", "Your account does not have this platform capability.");
    }
    return { actor, repository };
}
async function requirePlatformTourAccess(res, deps, apiConfig) {
    return requireCapability(res, deps, apiConfig, "platform.dashboard.read");
}
function obj(value) { if (value && typeof value === "object" && !Array.isArray(value))
    return value; throw new HttpError(503, "platform_response_invalid", "Platform operations returned an invalid response."); }
function queryText(value, max = 120) { if (typeof value !== "string")
    return null; const result = value.trim().slice(0, max); return result || null; }
function queryEnum(schema, value) { if (typeof value !== "string" || value === "")
    return null; const parsed = schema.safeParse(value); if (!parsed.success)
    throw new HttpError(400, "platform_filter_invalid", "A platform filter is invalid."); return parsed.data; }
export function createPlatformAdminRouter(apiConfig = config, verifier, deps = {}) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifier === undefined ? (apiConfig.supabaseConfigured ? verifySupabaseAccessToken : null) : verifier);
    const admin = (cap, handler) => asyncRoute(async (req, res) => { const access = await requireCapability(res, deps, apiConfig, cap); await handler(req, res, access.actor, access.repository); });
    router.get("/api/platform-admin/access", authenticate, asyncRoute(async (_req, res) => {
        const current = user(res), repository = repo(res, deps, apiConfig);
        const candidates = ["platform.dashboard.read", "platform.tenants.read", "platform.tenants.manage", "platform.users.read", "platform.support.manage", "platform.billing.read", "platform.billing.manage", "platform.usage.read", "platform.audit.read", "platform.health.read", "platform.settings.manage", "platform.admin.provision"];
        const grants = await Promise.all(candidates.map(async (key) => [key, await repository.hasCapability(current.id, key)]));
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json({ allowed: grants.some(([, allowed]) => allowed), capabilities: Object.fromEntries(grants) });
    }));
    router.get("/api/platform-admin/tour-progress", authenticate, asyncRoute(async (_req, res) => {
        const { actor, repository } = await requirePlatformTourAccess(res, deps, apiConfig);
        const row = await repository.getTourProgress(actor.id);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json({ progress: row ? { tourId: row.tour_id, stepIndex: row.step_index, status: row.status, startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at } : null });
    }));
    router.post("/api/platform-admin/tour-progress", authenticate, asyncRoute(async (req, res) => {
        const parsed = PlatformTourProgressInputSchema.safeParse(req.body);
        if (!parsed.success)
            throw new HttpError(400, "platform_tour_progress_invalid", "Platform tour progress is invalid.");
        const { actor, repository } = await requirePlatformTourAccess(res, deps, apiConfig);
        const row = await repository.saveTourProgress(actor.id, parsed.data.stepIndex, parsed.data.status);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json({ progress: { tourId: row.tour_id, stepIndex: row.step_index, status: row.status, startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at } });
    }));
    router.get("/api/platform-admin/overview", authenticate, admin("platform.dashboard.read", async (_req, res, actor, r) => {
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_overview", { p_actor: actor.id })));
    }));
    router.get("/api/platform-admin/tenants", authenticate, admin("platform.tenants.read", async (req, res, actor, r) => {
        const parsed = z.object({ page: Page, pageSize: PageSize, search: z.string().max(200).optional(), industry: z.string().max(80).optional(), status: z.string().max(40).optional(), plan: z.string().max(80).optional() }).safeParse(req.query);
        if (!parsed.success)
            throw new HttpError(400, "platform_query_invalid", "Tenant filters are invalid.");
        const q = parsed.data;
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_list_tenants", { p_actor: actor.id, p_page: q.page, p_page_size: q.pageSize, p_search: queryText(q.search, 120), p_industry: queryText(q.industry, 80), p_status: queryText(q.status, 40), p_plan: queryText(q.plan, 80) })));
    }));
    router.get("/api/platform-admin/tenants/:workspaceId", authenticate, admin("platform.tenants.read", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.workspaceId);
        if (!id.success)
            throw new HttpError(400, "workspace_id_invalid", "Workspace identifier is invalid.");
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_tenant_detail", { p_actor: actor.id, p_workspace_id: id.data })));
    }));
    router.post("/api/platform-admin/tenants/:workspaceId/flag", authenticate, admin("platform.tenants.manage", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.workspaceId), input = z.object({ reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!id.success || !input.success)
            throw new HttpError(400, "tenant_flag_invalid", "Workspace and review reason are required.");
        res.status(200).json(obj(await r.rpc("platform_admin_set_tenant_status", { p_actor: actor.id, p_workspace_id: id.data, p_next_status: "UNDER_REVIEW", p_reason: input.data.reason })));
    }));
    router.post("/api/platform-admin/tenants/:workspaceId/status", authenticate, admin("platform.tenants.manage", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.workspaceId), input = z.object({ status: TenantStatus, reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!id.success || !input.success)
            throw new HttpError(400, "tenant_transition_invalid", "Workspace lifecycle transition is invalid.");
        res.status(200).json(obj(await r.rpc("platform_admin_set_tenant_status", { p_actor: actor.id, p_workspace_id: id.data, p_next_status: input.data.status, p_reason: input.data.reason })));
    }));
    router.get("/api/platform-admin/users", authenticate, admin("platform.users.read", async (req, res, actor, r) => {
        const parsed = z.object({ page: Page, pageSize: PageSize, search: z.string().max(200).optional() }).safeParse(req.query);
        if (!parsed.success)
            throw new HttpError(400, "platform_query_invalid", "User filters are invalid.");
        const q = parsed.data;
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_list_users", { p_actor: actor.id, p_page: q.page, p_page_size: q.pageSize, p_search: queryText(q.search, 200) })));
    }));
    router.get("/api/platform-admin/users/:userId", authenticate, admin("platform.users.read", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.userId);
        if (!id.success)
            throw new HttpError(400, "user_id_invalid", "User identifier is invalid.");
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_user_detail", { p_actor: actor.id, p_user_id: id.data })));
    }));
    router.get("/api/platform-admin/usage", authenticate, admin("platform.usage.read", async (req, res, actor, r) => {
        const parsed = z.object({ page: Page, pageSize: PageSize, sort: z.enum(["storage_bytes", "campaigns", "creatives", "members", "name"]).default("storage_bytes") }).safeParse(req.query);
        if (!parsed.success)
            throw new HttpError(400, "platform_query_invalid", "Usage filters are invalid.");
        const q = parsed.data;
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_usage", { p_actor: actor.id, p_page: q.page, p_page_size: q.pageSize, p_sort: q.sort })));
    }));
    router.get("/api/platform-admin/health", authenticate, admin("platform.health.read", async (_req, res, actor, r) => {
        const probe = obj(await r.rpc("platform_admin_health_probe", { p_actor: actor.id }));
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json({ api: { status: "HEALTHY", source: "This authenticated API request was served" }, database: { status: probe.database, checkedAt: probe.checked_at, source: probe.source }, auth: { status: "HEALTHY", source: "Current operator token was verified for this request" }, storage: { status: "UNKNOWN", source: "No isolated Storage health probe is configured" }, backgroundWorkers: { status: "UNKNOWN", source: "No continuously running worker is configured" }, migrationStatus: { status: "UNKNOWN", source: "Migration history is not queried by the admin API" } });
    }));
    router.get("/api/platform-admin/audit", authenticate, admin("platform.audit.read", async (req, res, actor, r) => {
        const parsed = z.object({ page: Page, pageSize: PageSize, search: z.string().max(100).optional() }).safeParse(req.query);
        if (!parsed.success)
            throw new HttpError(400, "platform_query_invalid", "Audit filters are invalid.");
        const q = parsed.data;
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_audit", { p_actor: actor.id, p_page: q.page, p_page_size: q.pageSize, p_search: queryText(q.search, 100) })));
    }));
    router.get("/api/platform-admin/support", authenticate, admin("platform.support.manage", async (req, res, actor, r) => {
        const parsed = z.object({ page: Page, pageSize: PageSize, status: z.string().optional(), search: z.string().max(120).optional() }).safeParse(req.query);
        if (!parsed.success)
            throw new HttpError(400, "platform_query_invalid", "Support filters are invalid.");
        const q = parsed.data;
        const status = queryEnum(SupportStatus, q.status);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_list_support_cases", { p_actor: actor.id, p_page: q.page, p_page_size: q.pageSize, p_status: status, p_search: queryText(q.search, 120) })));
    }));
    router.get("/api/platform-admin/support/:caseId", authenticate, admin("platform.support.manage", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.caseId);
        if (!id.success)
            throw new HttpError(400, "support_case_id_invalid", "Support case identifier is invalid.");
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_support_case_detail", { p_actor: actor.id, p_case_id: id.data })));
    }));
    router.post("/api/platform-admin/support", authenticate, admin("platform.support.manage", async (req, res, actor, r) => {
        const input = z.object({ workspaceId: Id.nullable().optional(), category: SupportCategory, priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"), subject: z.string().trim().min(4).max(160), description: z.string().trim().min(10).max(5000) }).strict().safeParse(req.body);
        if (!input.success)
            throw new HttpError(400, "support_case_invalid", "Support case details are invalid.");
        res.status(201).json(obj(await r.rpc("platform_admin_create_support_case", { p_actor: actor.id, p_workspace_id: input.data.workspaceId ?? null, p_category: input.data.category, p_priority: input.data.priority, p_subject: input.data.subject, p_description: input.data.description })));
    }));
    router.patch("/api/platform-admin/support/:caseId", authenticate, admin("platform.support.manage", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.caseId), input = z.object({ status: SupportStatus, assignedTo: Id.nullable().optional(), resolution: z.string().max(2000).nullable().optional(), internalNote: z.string().trim().min(1).max(4000).nullable().optional() }).strict().safeParse(req.body);
        if (!id.success || !input.success)
            throw new HttpError(400, "support_update_invalid", "Support case update is invalid.");
        const q = input.data;
        res.status(200).json(obj(await r.rpc("platform_admin_update_support_case", { p_actor: actor.id, p_case_id: id.data, p_status: q.status, p_assigned_to: q.assignedTo ?? null, p_resolution: q.resolution ?? null, p_note: q.internalNote ?? null })));
    }));
    router.post("/api/platform-admin/support/:caseId/access-requests", authenticate, admin("platform.support.manage", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.caseId), input = z.object({ scopeKeys: z.array(z.enum(["workspace_metadata", "campaign_status", "creative_metadata", "report_metadata", "storage_diagnostics"])).min(1).max(5), reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!id.success || !input.success)
            throw new HttpError(400, "support_access_request_invalid", "A limited scope and reason are required.");
        res.status(201).json(obj(await r.rpc("platform_admin_support_access_request", { p_actor: actor.id, p_case_id: id.data, p_scope_keys: input.data.scopeKeys, p_reason: input.data.reason })));
    }));
    router.post("/api/platform-admin/support/access-requests/:requestId/revoke", authenticate, admin("platform.support.manage", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.requestId), input = z.object({ reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!id.success || !input.success)
            throw new HttpError(400, "support_access_revoke_invalid", "A revocation reason is required.");
        res.status(200).json(obj(await r.rpc("platform_admin_revoke_support_access", { p_actor: actor.id, p_access_request_id: id.data, p_reason: input.data.reason })));
    }));
    router.get("/api/platform-admin/settings", authenticate, admin("platform.settings.manage", async (_req, res, actor, r) => {
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json(obj(await r.rpc("platform_admin_settings", { p_actor: actor.id })));
    }));
    router.patch("/api/platform-admin/settings/:key", authenticate, admin("platform.settings.manage", async (req, res, actor, r) => {
        const input = z.object({ value: z.unknown(), reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!input.success)
            throw new HttpError(400, "platform_setting_invalid", "Setting update is invalid.");
        res.status(200).json(obj(await r.rpc("platform_admin_update_setting", { p_actor: actor.id, p_key: req.params.key, p_value: input.data.value, p_reason: input.data.reason })));
    }));
    router.patch("/api/platform-admin/feature-flags/:flag", authenticate, admin("platform.settings.manage", async (req, res, actor, r) => {
        const flag = Flag.safeParse(req.params.flag), input = z.object({ enabled: z.boolean(), reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!flag.success || !input.success)
            throw new HttpError(400, "platform_flag_invalid", "Feature flag update is invalid.");
        res.status(200).json(obj(await r.rpc("platform_admin_update_feature_flag", { p_actor: actor.id, p_flag_key: flag.data, p_enabled: input.data.enabled, p_reason: input.data.reason })));
    }));
    router.post("/api/platform-admin/users/:userId/roles", authenticate, admin("platform.admin.provision", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.userId), input = z.object({ role: z.enum(["super_admin", "operations_admin", "support_agent", "billing_admin", "auditor"]), reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!id.success || !input.success)
            throw new HttpError(400, "platform_role_invalid", "Platform role grant is invalid.");
        res.status(201).json(obj(await r.rpc("platform_admin_grant_role", { p_actor: actor.id, p_user_id: id.data, p_role_key: input.data.role, p_reason: input.data.reason })));
    }));
    router.post("/api/platform-admin/roles/:assignmentId/revoke", authenticate, admin("platform.admin.provision", async (req, res, actor, r) => {
        const id = Id.safeParse(req.params.assignmentId), input = z.object({ reason: z.string().trim().min(8).max(500) }).strict().safeParse(req.body);
        if (!id.success || !input.success)
            throw new HttpError(400, "platform_role_invalid", "Platform role revocation is invalid.");
        res.status(200).json(obj(await r.rpc("platform_admin_revoke_role", { p_actor: actor.id, p_assignment_id: id.data, p_reason: input.data.reason })));
    }));
    const supportFactory = deps.supportRepositoryFactory ?? ((token, selected) => createWorkspaceSupportRepository(token, selected));
    router.get("/api/workspaces/:workspaceId/support/cases", authenticate, asyncRoute(async (req, res) => {
        const id = Id.safeParse(req.params.workspaceId), accessToken = res.locals.authenticatedAccessToken;
        if (!id.success || typeof accessToken !== "string")
            throw new HttpError(400, "support_workspace_invalid", "Workspace support query is invalid.");
        const client = supportFactory(accessToken, apiConfig);
        if (!client)
            throw new HttpError(503, "support_unavailable", "Workspace support is not configured.");
        const [cases, requests] = await Promise.all([client.list(id.data), client.accessRequests(id.data)]);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json({ cases, accessRequests: requests });
    }));
    router.post("/api/workspaces/:workspaceId/support/cases", authenticate, asyncRoute(async (req, res) => {
        const id = Id.safeParse(req.params.workspaceId), input = z.object({ category: SupportCategory, subject: z.string().trim().min(4).max(160), description: z.string().trim().min(10).max(5000) }).strict().safeParse(req.body), accessToken = res.locals.authenticatedAccessToken;
        if (!id.success || !input.success || typeof accessToken !== "string")
            throw new HttpError(400, "support_case_invalid", "Support case details are invalid.");
        const client = supportFactory(accessToken, apiConfig);
        if (!client)
            throw new HttpError(503, "support_unavailable", "Workspace support is not configured.");
        res.status(201).json({ case: obj(await client.create(id.data, input.data.category, input.data.subject, input.data.description)), message: "Support request recorded in Tandem Ads." });
    }));
    router.post("/api/workspaces/:workspaceId/support/access-requests/:requestId/decision", authenticate, asyncRoute(async (req, res) => {
        const workspace = Id.safeParse(req.params.workspaceId), requestId = Id.safeParse(req.params.requestId), input = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) }).strict().safeParse(req.body), accessToken = res.locals.authenticatedAccessToken;
        if (!workspace.success || !requestId.success || !input.success || typeof accessToken !== "string")
            throw new HttpError(400, "support_decision_invalid", "Support access decision is invalid.");
        const client = supportFactory(accessToken, apiConfig);
        if (!client)
            throw new HttpError(503, "support_unavailable", "Workspace support is not configured.");
        res.status(200).json(obj(await client.decide(requestId.data, input.data.decision)));
    }));
    return router;
}
