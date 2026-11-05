import express from "express";
import { z } from "zod";
import { AutomationExecutionDecisionSchema, AutomationRuleDefinitionSchema, AutomationRuleInputSchema, AutomationRunInputSchema, BudgetScenarioInputSchema, NotificationUpdateSchema, RecommendationDecisionSchema, WorkspaceRoleSchema, hasWorkspacePermission, } from "@ai-ads/shared";
import { createRequireAuthenticatedUser } from "../auth.js";
import { HttpError } from "../errors.js";
import { analyzePerformance, deriveDailyTrend, detectRecommendations, projectBudgetScenario } from "./engine.js";
import { evaluateRule } from "./rule-engine.js";
import { createSupabaseOptimizationRepository } from "./repository.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PageSchema = z.object({ page: z.coerce.number().int().positive().max(10000).default(1), pageSize: z.coerce.number().int().positive().max(100).default(25) });
const RuleSaveSchema = AutomationRuleInputSchema;
const ScenarioActionSchema = z.object({ action: z.enum(["submit", "approve", "reject", "apply"]), expectedVersion: z.number().int().positive(), comments: z.string().trim().max(2000).default("") }).strict();
const RecommendationCreateSchema = z.object({ campaignId: z.string().uuid() }).strict();
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function actor(response) {
    const value = response.locals.authenticatedUser;
    if (!value)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return value;
}
function parseId(value, name) {
    if (typeof value !== "string" || !UUID.test(value))
        throw new HttpError(400, `invalid_${name}`, `The ${name.replaceAll("_", " ")} is invalid.`);
    return value;
}
function repoFor(response, factory) {
    const token = response.locals.authenticatedAccessToken;
    const selected = factory === undefined ? createSupabaseOptimizationRepository : factory;
    if (typeof token !== "string" || !selected)
        throw new HttpError(503, "optimization_service_unavailable", "Optimization storage is not available.");
    const value = selected(token);
    if (!value)
        throw new HttpError(503, "optimization_service_unavailable", "Optimization storage is not available.");
    return value;
}
async function authorize(repo, workspaceId, user, capability) {
    const role = WorkspaceRoleSchema.safeParse(await repo.getRole(workspaceId, user.id));
    if (!role.success)
        throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    if (!hasWorkspacePermission(role.data, capability))
        throw new HttpError(403, "optimization_forbidden", "Your workspace role cannot perform this action.");
    return role.data;
}
function parseBody(schema, body, code, message) {
    const parsed = schema.safeParse(body);
    if (!parsed.success)
        throw new HttpError(400, code, message);
    return parsed.data;
}
function metricsSource(row) { return row.metrics; }
function rowId(row, field) { return typeof row[field] === "string" ? row[field] : ""; }
function campaignWithMetrics(campaign, analytics) {
    const latest = analytics.find((item) => rowId(item, "campaign_id") === campaign.id);
    if (!latest)
        return { campaign, analytics: null, metric: null };
    return { campaign, analytics: latest, metric: analyzePerformance(campaign, metricsSource(latest)) };
}
function recommendationPayload(row, campaign, analytics) {
    const source = analytics.find((item) => rowId(item, "id") === row.source_analytics_id);
    const metric = source ? analyzePerformance(campaign, source.metrics) : null;
    const draft = metric ? detectRecommendations(campaign, metric, source?.metrics).find((item) => item.type === row.recommendation_type) : null;
    const automationDraft = row.recommendation_type === "automation_rule_match" && metric ? {
        category: "campaign_configuration", priority: "medium", type: "automation_rule_match",
        title: "Approved automation review item", detected: "An owner/admin approved a manual automation proposal based on stored simulated metrics.",
        evidence: { metrics: metric, source: "demo_simulation", label: metric.label },
        proposedAction: { action: "review_automation_output", requiresApproval: false },
        tradeoffs: ["This record is an internal review item and does not modify provider settings."],
        evidenceLimitations: ["No external advertising action or live campaign change occurred."], confidence: "low",
    } : null;
    const resolvedDraft = draft ?? automationDraft;
    if (!resolvedDraft)
        return null;
    return {
        id: row.id, workspaceId: row.workspace_id, campaignId: row.campaign_id, campaignName: campaign.name,
        campaignRevision: row.campaign_revision, platform: campaign.platform, ...resolvedDraft,
        status: row.lifecycle_status, version: row.version, createdAt: row.created_at,
    };
}
function scenarioPayload(row, campaign, analytics) {
    const source = analytics.find((item) => rowId(item, "id") === row.source_analytics_id);
    const baseline = source ? analyzePerformance(campaign, source.metrics) : null;
    const currentBudget = Number(row.current_budget);
    const proposedBudget = Number(row.proposed_budget);
    const projection = baseline ? projectBudgetScenario(baseline, currentBudget, proposedBudget, row.budget_type) : null;
    return {
        id: row.id, workspaceId: row.workspace_id, campaignId: row.campaign_id, campaignName: campaign.name,
        campaignRevision: row.campaign_revision, version: row.version, name: row.scenario_name,
        currency: row.currency, budgetType: row.budget_type, currentBudget, proposedBudget,
        adjustment: row.adjustment_type, baseline, projection: projection?.projection ?? null,
        assumptions: projection?.assumptions ?? ["Stored demo analytics are no longer available; this scenario cannot be projected."],
        status: row.lifecycle_status, createdAt: row.created_at, approvedAt: row.approved_at ?? null, appliedAt: row.applied_at ?? null,
    };
}
function camelRow(row, mapping) {
    return Object.fromEntries(Object.entries(mapping).map(([key, source]) => [key, row[source] ?? null]));
}
export function createOptimizationRouter(apiConfig, verifyToken, dependencies = {}) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifyToken);
    const factory = dependencies.repositoryFactory === undefined ? createSupabaseOptimizationRepository : dependencies.repositoryFactory;
    if (apiConfig.ADS_EXECUTION_MODE !== "demo") {
        router.use("/api/workspaces/:workspaceId/optimization", (_request, _response, next) => next(new HttpError(503, "demo_mode_required", "Optimization requires demo execution mode.")));
    }
    router.get("/api/workspaces/:workspaceId/optimization/overview", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "optimization.read");
        const [campaigns, analytics, recommendationRows, scenarios, executions] = await Promise.all([repo.campaigns(workspaceId), repo.analytics(workspaceId), repo.recommendations(workspaceId), repo.scenarios(workspaceId), repo.executions(workspaceId, 1, 5)]);
        const campaignViews = campaigns.map((campaign) => campaignWithMetrics(campaign, analytics)).filter((item) => item.metric);
        const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
        const recommendations = recommendationRows.map((row) => { const campaign = campaignById.get(rowId(row, "campaign_id")); return campaign ? recommendationPayload(row, campaign, analytics) : null; }).filter(Boolean);
        const demoPublished = campaigns.filter((campaign) => campaign.status === "demo_published" && !campaign.publishedExternally).length;
        const counts = campaigns.reduce((all, campaign) => { all[campaign.status] = (all[campaign.status] ?? 0) + 1; return all; }, {});
        response.status(200).json({ label: "Simulated Data — Not Actual Ad Performance", campaigns: campaignViews.filter(({ campaign }) => campaign.status === "demo_published" && !campaign.publishedExternally).map(({ campaign, analytics: source, metric }) => ({ id: campaign.id, name: campaign.name, platform: campaign.platform, status: campaign.status, revision: campaign.revision, currency: campaign.brief.currency, currentBudget: campaign.brief.budgetAmount, budgetType: campaign.brief.budgetType, metric, trend: deriveDailyTrend(source?.metrics) })), campaignCounts: counts, demoPublished, recommendationCounts: recommendationRows.reduce((all, row) => { const status = String(row.lifecycle_status); all[status] = (all[status] ?? 0) + 1; return all; }, {}), recommendations, recentExecutions: executions.rows.map((row) => camelRow(row, { id: "id", ruleId: "rule_id", campaignId: "campaign_id", status: "lifecycle_status", matched: "matched", createdAt: "created_at" })), automationRules: (await repo.rules(workspaceId)).length, scenarios: scenarios.length, insufficientData: demoPublished === 0 });
    }));
    router.get("/api/workspaces/:workspaceId/optimization/recommendations", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "optimization.read");
        const [campaigns, analytics, rows] = await Promise.all([repo.campaigns(workspaceId), repo.analytics(workspaceId), repo.recommendations(workspaceId)]);
        const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
        const values = rows.map((row) => { const campaign = byId.get(rowId(row, "campaign_id")); return campaign ? recommendationPayload(row, campaign, analytics) : null; }).filter(Boolean);
        response.status(200).json({ recommendations: values, total: values.length, page: 1, pageSize: values.length || 1 });
    }));
    router.post("/api/workspaces/:workspaceId/optimization/analyze", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "optimization.manage");
        const input = parseBody(RecommendationCreateSchema, request.body, "optimization_input_invalid", "Choose a campaign to analyze.");
        const [campaigns, analytics] = await Promise.all([repo.campaigns(workspaceId), repo.analytics(workspaceId, input.campaignId)]);
        const campaign = campaigns.find((item) => item.id === input.campaignId && item.status === "demo_published" && !item.publishedExternally);
        if (!campaign)
            throw new HttpError(404, "demo_campaign_not_found", "Select a demo-published campaign in this workspace.");
        const latest = analytics[0];
        if (!latest)
            throw new HttpError(422, "demo_metrics_unavailable", "This campaign has no stored simulated performance data.");
        const metric = analyzePerformance(campaign, latest.metrics);
        const drafts = detectRecommendations(campaign, metric, latest.metrics);
        const persisted = await Promise.all(drafts.map((draft) => repo.createRecommendation(workspaceId, campaign.id, rowId(latest, "id"), draft.type)));
        const rows = await repo.recommendations(workspaceId);
        const results = rows.filter((row) => persisted.some((item) => item.id === row.id)).map((row) => recommendationPayload(row, campaign, analytics)).filter(Boolean);
        response.status(200).json({ label: "Offline Optimization Intelligence", metrics: metric, recommendations: results, count: results.length });
    }));
    router.post("/api/workspaces/:workspaceId/optimization/recommendations/:recommendationId/decision", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const id = parseId(request.params.recommendationId, "recommendation_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        const input = parseBody(RecommendationDecisionSchema, request.body, "recommendation_decision_invalid", "The recommendation decision is invalid.");
        await authorize(repo, workspaceId, user, input.action === "approve" || input.action === "reject" ? "optimization.approve" : "optimization.manage");
        if (input.action === "apply_demo")
            throw new HttpError(409, "scenario_required", "Recommendations are evidence and review items. Use a budget scenario to apply a specific demo-only budget change.");
        const result = await repo.transitionRecommendation(id, input.expectedVersion, input.action, input.comments);
        if (result.workspace_id !== workspaceId)
            throw new HttpError(404, "recommendation_not_found", "The recommendation was not found.");
        response.status(200).json({ recommendation: result });
    }));
    router.get("/api/workspaces/:workspaceId/optimization/scenarios", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "optimization.read");
        const [campaigns, analytics, rows] = await Promise.all([repo.campaigns(workspaceId), repo.analytics(workspaceId), repo.scenarios(workspaceId)]);
        const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
        response.status(200).json({ scenarios: rows.map((row) => { const campaign = byId.get(rowId(row, "campaign_id")); return campaign ? scenarioPayload(row, campaign, analytics) : null; }).filter(Boolean) });
    }));
    router.post("/api/workspaces/:workspaceId/optimization/scenarios", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "optimization.manage");
        const input = parseBody(BudgetScenarioInputSchema, request.body, "scenario_invalid", "Review the budget scenario values.");
        const [campaigns, analytics] = await Promise.all([repo.campaigns(workspaceId), repo.analytics(workspaceId, input.campaignId)]);
        const campaign = campaigns.find((item) => item.id === input.campaignId && item.status === "demo_published" && !item.publishedExternally);
        const latest = analytics[0];
        if (!campaign || !latest)
            throw new HttpError(422, "demo_campaign_metrics_required", "A demo-published campaign with stored simulated metrics is required.");
        const currentBudget = campaign.brief.budgetAmount;
        const proposedBudget = input.adjustment === "percentage" ? Math.round(currentBudget * (1 + input.proposedBudget / 100) * 100) / 100 : input.proposedBudget;
        if (!(proposedBudget > 0) || proposedBudget > 10_000_000)
            throw new HttpError(400, "scenario_budget_invalid", "The resulting budget must be positive and within the demo limit.");
        const row = await repo.createScenario(workspaceId, campaign.id, rowId(latest, "id"), input.name, proposedBudget, input.adjustment);
        const baseline = analyzePerformance(campaign, latest.metrics);
        const projection = projectBudgetScenario(baseline, currentBudget, proposedBudget, campaign.brief.budgetType);
        response.status(201).json({ scenario: { ...scenarioPayload(row, campaign, analytics), baseline, projection: projection.projection, assumptions: projection.assumptions } });
    }));
    router.post("/api/workspaces/:workspaceId/optimization/scenarios/:scenarioId/transition", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const id = parseId(request.params.scenarioId, "scenario_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        const input = parseBody(ScenarioActionSchema, request.body, "scenario_transition_invalid", "The scenario transition is invalid.");
        await authorize(repo, workspaceId, user, input.action === "submit" ? "optimization.manage" : "optimization.approve");
        const result = await repo.transitionScenario(id, input.expectedVersion, input.action, input.comments);
        if (result.workspace_id !== workspaceId)
            throw new HttpError(404, "scenario_not_found", "The budget scenario was not found.");
        response.status(200).json({ scenario: result, appliedExternally: false, label: "Demo budget only — no provider operation" });
    }));
    router.get("/api/workspaces/:workspaceId/optimization/creative-insights", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "optimization.read");
        response.status(200).json({ status: "insufficient_data", label: "Simulated Data — Not Actual Ad Performance", message: "Creative-level simulated impressions and clicks are not stored yet. Campaign-level metrics are not attributed to individual creatives, so no creative winner or loser is inferred.", creatives: [] });
    }));
    router.get("/api/workspaces/:workspaceId/optimization/history", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "optimization.read");
        const page = PageSchema.parse(request.query);
        const result = await repo.activity(workspaceId, page.page, page.pageSize);
        response.status(200).json({ items: result.rows, total: result.total, page: page.page, pageSize: page.pageSize });
    }));
    router.get("/api/workspaces/:workspaceId/automation/rules", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "automation.read");
        const rows = await repo.rules(workspaceId);
        response.status(200).json({ rules: rows.map((row) => ({ id: row.id, workspaceId: row.workspace_id, name: row.name, definition: row.definition, version: row.version, enabled: row.enabled, createdAt: row.created_at, updatedAt: row.updated_at })) });
    }));
    router.post("/api/workspaces/:workspaceId/automation/rules", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "automation.manage");
        const input = parseBody(RuleSaveSchema, request.body, "automation_rule_invalid", "Review the rule name, condition and action.");
        const definition = AutomationRuleDefinitionSchema.parse(input.definition);
        const row = await repo.saveRule(workspaceId, null, null, input.name, definition, input.enabled);
        response.status(201).json({ rule: { id: row.id, workspaceId: row.workspace_id, name: row.name, definition: row.definition, version: row.version, enabled: row.enabled, createdAt: row.created_at, updatedAt: row.updated_at } });
    }));
    router.patch("/api/workspaces/:workspaceId/automation/rules/:ruleId", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const id = parseId(request.params.ruleId, "rule_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "automation.manage");
        const input = parseBody(RuleSaveSchema, request.body, "automation_rule_invalid", "Review the rule name, condition and action.");
        if (input.expectedVersion === undefined)
            throw new HttpError(400, "automation_version_required", "The current rule version is required to save changes.");
        const row = await repo.saveRule(workspaceId, id, input.expectedVersion, input.name, input.definition, input.enabled);
        if (row.workspace_id !== workspaceId)
            throw new HttpError(404, "automation_rule_not_found", "The rule was not found.");
        response.status(200).json({ rule: { id: row.id, workspaceId: row.workspace_id, name: row.name, definition: row.definition, version: row.version, enabled: row.enabled, createdAt: row.created_at, updatedAt: row.updated_at } });
    }));
    router.post("/api/workspaces/:workspaceId/automation/rules/:ruleId/test", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const ruleId = parseId(request.params.ruleId, "rule_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "automation.read");
        const body = z.object({ campaignId: z.string().uuid() }).strict().safeParse(request.body);
        if (!body.success)
            throw new HttpError(400, "automation_test_invalid", "Choose a campaign for the rule preview.");
        const [rules, campaigns, analytics] = await Promise.all([repo.rules(workspaceId), repo.campaigns(workspaceId), repo.analytics(workspaceId, body.data.campaignId)]);
        const rule = rules.find((item) => rowId(item, "id") === ruleId);
        const campaign = campaigns.find((item) => item.id === body.data.campaignId && item.status === "demo_published" && !item.publishedExternally);
        const latest = analytics[0];
        if (!rule || !campaign || !latest)
            throw new HttpError(404, "automation_test_data_missing", "An existing rule and demo-published campaign with stored metrics are required.");
        const definition = AutomationRuleDefinitionSchema.parse(rule.definition);
        const metric = analyzePerformance(campaign, latest.metrics);
        response.status(200).json({ preview: true, matched: evaluateRule(definition, metric).matched, conditions: evaluateRule(definition, metric).results, metrics: metric, action: definition.action, approvalRequired: definition.approvalRequired || definition.action === "propose_demo_budget", label: "Simulated Data — Not Actual Ad Performance" });
    }));
    router.post("/api/workspaces/:workspaceId/automation/rules/:ruleId/run", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const ruleId = parseId(request.params.ruleId, "rule_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "automation.manage");
        const input = parseBody(AutomationRunInputSchema, request.body, "automation_run_invalid", "Choose a valid campaign and idempotency key.");
        if (input.previewOnly)
            throw new HttpError(400, "preview_route_required", "Use the test endpoint for a non-persisted preview.");
        const result = await repo.executeRule(workspaceId, ruleId, input.campaignId, input.idempotencyKey);
        if (result.workspace_id !== workspaceId)
            throw new HttpError(404, "automation_execution_not_found", "The rule execution was not found.");
        response.status(201).json({ execution: result, providerOperation: false, label: "Offline rule evaluation" });
    }));
    router.get("/api/workspaces/:workspaceId/automation/executions", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "automation.read");
        const page = PageSchema.parse(request.query);
        const result = await repo.executions(workspaceId, page.page, page.pageSize);
        response.status(200).json({ executions: result.rows, total: result.total, page: page.page, pageSize: page.pageSize });
    }));
    router.post("/api/workspaces/:workspaceId/automation/executions/:executionId/decision", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const executionId = parseId(request.params.executionId, "execution_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        const input = parseBody(AutomationExecutionDecisionSchema, request.body, "automation_decision_invalid", "The execution decision is invalid.");
        await authorize(repo, workspaceId, user, input.decision === "reject" || input.decision === "approve" || input.decision === "apply" ? "automation.approve" : "automation.manage");
        const result = await repo.decideExecution(executionId, input.expectedVersion, input.expectedRuleVersion, input.decision, input.comments);
        if (result.workspace_id !== workspaceId)
            throw new HttpError(404, "automation_execution_not_found", "The execution was not found.");
        response.status(200).json({ execution: result, providerOperation: false });
    }));
    router.get("/api/workspaces/:workspaceId/notifications", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "notifications.read");
        const rows = await repo.notifications(workspaceId, user.id);
        response.status(200).json({ notifications: rows, total: rows.length, unread: rows.filter((row) => row.read_at === null).length });
    }));
    router.patch("/api/workspaces/:workspaceId/notifications/:notificationId", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const id = parseId(request.params.notificationId, "notification_id");
        const user = actor(response);
        const repo = repoFor(response, factory);
        await authorize(repo, workspaceId, user, "notifications.manage");
        const input = parseBody(NotificationUpdateSchema, request.body, "notification_update_invalid", "Choose a supported notification action.");
        const result = await repo.updateNotification(id, input.action);
        if (result.workspace_id !== workspaceId || result.recipient_user_id !== user.id)
            throw new HttpError(404, "notification_not_found", "The notification was not found.");
        response.status(200).json({ notification: result });
    }));
    return router;
}
