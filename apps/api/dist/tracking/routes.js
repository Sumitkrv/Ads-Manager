import express from "express";
import { CampaignTrackingInputSchema, ConversionGoalInputSchema, EventDefinitionInputSchema, EventMappingInputSchema, IntegrationConfigInputSchema, READINESS_REQUIREMENTS, ReadinessResponseInputSchema, ReadinessCategorySchema, TrackingProviderCatalogue, TrackingProviderSchema, TrackingTestInputSchema, UTMTemplateInputSchema, TrackingPlanInputSchema, TrackingPreferencesInputSchema, WorkspaceRoleSchema, buildTrackingUrl, hasWorkspacePermission, readinessScore, } from "@ai-ads/shared";
import { z } from "zod";
import { createRequireAuthenticatedUser } from "../auth.js";
import { HttpError } from "../errors.js";
import { createSupabaseTrackingRepository, TRACKING_TABLES } from "./repository.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function actor(response) {
    const user = response.locals.authenticatedUser;
    if (!user)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return user;
}
function parseUuid(value, name) {
    if (typeof value !== "string" || !UUID.test(value))
        throw new HttpError(400, `tracking_${name}_invalid`, `The ${name.replaceAll("_", " ")} is invalid.`);
    return value;
}
function rowId(value) { return parseUuid(value, "record_id"); }
function parsed(schema, value, message) {
    const result = schema.safeParse(value);
    if (!result.success)
        throw new HttpError(400, "tracking_input_invalid", message);
    return result.data;
}
function safeRows(rows) {
    return rows.map((row) => {
        const { updated_by_user_id: _updatedBy, created_by_user_id: _createdBy, ...safe } = row;
        return safe;
    });
}
export function createTrackingRouter(apiConfig, verifyToken, dependencies = {}) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifyToken);
    const factory = dependencies.repositoryFactory === undefined ? createSupabaseTrackingRepository : dependencies.repositoryFactory;
    function repository(response) {
        const token = response.locals.authenticatedAccessToken;
        if (typeof token !== "string" || !factory)
            throw new HttpError(503, "tracking_service_unavailable", "Tracking storage is temporarily unavailable.");
        const repo = factory(token);
        if (!repo)
            throw new HttpError(503, "tracking_service_unavailable", "Tracking storage is temporarily unavailable.");
        return repo;
    }
    async function authorize(repo, workspaceId, user, write = false) {
        const result = WorkspaceRoleSchema.safeParse(await repo.getRole(workspaceId, user.id));
        if (!result.success)
            throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
        const permission = write ? "integrations.manage" : "integrations.read";
        if (!hasWorkspacePermission(result.data, permission))
            throw new HttpError(403, "tracking_forbidden", "Your workspace role cannot perform this tracking action.");
        if (write) {
            const billing = await repo.billingSummary(workspaceId);
            const features = typeof billing.features === "object" && billing.features !== null ? billing.features : {};
            if (features["tracking.planning"] !== true)
                throw new HttpError(403, "tracking_entitlement_required", "Tracking planning is not included for this workspace.");
            if (["expired", "cancelled", "suspended"].includes(String(billing.subscription?.status)))
                throw new HttpError(409, "tracking_workspace_read_only", "This workspace is read-only for new tracking configuration.");
        }
        return result.data;
    }
    async function context(request, response, write = false) {
        const workspaceId = parseUuid(request.params.workspaceId, "workspace_id");
        const user = actor(response);
        const repo = repository(response);
        const role = await authorize(repo, workspaceId, user, write);
        return { workspaceId, user, repo, role };
    }
    async function list(repo, table, workspaceId) {
        return safeRows(await repo.list(table, workspaceId));
    }
    async function update(repo, table, workspaceId, rawId, payload) {
        const result = await repo.update(table, workspaceId, rowId(rawId), payload);
        if (!result)
            throw new HttpError(404, "tracking_record_not_found", "The requested tracking record was not found.");
        return safeRows([result])[0];
    }
    router.get("/api/workspaces/:workspaceId/tracking/overview", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo, role } = await context(request, response);
        const [configs, readiness, goals, events, mappings, templates, campaignLinks, trackingPlans, preferencesRows, testRuns, audit] = await Promise.all([
            list(repo, TRACKING_TABLES.configs, workspaceId), list(repo, TRACKING_TABLES.readiness, workspaceId),
            list(repo, TRACKING_TABLES.goals, workspaceId), list(repo, TRACKING_TABLES.events, workspaceId),
            list(repo, TRACKING_TABLES.mappings, workspaceId), list(repo, TRACKING_TABLES.templates, workspaceId),
            list(repo, TRACKING_TABLES.campaigns, workspaceId), list(repo, TRACKING_TABLES.plans, workspaceId), list(repo, TRACKING_TABLES.preferences, workspaceId), list(repo, TRACKING_TABLES.tests, workspaceId), role === "owner" || role === "admin" ? repo.audit(workspaceId) : Promise.resolve([]),
        ]);
        response.status(200).json({ workspaceId, providers: TrackingProviderCatalogue, configs, readiness, readinessRequirements: READINESS_REQUIREMENTS,
            readinessScores: Object.fromEntries(["google_ads", "meta_ads"].map((provider) => [provider, readinessScore(new Set(readiness.filter((item) => item.provider === provider && item.completed === true).map((item) => String(item.requirement_id))))])),
            goals, events, mappings, templates, campaignLinks, trackingPlans, preferences: safeRows(preferencesRows)[0] ?? TrackingPreferencesInputSchema.parse({}), testRuns, audit: safeRows(audit),
            externalConnectionsEnabled: false, externalConversionsAvailable: false });
    }));
    router.patch("/api/workspaces/:workspaceId/tracking/integrations/:provider", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const provider = parsed(TrackingProviderSchema, request.params.provider, "Choose a supported provider.");
        const input = parsed(IntegrationConfigInputSchema, request.body, "Review the provider planning fields. Do not enter credentials.");
        const readiness = provider === "google_ads" || provider === "meta_ads" ? await repo.list(TRACKING_TABLES.readiness, workspaceId) : [];
        const requiredIds = READINESS_REQUIREMENTS.filter((item) => item.required).map((item) => item.id);
        const complete = requiredIds.every((id) => readiness.some((item) => item.provider === provider && item.requirement_id === id && item.completed === true));
        const status = complete ? "locally_validated" : input.accountIdentifier || input.businessLabel || input.websiteUrl ? "draft_configuration" : "not_configured";
        const saved = await repo.upsert(TRACKING_TABLES.configs, { workspace_id: workspaceId, provider, ...{
                account_identifier: input.accountIdentifier, business_label: input.businessLabel, website_url: input.websiteUrl, notes: input.notes,
                configuration_status: status,
            } }, "workspace_id,provider");
        response.status(200).json({ config: safeRows([saved])[0], externalVerification: "unavailable", connectionStatus: "PROVIDER_INTEGRATION_DISABLED" });
    }));
    router.put("/api/workspaces/:workspaceId/tracking/readiness/:provider", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const provider = parsed(z.enum(["google_ads", "meta_ads"]), request.params.provider, "Choose Google Ads or Meta Ads readiness.");
        const input = parsed(ReadinessResponseInputSchema, request.body, "Review the readiness response.");
        if (!READINESS_REQUIREMENTS.some((requirement) => requirement.id === input.requirementId))
            throw new HttpError(400, "tracking_requirement_invalid", "The readiness requirement is not supported.");
        const saved = await repo.upsert(TRACKING_TABLES.readiness, { workspace_id: workspaceId, provider, requirement_id: input.requirementId, completed: input.completed, note: input.note }, "workspace_id,provider,requirement_id");
        response.status(200).json({ readiness: safeRows([saved])[0], scoreMeaning: "Configuration preparation progress only. No provider or account verification was performed." });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/validate-local/:provider", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const provider = parsed(TrackingProviderSchema, request.params.provider, "Choose a supported provider.");
        const config = (await repo.list(TRACKING_TABLES.configs, workspaceId)).find((item) => item.provider === provider);
        const checks = [
            { check: "configuration_saved", passed: Boolean(config) },
            { check: "website_destination", passed: typeof config?.website_url === "string" && config.website_url.startsWith("https://") },
            { check: "account_identifier_recorded", passed: typeof config?.account_identifier === "string" && config.account_identifier.length > 0 },
        ];
        const passed = checks.every((check) => check.passed);
        if (config && typeof config.id === "string")
            await repo.update(TRACKING_TABLES.configs, workspaceId, config.id, { configuration_status: passed ? "locally_validated" : "readiness_incomplete" });
        response.status(200).json({ checks, passed, status: passed ? "LOCALLY_VALIDATED" : "READINESS_INCOMPLETE", externalVerification: "UNAVAILABLE", message: "A locally valid planning record does not prove that a provider account exists." });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/goals", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ goals: await list(repo, TRACKING_TABLES.goals, workspaceId) });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/goals", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(ConversionGoalInputSchema, request.body, "Review the conversion goal fields.");
        const saved = await repo.upsert(TRACKING_TABLES.goals, { workspace_id: workspaceId, name: input.name, category: input.category, description: input.description, event_name: input.eventName, objective: input.objective, illustrative_value: input.illustrativeValue, currency: input.currency, counting_policy: input.countingPolicy, attribution_notes: input.attributionNotes, status: input.status, industry: input.industry }, "id");
        response.status(201).json({ goal: safeRows([saved])[0], dataKind: "PLANNED CONVERSION DEFINITION" });
    }));
    router.patch("/api/workspaces/:workspaceId/tracking/goals/:id", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(ConversionGoalInputSchema, request.body, "Review the conversion goal fields.");
        const saved = await update(repo, TRACKING_TABLES.goals, workspaceId, request.params.id, { name: input.name, category: input.category, description: input.description, event_name: input.eventName, objective: input.objective, illustrative_value: input.illustrativeValue, currency: input.currency, counting_policy: input.countingPolicy, attribution_notes: input.attributionNotes, status: input.status, industry: input.industry });
        response.status(200).json({ goal: saved, dataKind: "PLANNED CONVERSION DEFINITION" });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/events", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ events: await list(repo, TRACKING_TABLES.events, workspaceId) });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/events", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(EventDefinitionInputSchema, request.body, "Review the event definition and parameter schema.");
        const saved = await repo.upsert(TRACKING_TABLES.events, { workspace_id: workspaceId, event_key: input.eventKey, display_name: input.displayName, description: input.description, trigger_definition: input.triggerDefinition, source_type: input.sourceType, expected_parameters: input.expectedParameters, deduplication_reference: input.deduplicationReference, consent_required: input.consentRequired, status: input.status }, "workspace_id,event_key");
        response.status(201).json({ event: safeRows([saved])[0] });
    }));
    router.patch("/api/workspaces/:workspaceId/tracking/events/:id", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(EventDefinitionInputSchema, request.body, "Review the event definition and parameter schema.");
        const old = (await repo.list(TRACKING_TABLES.events, workspaceId)).find((item) => item.id === request.params.id);
        if (!old)
            throw new HttpError(404, "tracking_record_not_found", "The requested event was not found.");
        const saved = await update(repo, TRACKING_TABLES.events, workspaceId, request.params.id, { event_key: input.eventKey, display_name: input.displayName, description: input.description, trigger_definition: input.triggerDefinition, source_type: input.sourceType, expected_parameters: input.expectedParameters, deduplication_reference: input.deduplicationReference, consent_required: input.consentRequired, status: input.status, version: Number(old.version ?? 1) + 1 });
        response.status(200).json({ event: saved });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/mappings", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ mappings: await list(repo, TRACKING_TABLES.mappings, workspaceId) });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/mappings", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(EventMappingInputSchema, request.body, "Review the event mapping fields.");
        const existing = (await repo.list(TRACKING_TABLES.mappings, workspaceId)).find((item) => item.event_definition_id === input.eventDefinitionId && item.provider === input.provider);
        const saved = await repo.upsert(TRACKING_TABLES.mappings, { workspace_id: workspaceId, event_definition_id: input.eventDefinitionId, provider: input.provider, provider_event_name: input.providerEventName, parameter_map: input.parameterMap, status: input.status, notes: input.notes, ...(existing ? { version: Number(existing.version ?? 1) + 1 } : {}) }, "workspace_id,event_definition_id,provider");
        response.status(201).json({ mapping: safeRows([saved])[0], validation: "LOCAL SCHEMA ONLY" });
    }));
    router.patch("/api/workspaces/:workspaceId/tracking/mappings/:id", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(EventMappingInputSchema, request.body, "Review the event mapping fields.");
        const existing = (await repo.list(TRACKING_TABLES.mappings, workspaceId)).find((item) => item.id === request.params.id);
        if (!existing)
            throw new HttpError(404, "tracking_record_not_found", "The requested tracking record was not found.");
        const saved = await update(repo, TRACKING_TABLES.mappings, workspaceId, request.params.id, { event_definition_id: input.eventDefinitionId, provider: input.provider, provider_event_name: input.providerEventName, parameter_map: input.parameterMap, status: input.status, notes: input.notes, version: Number(existing.version ?? 1) + 1 });
        response.status(200).json({ mapping: saved, validation: "LOCAL SCHEMA ONLY" });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/utm-preview", authenticate, asyncRoute(async (request, response) => {
        await context(request, response);
        const input = parsed(UTMTemplateInputSchema, request.body, "Review the destination and UTM values; do not include personal data.");
        response.status(200).json({ ...buildTrackingUrl(input), generatedLocally: true });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/utm-templates", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ templates: await list(repo, TRACKING_TABLES.templates, workspaceId) });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/utm-templates", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(UTMTemplateInputSchema, request.body, "Review the UTM template fields.");
        const saved = await repo.upsert(TRACKING_TABLES.templates, { workspace_id: workspaceId, name: input.name, destination_url: input.destinationUrl, source: input.source, medium: input.medium, campaign: input.campaign, content: input.content, term: input.term, custom_parameters: input.customParameters, replace_existing: input.replaceExisting, campaign_id: input.campaignId, goal_id: input.goalId, status: input.status }, "id");
        response.status(201).json({ template: safeRows([saved])[0] });
    }));
    router.patch("/api/workspaces/:workspaceId/tracking/utm-templates/:id", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(UTMTemplateInputSchema, request.body, "Review the UTM template fields.");
        const saved = await update(repo, TRACKING_TABLES.templates, workspaceId, request.params.id, { name: input.name, destination_url: input.destinationUrl, source: input.source, medium: input.medium, campaign: input.campaign, content: input.content, term: input.term, custom_parameters: input.customParameters, replace_existing: input.replaceExisting, campaign_id: input.campaignId, goal_id: input.goalId, status: input.status });
        response.status(200).json({ template: saved });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/campaign-links", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ campaignLinks: await list(repo, TRACKING_TABLES.campaigns, workspaceId) });
    }));
    router.put("/api/workspaces/:workspaceId/tracking/campaign-links", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(CampaignTrackingInputSchema, request.body, "Review the campaign tracking association.");
        const saved = await repo.upsert(TRACKING_TABLES.campaigns, { workspace_id: workspaceId, campaign_id: input.campaignId, goal_id: input.goalId, utm_template_id: input.utmTemplateId, notes: input.notes }, "workspace_id,campaign_id");
        response.status(200).json({ campaignLink: safeRows([saved])[0], campaignRevisionChanged: false, approvalInvalidated: false, externalAction: "none" });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/plans", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ plans: await list(repo, TRACKING_TABLES.plans, workspaceId) });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/preferences", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ preferences: safeRows(await repo.list(TRACKING_TABLES.preferences, workspaceId))[0] ?? TrackingPreferencesInputSchema.parse({}) });
    }));
    router.patch("/api/workspaces/:workspaceId/tracking/preferences", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(TrackingPreferencesInputSchema, request.body, "Review workspace UTM naming defaults.");
        const saved = await repo.upsert(TRACKING_TABLES.preferences, { workspace_id: workspaceId, casing: input.casing, separator: input.separator, campaign_format: input.campaignFormat, source_presets: input.sourcePresets, content_labels: input.contentLabels, date_token_format: input.dateTokenFormat }, "workspace_id");
        response.status(200).json({ preferences: safeRows([saved])[0] });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/plans", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(TrackingPlanInputSchema, request.body, "Review the tracking implementation and privacy plan.");
        const saved = await repo.upsert(TRACKING_TABLES.plans, { workspace_id: workspaceId, name: input.name, destination_website: input.destinationWebsite, provider: input.provider, installation_method: input.installationMethod, measurement_identifier: input.measurementIdentifier, consent_prerequisites: input.consentPrerequisites, test_plan: input.testPlan, implementation_owner_label: input.implementationOwnerLabel, review_status: input.reviewStatus, privacy_checklist: input.privacyChecklist }, "id");
        response.status(201).json({ plan: safeRows([saved])[0], installed: false, complianceCertified: false });
    }));
    router.patch("/api/workspaces/:workspaceId/tracking/plans/:id", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(TrackingPlanInputSchema, request.body, "Review the tracking implementation and privacy plan.");
        const saved = await update(repo, TRACKING_TABLES.plans, workspaceId, request.params.id, { name: input.name, destination_website: input.destinationWebsite, provider: input.provider, installation_method: input.installationMethod, measurement_identifier: input.measurementIdentifier, consent_prerequisites: input.consentPrerequisites, test_plan: input.testPlan, implementation_owner_label: input.implementationOwnerLabel, review_status: input.reviewStatus, privacy_checklist: input.privacyChecklist });
        response.status(200).json({ plan: saved, installed: false, complianceCertified: false });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/test-runs", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        response.status(200).json({ testRuns: await list(repo, TRACKING_TABLES.tests, workspaceId), delivery: "SIMULATED EVENT — NOT SENT TO PROVIDER" });
    }));
    router.post("/api/workspaces/:workspaceId/tracking/validate", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response, true);
        const input = parsed(TrackingTestInputSchema, request.body, "Use synthetic event values without personal or sensitive data.");
        const event = (await repo.list(TRACKING_TABLES.events, workspaceId)).find((item) => item.id === input.eventDefinitionId);
        if (!event)
            throw new HttpError(404, "tracking_event_not_found", "The selected event definition was not found.");
        const parameters = typeof event.expected_parameters === "object" && event.expected_parameters !== null ? event.expected_parameters : {};
        const issues = [];
        for (const [key, definition] of Object.entries(parameters)) {
            const value = input.parameters[key];
            if (definition.required === true && value === undefined)
                issues.push({ severity: "error", code: "required_parameter_missing", message: `Required parameter “${key}” is missing.` });
            if (value !== undefined && definition.type === "number" && typeof value !== "number")
                issues.push({ severity: "error", code: "parameter_type_invalid", message: `Parameter “${key}” must be a number.` });
            if (value !== undefined && definition.type === "boolean" && typeof value !== "boolean")
                issues.push({ severity: "error", code: "parameter_type_invalid", message: `Parameter “${key}” must be a boolean.` });
            if (value !== undefined && definition.type === "string" && typeof value !== "string")
                issues.push({ severity: "error", code: "parameter_type_invalid", message: `Parameter “${key}” must be text.` });
        }
        for (const key of Object.keys(input.parameters))
            if (!(key in parameters))
                issues.push({ severity: "warning", code: "parameter_not_defined", message: `Parameter “${key}” is not in the event definition.` });
        const mappings = (await repo.list(TRACKING_TABLES.mappings, workspaceId)).filter((item) => item.event_definition_id === event.id && item.status === "active");
        if (!mappings.length)
            issues.push({ severity: "warning", code: "provider_mapping_missing", message: "No active provider mapping is configured; no provider schema was queried." });
        if (event.consent_required === true)
            issues.push({ severity: "warning", code: "consent_review_required", message: "Consent prerequisites must be reviewed before any future implementation." });
        const result = issues.some((item) => item.severity === "error") ? "fail" : issues.length ? "warning" : "pass";
        const preview = { label: "SIMULATED EVENT — NOT SENT TO PROVIDER", eventKey: event.event_key, parameters: input.parameters };
        const saved = await repo.upsert(TRACKING_TABLES.tests, { workspace_id: workspaceId, goal_id: input.goalId, event_definition_id: input.eventDefinitionId, result, issues, synthetic_preview: preview, delivery_status: "not_sent" }, "id");
        response.status(200).json({ testRun: safeRows([saved])[0], result, issues, preview, delivery: "SIMULATED EVENT — NOT SENT TO PROVIDER", externalCalls: 0 });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/diagnostics", authenticate, asyncRoute(async (request, response) => {
        const { workspaceId, repo } = await context(request, response);
        const [goals, mappings, templates, runs, responses, configs] = await Promise.all([
            repo.list(TRACKING_TABLES.goals, workspaceId), repo.list(TRACKING_TABLES.mappings, workspaceId),
            repo.list(TRACKING_TABLES.templates, workspaceId), repo.list(TRACKING_TABLES.tests, workspaceId), repo.list(TRACKING_TABLES.readiness, workspaceId), repo.list(TRACKING_TABLES.configs, workspaceId),
        ]);
        const diagnostics = [
            { code: "goals", status: goals.length ? "PASS — LOCAL VALIDATION" : "NOT TESTED", detail: `${goals.length} planned conversion goal(s).` },
            { code: "event_mappings", status: mappings.length ? "PASS — LOCAL VALIDATION" : "WARNING", detail: `${mappings.length} mapping(s); no provider schemas were queried.` },
            { code: "utm_templates", status: templates.length ? "PASS — LOCAL VALIDATION" : "NOT TESTED", detail: `${templates.length} saved UTM template(s).` },
            { code: "readiness", status: responses.some((item) => item.completed === true) ? "PASS — LOCAL VALIDATION" : "WARNING", detail: `${configs.length} draft provider configuration(s); checklist is preparation progress only.` },
            { code: "synthetic_tests", status: runs.length ? "PASS — LOCAL VALIDATION" : "NOT TESTED", detail: `${runs.length} synthetic test run(s), excluded from campaign performance totals.` },
            { code: "external_verification", status: "EXTERNAL VERIFICATION UNAVAILABLE", detail: "Provider accounts, tags and event delivery have not been checked." },
        ];
        response.status(200).json({ diagnostics, provenance: "LOCAL_CONFIGURATION_ONLY" });
    }));
    router.get("/api/workspaces/:workspaceId/tracking/readiness-requirements", authenticate, asyncRoute(async (request, response) => {
        await context(request, response);
        response.status(200).json({ requirements: READINESS_REQUIREMENTS, categories: ReadinessCategorySchema.options, providers: ["google_ads", "meta_ads"] });
    }));
    void apiConfig;
    return router;
}
