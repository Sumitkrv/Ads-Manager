import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CampaignBriefSchema, CampaignListQuerySchema, CampaignWriteSchema, CampaignRoleSchema, hasWorkspacePermission, } from "@ai-ads/shared";
import { createRequireAuthenticatedUser } from "../auth.js";
import { HttpError } from "../errors.js";
import { createSupabaseCampaignRepository } from "./repository.js";
import { SimulationCampaignProvider, validateCampaign } from "./engine.js";
import { DemoMetricsProvider } from "./metrics.js";
import { DemoCampaignPublishingProvider } from "./publishing.js";
import { createSupabaseBillingUsageMeter } from "../billing/usage.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const optionalSeed = z.number().int().min(0).max(2_147_483_647).optional();
const DuplicateInputSchema = z.object({ name: z.string().trim().min(1).max(160) }).strict();
const GenerationInputSchema = z.object({ seed: optionalSeed, idempotencyKey: z.string().uuid().optional() }).strict();
const CommentsInputSchema = z.object({ comments: z.string().max(4000).default("") }).strict();
const RequestChangesInputSchema = z.object({ comments: z.string().trim().min(1).max(4000) }).strict();
const PublishInputSchema = z.object({ scenario: z.enum(["success", "provider_unavailable"]).default("success"), scenarioMetrics: z.enum(["low", "average", "high", "gradual_improvement", "decline"]).default("average"), seed: optionalSeed }).strict();
const generator = new SimulationCampaignProvider();
const metricsProvider = new DemoMetricsProvider();
const publishingProvider = new DemoCampaignPublishingProvider();
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function user(response) {
    const result = response.locals.authenticatedUser;
    if (!result)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return result;
}
function workspaceId(value) {
    if (typeof value !== "string" || !UUID.test(value))
        throw new HttpError(400, "invalid_workspace_id", "Workspace identifier is invalid.");
    return value;
}
function campaignId(value) {
    if (typeof value !== "string" || !UUID.test(value))
        throw new HttpError(400, "invalid_campaign_id", "Campaign identifier is invalid.");
    return value;
}
function repository(response, factory) {
    const token = response.locals.authenticatedAccessToken;
    const selected = factory === undefined ? createSupabaseCampaignRepository : factory;
    if (typeof token !== "string" || !selected)
        throw new HttpError(503, "campaign_service_unavailable", "Campaign storage is not available.");
    const instance = selected(token);
    if (!instance)
        throw new HttpError(503, "campaign_service_unavailable", "Campaign storage is not available.");
    return instance;
}
async function authorize(repo, workspace, actor, permission) {
    const role = CampaignRoleSchema.safeParse(await repo.getRole(workspace, actor.id));
    if (!role.success)
        throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    if (!hasWorkspacePermission(role.data, permission))
        throw new HttpError(403, "campaign_forbidden", "Your workspace role cannot perform this campaign action.");
    return role.data;
}
async function loadCampaign(repo, workspace, id) {
    const campaign = await repo.get(workspace, id);
    if (!campaign)
        throw new HttpError(404, "campaign_not_found", "The requested campaign was not found.");
    return campaign;
}
function inputForDatabase(input) {
    return { name: input.name, platform: input.platform, objective: input.objective, brief: input.brief, plan: input.plan };
}
function preserveGenerationAttribution(candidate, current) {
    return {
        ...candidate,
        generation: {
            ...candidate.generation,
            mode: current.generation.mode,
            label: current.generation.label,
            version: current.generation.version,
            seed: current.generation.seed,
            generatedAt: current.generation.generatedAt,
            inputSnapshot: current.generation.inputSnapshot,
        },
    };
}
function validation(repoCampaign) {
    return validateCampaign(repoCampaign.brief, repoCampaign.plan, repoCampaign.platform, repoCampaign.objective);
}
function isPlatform(value) { return value === "google_ads" || value === "meta_ads"; }
function parseBody(schema, value, code, message) {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new HttpError(400, code, message);
    return parsed.data;
}
export function createCampaignsRouter(apiConfig, verifyToken, dependencies = {}) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifyToken);
    const generation = dependencies.generationProvider ?? generator;
    const demoMetrics = dependencies.metricsProvider ?? metricsProvider;
    const repoFactory = dependencies.repositoryFactory === undefined ? createSupabaseCampaignRepository : dependencies.repositoryFactory;
    const usageFactory = dependencies.usageMeterFactory === undefined
        ? (dependencies.repositoryFactory === undefined ? createSupabaseBillingUsageMeter : null)
        : dependencies.usageMeterFactory;
    // Live copy generation is separate from provider campaign execution. Publishing stays demo-only.
    if (apiConfig.ADS_EXECUTION_MODE !== "demo") {
        router.use("/api/workspaces/:workspaceId/campaigns", (_request, _response, next) => next(new HttpError(503, "demo_mode_required", "Campaign Studio requires demo execution mode.")));
    }
    router.get("/api/workspaces/:workspaceId/campaigns", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const parsed = CampaignListQuerySchema.safeParse(request.query);
        if (!parsed.success)
            throw new HttpError(400, "campaign_query_invalid", "Campaign filters are invalid.");
        const result = await repo.list(workspace, parsed.data);
        response.status(200).json({ campaigns: result.campaigns, counts: result.counts, page: parsed.data.page, pageSize: parsed.data.pageSize, total: result.total });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.manage");
        const parsed = CampaignWriteSchema.safeParse(request.body);
        if (!parsed.success)
            throw new HttpError(400, "campaign_invalid", "Review the campaign details and try again.");
        if (!isPlatform(parsed.data.platform) || parsed.data.plan && parsed.data.plan.platform !== parsed.data.platform)
            throw new HttpError(400, "campaign_platform_mismatch", "Campaign format does not match the selected platform.");
        if (parsed.data.plan)
            throw new HttpError(400, "campaign_generation_required", "Generate campaign plans through Campaign Studio before saving them.");
        const campaign = await repo.create(workspace, actor.id, inputForDatabase(parsed.data));
        response.status(201).json({ campaign });
    }));
    router.get("/api/workspaces/:workspaceId/campaigns/:campaignId", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const campaign = await loadCampaign(repo, workspace, campaignId(request.params.campaignId));
        response.status(200).json({ campaign });
    }));
    router.patch("/api/workspaces/:workspaceId/campaigns/:campaignId", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.manage");
        const id = campaignId(request.params.campaignId);
        const parsed = CampaignWriteSchema.safeParse(request.body);
        if (!parsed.success || !parsed.data.expectedRevision)
            throw new HttpError(400, "campaign_invalid", "Review the campaign details and revision, then try again.");
        if (!isPlatform(parsed.data.platform) || parsed.data.plan && parsed.data.plan.platform !== parsed.data.platform)
            throw new HttpError(400, "campaign_platform_mismatch", "Campaign format does not match the selected platform.");
        const current = await loadCampaign(repo, workspace, id);
        if (parsed.data.plan && !current.plan)
            throw new HttpError(400, "campaign_generation_required", "Generate campaign plans through Campaign Studio before saving them.");
        const plan = parsed.data.plan && current.plan ? preserveGenerationAttribution(parsed.data.plan, current.plan) : parsed.data.plan;
        const campaign = await repo.save(workspace, id, parsed.data.expectedRevision, { ...inputForDatabase(parsed.data), plan });
        response.status(200).json({ campaign });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/duplicate", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.manage");
        const input = parseBody(DuplicateInputSchema, request.body, "campaign_name_required", "Enter a name for the duplicate.");
        const campaign = await repo.duplicate(workspace, campaignId(request.params.campaignId), input.name);
        response.status(201).json({ campaign });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/archive", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.manage");
        const campaign = await repo.archive(workspace, campaignId(request.params.campaignId));
        response.status(200).json({ campaign });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/generate-demo", authenticate, asyncRoute(async (request, response) => {
        if (apiConfig.CAMPAIGN_GENERATION_MODE !== "simulation")
            throw new HttpError(503, "simulation_generation_disabled", "Rule-based generation is disabled while live AI generation is selected.");
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.manage");
        const id = campaignId(request.params.campaignId);
        const campaign = await loadCampaign(repo, workspace, id);
        if (!isPlatform(campaign.platform))
            throw new HttpError(400, "campaign_platform_invalid", "Campaign platform is invalid.");
        const brief = CampaignBriefSchema.safeParse(campaign.brief);
        if (!brief.success)
            throw new HttpError(400, "campaign_brief_invalid", "Complete the campaign brief before generating.");
        const generationInput = parseBody(GenerationInputSchema, request.body, "campaign_generation_invalid", "Generation options are invalid.");
        const requestedSeed = generationInput.seed;
        const seed = requestedSeed ?? Number.parseInt(id.replaceAll("-", "").slice(0, 7), 16);
        const plan = generation.generateCampaign({ platform: campaign.platform, objective: campaign.objective, brief: brief.data, seed });
        const accessToken = response.locals.authenticatedAccessToken;
        const meter = typeof accessToken === "string" ? usageFactory?.(accessToken) : null;
        if (meter)
            await meter.consume(workspace, "campaign_generation_ops", generationInput.idempotencyKey ?? randomUUID());
        const saved = await repo.save(workspace, id, campaign.revision, { name: campaign.name, platform: campaign.platform, objective: campaign.objective, brief: brief.data, plan });
        response.status(200).json({ campaign: saved, generation: { mode: "simulation", label: "AI Simulation", version: plan.generation.version, generatedAt: plan.generation.generatedAt } });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/generate-openai", authenticate, asyncRoute(async () => {
        throw new HttpError(503, "live_generation_disabled", "Live AI campaign generation is disabled in this offline milestone.");
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/validate", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const campaign = await loadCampaign(repo, workspace, campaignId(request.params.campaignId));
        const issues = validation(campaign);
        response.status(200).json({ valid: !issues.some((issue) => issue.severity === "error"), label: "Passes local draft validation", providerVerified: false, issues });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/submit-review", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.review");
        const campaign = await loadCampaign(repo, workspace, campaignId(request.params.campaignId));
        const issues = validation(campaign);
        if (issues.some((issue) => issue.severity === "error")) {
            response.status(422).json({ status: "error", error: { code: "campaign_not_ready", message: "Resolve local validation errors before submitting for review.", issues } });
            return;
        }
        const comments = parseBody(CommentsInputSchema, request.body, "campaign_review_invalid", "Review comments are invalid.").comments;
        const saved = await repo.submitReview(workspace, campaign.id, campaign.revision, comments);
        response.status(200).json({ campaign: saved });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/approve-demo", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.approve");
        const campaign = await loadCampaign(repo, workspace, campaignId(request.params.campaignId));
        const issues = validation(campaign);
        if (issues.some((issue) => issue.severity === "error")) {
            response.status(422).json({ status: "error", error: { code: "campaign_not_ready", message: "Resolve local validation errors before approval.", issues } });
            return;
        }
        const comments = parseBody(CommentsInputSchema, request.body, "campaign_review_invalid", "Review comments are invalid.").comments;
        const saved = await repo.decideReview(workspace, campaign.id, "approved_for_demo", comments || "Approved for demo use.");
        response.status(200).json({ campaign: saved, message: "Approved for demo publishing. This is not approval by Google or Meta." });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/request-changes", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.approve");
        const comments = parseBody(RequestChangesInputSchema, request.body, "review_comment_required", "Add a review comment describing the requested changes.").comments;
        const saved = await repo.decideReview(workspace, campaignId(request.params.campaignId), "changes_requested", comments);
        response.status(200).json({ campaign: saved });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/reopen", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.approve");
        const comments = parseBody(CommentsInputSchema, request.body, "campaign_review_invalid", "Review comments are invalid.").comments;
        const saved = await repo.decideReview(workspace, campaignId(request.params.campaignId), "reopened", comments || "Reopened for edits.");
        response.status(200).json({ campaign: saved });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/simulate-publish", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.publishDemo");
        const campaign = await loadCampaign(repo, workspace, campaignId(request.params.campaignId));
        const issues = validation(campaign);
        if (issues.some((issue) => issue.severity === "error")) {
            response.status(422).json({ status: "error", error: { code: "campaign_not_ready", message: "Resolve local validation errors before simulating publishing.", issues } });
            return;
        }
        if (campaign.status !== "approved_for_demo" || campaign.approvedRevision !== campaign.revision)
            throw new HttpError(409, "campaign_approval_required", "The current campaign revision must be approved before demo publishing.");
        const input = parseBody(PublishInputSchema, request.body, "campaign_publish_invalid", "Demo publishing options are invalid.");
        const scenario = input.scenario;
        const seed = input.seed ?? Number.parseInt(campaign.id.replaceAll("-", "").slice(0, 7), 16);
        let resultMetrics = null;
        if (scenario === "success") {
            const start = new Date(`${campaign.brief.startDate}T12:00:00.000Z`);
            const duration = campaign.brief.endDate ? Math.max(1, Math.min(30, Math.floor((Date.parse(`${campaign.brief.endDate}T12:00:00.000Z`) - start.getTime()) / 86_400_000) + 1)) : 14;
            const daily = campaign.brief.budgetType === "daily" ? campaign.brief.budgetAmount : campaign.brief.budgetAmount / duration;
            resultMetrics = demoMetrics.generate(seed, input.scenarioMetrics, daily, duration, campaign.brief.startDate);
        }
        const attempt = await publishingProvider.publish({ repository: repo, workspaceId: workspace, campaignId: campaign.id, revision: campaign.revision, scenario, seed, metrics: resultMetrics });
        response.status(scenario === "success" ? 201 : 200).json({ status: typeof attempt.status === "string" ? attempt.status : "unknown", attempt, message: scenario === "success" ? "Published in Demo Mode — Not live on Google Ads or Meta Ads." : "The demo failure was recorded. Retry after reviewing the simulated error.", dataSource: scenario === "success" ? "demo_simulation" : null });
    }));
    router.get("/api/workspaces/:workspaceId/campaigns/:campaignId/activity", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const id = campaignId(request.params.campaignId);
        await loadCampaign(repo, workspace, id);
        const rows = await repo.activity(workspace, id);
        response.status(200).json({ activity: rows.map((row) => ({ id: row.id, event: row.event_type, actorUserId: row.actor_user_id, details: row.details, createdAt: row.created_at })) });
    }));
    router.get("/api/workspaces/:workspaceId/campaigns/:campaignId/reviews", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const id = campaignId(request.params.campaignId);
        await loadCampaign(repo, workspace, id);
        const rows = await repo.reviews(workspace, id);
        response.status(200).json({ reviews: rows.map((row) => ({ id: row.id, revision: row.draft_revision, decision: row.decision, reviewerUserId: row.reviewer_user_id, comments: row.comments, createdAt: row.created_at })) });
    }));
    router.get("/api/workspaces/:workspaceId/campaigns/:campaignId/revisions", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const id = campaignId(request.params.campaignId);
        await loadCampaign(repo, workspace, id);
        const rows = await repo.revisions(workspace, id);
        response.status(200).json({ revisions: rows.map((row) => ({ id: row.id, revision: row.revision, name: row.name, objective: row.objective, changedByUserId: row.changed_by_user_id, createdAt: row.created_at })) });
    }));
    router.get("/api/workspaces/:workspaceId/campaigns/:campaignId/demo-analytics", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const id = campaignId(request.params.campaignId);
        await loadCampaign(repo, workspace, id);
        const rows = await repo.analytics(workspace, id);
        response.status(200).json({ label: "Simulated Data — Not Actual Ad Performance", analytics: rows.map((row) => ({ id: row.id, scenario: row.scenario, seed: row.seed, metrics: row.metrics, dataSource: row.data_source, simulatedAt: row.simulated_at })) });
    }));
    router.get("/api/workspaces/:workspaceId/campaigns/:campaignId/demo-publishing", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const actor = user(response);
        const repo = repository(response, repoFactory);
        await authorize(repo, workspace, actor, "campaigns.read");
        const id = campaignId(request.params.campaignId);
        await loadCampaign(repo, workspace, id);
        const rows = await repo.publishingAttempts(workspace, id);
        response.status(200).json({ label: "Published in Demo Mode — Not live on Google Ads or Meta Ads", attempts: rows.map((row) => ({ id: row.id, status: row.status, scenario: row.scenario, failureCode: row.failure_code, localDemoReference: row.local_demo_reference, revision: row.draft_revision, publishedExternally: row.published_externally, createdAt: row.created_at, completedAt: row.completed_at })) });
    }));
    return router;
}
