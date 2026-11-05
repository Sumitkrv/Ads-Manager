import express from "express";
import { createClient } from "@supabase/supabase-js";
import { ProductTourProgressSchema, RecordOnboardingEventSchema, UserOnboardingPreferencesInputSchema, WorkspaceOnboardingPatchSchema, WorkspaceRoleSchema, hasWorkspacePermission, } from "@ai-ads/shared";
import { createRequireAuthenticatedUser } from "../auth.js";
import { HttpError } from "../errors.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOUR_IDS = new Set(["owner-overview", "campaign-studio", "creative-studio", "analytics", "agency-command-center", "client-portal", "viewer-reporting"]);
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function actor(response) {
    const user = response.locals.authenticatedUser;
    if (!user)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return user;
}
function parseId(value, name) {
    if (typeof value !== "string" || !UUID.test(value))
        throw new HttpError(400, "invalid_" + name, "The " + name.replaceAll("_", " ") + " is invalid.");
    return value;
}
function parseBody(schema, value, code, message) {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new HttpError(400, code, message);
    return parsed.data;
}
function clientFor(response, apiConfig) {
    const token = response.locals.authenticatedAccessToken;
    if (typeof token !== "string" || !apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY) {
        throw new HttpError(503, "onboarding_service_unavailable", "Onboarding storage is temporarily unavailable.");
    }
    return createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: "Bearer " + token } },
    });
}
function mapDbError(error) {
    if (error?.code === "42501")
        throw new HttpError(403, "onboarding_forbidden", "Your workspace role cannot change this onboarding setting.");
    if (error?.code === "P0002")
        throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    if (error?.code === "22023" || error?.code === "23514" || error?.code === "23503")
        throw new HttpError(400, "onboarding_invalid", "The onboarding details are invalid.");
    throw new HttpError(503, "onboarding_storage_unavailable", "Onboarding storage is temporarily unavailable.");
}
function eventTimestamp(events, eventKey) {
    const event = events.find((item) => item.event_key === eventKey);
    return typeof event?.occurred_at === "string" ? event.occurred_at : null;
}
export function createOnboardingRouter(apiConfig, verifyToken) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifyToken);
    router.get("/api/me/onboarding", authenticate, asyncRoute(async (_request, response) => {
        const user = actor(response);
        const { data, error } = await clientFor(response, apiConfig).from("user_onboarding_preferences").select("setup_path,draft,updated_at").eq("user_id", user.id).maybeSingle();
        if (error)
            mapDbError(error);
        response.status(200).json({ preferences: data ? { setupPath: data.setup_path, draft: data.draft, updatedAt: data.updated_at } : null });
    }));
    router.patch("/api/me/onboarding", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        const input = parseBody(UserOnboardingPreferencesInputSchema, request.body, "onboarding_preferences_invalid", "Onboarding preferences are invalid.");
        const { data, error } = await clientFor(response, apiConfig).from("user_onboarding_preferences").upsert({
            user_id: user.id, setup_path: input.setupPath, draft: input.draft, updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" }).select("setup_path,draft,updated_at").single();
        if (error)
            mapDbError(error);
        response.status(200).json({ preferences: { setupPath: data.setup_path, draft: data.draft, updatedAt: data.updated_at } });
    }));
    router.get("/api/me/product-tours", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        const workspaceId = parseId(request.query.workspaceId, "workspace_id");
        const { data, error } = await clientFor(response, apiConfig).from("user_product_tour_progress")
            .select("tour_id,workspace_id,step_index,status,started_at,updated_at,completed_at")
            .eq("user_id", user.id).eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(50);
        if (error)
            mapDbError(error);
        response.status(200).json({ progress: (data ?? []).map((row) => ({
                tourId: row.tour_id, workspaceId: row.workspace_id, stepIndex: row.step_index, status: row.status,
                startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at,
            })) });
    }));
    router.post("/api/me/product-tours/:tourId/progress", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        const input = parseBody(ProductTourProgressSchema, request.body, "tour_progress_invalid", "Tour progress is invalid.");
        const tourId = request.params.tourId;
        if (input.tourId !== tourId || !TOUR_IDS.has(tourId))
            throw new HttpError(404, "tour_not_found", "This product tour is unavailable.");
        const client = clientFor(response, apiConfig);
        const { data: existing, error: existingError } = await client.from("user_product_tour_progress").select("started_at")
            .eq("user_id", user.id).eq("workspace_id", input.workspaceId).eq("tour_id", tourId).maybeSingle();
        if (existingError)
            mapDbError(existingError);
        const now = new Date().toISOString();
        const { data, error } = await client.from("user_product_tour_progress").upsert({
            user_id: user.id, workspace_id: input.workspaceId, tour_id: tourId, step_index: input.stepIndex,
            status: input.status, started_at: existing?.started_at ?? now, updated_at: now,
            completed_at: input.status === "completed" ? now : null,
        }, { onConflict: "user_id,workspace_id,tour_id" }).select("tour_id,workspace_id,step_index,status,started_at,updated_at,completed_at").single();
        if (error)
            mapDbError(error);
        response.status(200).json({ progress: [{
                    tourId: data.tour_id, workspaceId: data.workspace_id, stepIndex: data.step_index, status: data.status,
                    startedAt: data.started_at, updatedAt: data.updated_at, completedAt: data.completed_at,
                }] });
    }));
    async function workspaceRole(client, workspaceId, user) {
        const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
        if (error)
            mapDbError(error);
        const role = WorkspaceRoleSchema.safeParse(data?.role);
        if (!role.success)
            throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
        return role.data;
    }
    router.get("/api/workspaces/:workspaceId/onboarding", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const client = clientFor(response, apiConfig);
        await workspaceRole(client, workspaceId, user);
        const { data, error } = await client.from("workspace_onboarding_progress")
            .select("workspace_id,setup_data,current_step,last_completed_step,started_at,last_active_at,completed_at,updated_at,version")
            .eq("workspace_id", workspaceId).maybeSingle();
        if (error)
            mapDbError(error);
        response.status(200).json({ onboarding: data ? {
                workspaceId: data.workspace_id, setupData: data.setup_data, currentStep: data.current_step,
                lastCompletedStep: data.last_completed_step, startedAt: data.started_at, lastActiveAt: data.last_active_at,
                completedAt: data.completed_at, updatedAt: data.updated_at, version: data.version,
            } : null });
    }));
    router.patch("/api/workspaces/:workspaceId/onboarding", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const client = clientFor(response, apiConfig);
        const role = await workspaceRole(client, workspaceId, user);
        if (!hasWorkspacePermission(role, "workspace.updateSettings"))
            throw new HttpError(403, "onboarding_forbidden", "Only workspace owners and admins can edit setup details.");
        const input = parseBody(WorkspaceOnboardingPatchSchema, request.body, "onboarding_progress_invalid", "Onboarding progress is invalid.");
        const { data: current, error: currentError } = await client.from("workspace_onboarding_progress").select("started_at,completed_at")
            .eq("workspace_id", workspaceId).maybeSingle();
        if (currentError)
            mapDbError(currentError);
        const values = { setup_data: input.setupData, current_step: input.currentStep, last_completed_step: input.lastCompletedStep };
        const columns = "workspace_id,setup_data,current_step,last_completed_step,started_at,last_active_at,completed_at,updated_at,version";
        let write = current
            ? await client.from("workspace_onboarding_progress").update(values).eq("workspace_id", workspaceId).select(columns).single()
            : await client.from("workspace_onboarding_progress").insert({ workspace_id: workspaceId, ...values }).select(columns).single();
        if (!current && write.error?.code === "23505") {
            write = await client.from("workspace_onboarding_progress").update(values).eq("workspace_id", workspaceId).select(columns).single();
        }
        const { data, error } = write;
        if (error)
            mapDbError(error);
        response.status(200).json({ onboarding: {
                workspaceId: data.workspace_id, setupData: data.setup_data, currentStep: data.current_step,
                lastCompletedStep: data.last_completed_step, startedAt: data.started_at, lastActiveAt: data.last_active_at,
                completedAt: data.completed_at, updatedAt: data.updated_at, version: data.version,
            } });
    }));
    router.post("/api/workspaces/:workspaceId/activation/events", authenticate, asyncRoute(async (request, response) => {
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const input = parseBody(RecordOnboardingEventSchema, request.body, "activation_event_invalid", "The activation event is invalid.");
        const { error } = await clientFor(response, apiConfig).rpc("record_onboarding_event", { p_workspace_id: workspaceId, p_event_key: input.eventKey });
        if (error)
            mapDbError(error);
        response.status(200).json({ recorded: true });
    }));
    router.get(["/api/workspaces/:workspaceId/activation", "/api/workspaces/:workspaceId/activation/checklist", "/api/workspaces/:workspaceId/getting-started"], authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        const workspaceId = parseId(request.params.workspaceId, "workspace_id");
        const client = clientFor(response, apiConfig);
        const role = await workspaceRole(client, workspaceId, user);
        const results = await Promise.all([
            client.from("workspaces").select("name,industry_key,created_at").eq("id", workspaceId).maybeSingle(),
            client.from("workspace_onboarding_progress").select("setup_data,completed_at,updated_at").eq("workspace_id", workspaceId).maybeSingle(),
            client.from("workspace_brand_kits").select("updated_at").eq("workspace_id", workspaceId).maybeSingle(),
            client.from("campaigns").select("id,created_at,generation_mode,plan,lifecycle_status").eq("workspace_id", workspaceId).neq("lifecycle_status", "archived").order("created_at", { ascending: true }).limit(100),
            client.from("creative_projects").select("id,created_at,lifecycle_status").eq("workspace_id", workspaceId).neq("lifecycle_status", "archived").order("created_at", { ascending: true }).limit(100),
            client.from("campaign_reviews").select("decision,created_at").eq("workspace_id", workspaceId).in("decision", ["submitted", "approved_for_demo"]).order("created_at", { ascending: true }).limit(1),
            client.from("demo_publish_attempts").select("id,created_at").eq("workspace_id", workspaceId).eq("status", "succeeded").eq("published_externally", false).order("created_at", { ascending: true }).limit(1),
            client.from("demo_campaign_analytics").select("id,simulated_at").eq("workspace_id", workspaceId).order("simulated_at", { ascending: true }).limit(1),
            client.from("workspace_activation_events").select("event_key,occurred_at").eq("workspace_id", workspaceId).order("occurred_at", { ascending: true }).limit(200),
        ]);
        const failed = results.find((result) => result.error);
        if (failed?.error)
            mapDbError(failed.error);
        const [workspaceResult, progressResult, brandResult, campaignsResult, creativesResult, reviewsResult, publishResult, analyticsResult, eventsResult] = results;
        const workspace = workspaceResult.data;
        if (!workspace)
            throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
        let agencyProfile = null;
        let agencyRelationships = [];
        let agencyInvitations = [];
        let agencyAssignments = [];
        let agencyClientGrants = [];
        if (workspace.industry_key === "marketing_agencies") {
            const agencyResults = await Promise.all([
                client.from("agency_profiles").select("description,website_url,specializations,updated_at").eq("agency_workspace_id", workspaceId).maybeSingle(),
                client.from("agency_client_relationships").select("id,status,created_at").eq("agency_workspace_id", workspaceId).in("status", ["pending", "active", "paused"]).order("created_at", { ascending: true }).limit(100),
                client.from("workspace_invitations").select("id,created_at").eq("workspace_id", workspaceId).eq("status", "pending").order("created_at", { ascending: true }).limit(100),
                client.from("agency_team_assignments").select("id,created_at").eq("agency_workspace_id", workspaceId).eq("status", "active").order("created_at", { ascending: true }).limit(100),
                client.from("agency_membership_grants").select("id,client_workspace_id").eq("agency_workspace_id", workspaceId).eq("status", "active").limit(100),
            ]);
            const agencyFailure = agencyResults.find((result) => result.error);
            if (agencyFailure?.error)
                mapDbError(agencyFailure.error);
            agencyProfile = agencyResults[0].data;
            agencyRelationships = agencyResults[1].data ?? [];
            agencyInvitations = agencyResults[2].data ?? [];
            agencyAssignments = agencyResults[3].data ?? [];
            agencyClientGrants = agencyResults[4].data ?? [];
        }
        const setupData = (progressResult.data?.setup_data ?? {});
        const campaigns = campaignsResult.data ?? [];
        const generated = campaigns.find((item) => item.generation_mode === "simulation" && item.plan !== null);
        const events = (eventsResult.data ?? []);
        const campaign = campaigns[0];
        const creative = (creativesResult.data ?? [])[0];
        const reviewed = (reviewsResult.data ?? [])[0];
        const published = (publishResult.data ?? [])[0];
        const report = (analyticsResult.data ?? [])[0];
        const firstCampaignAt = eventTimestamp(events, "first_campaign_created");
        const firstCreativeAt = eventTimestamp(events, "first_creative_saved");
        const firstPublishAt = eventTimestamp(events, "first_demo_published");
        const firstReportAt = eventTimestamp(events, "first_report_viewed");
        const demoModeAt = eventTimestamp(events, "demo_mode_reviewed");
        const canUpdateSettings = hasWorkspacePermission(role, "workspace.updateSettings");
        const canManageCampaigns = hasWorkspacePermission(role, "campaigns.manage");
        const canReviewCampaigns = hasWorkspacePermission(role, "campaigns.review");
        const canPublishDemo = hasWorkspacePermission(role, "campaigns.publishDemo");
        const canManageBrand = hasWorkspacePermission(role, "brand.manage");
        const canManageCreatives = hasWorkspacePermission(role, "creatives.manage");
        const items = [
            { id: "workspace", title: "Create your business workspace", description: "Your workspace keeps business activity under its own access boundary.", required: true, completed: true, completedAt: workspace.created_at, href: "/app/settings/workspace" },
            { id: "business-profile", title: "Complete business profile", description: "Add a short description, primary region and the product or service you promote.", required: canUpdateSettings, completed: Boolean(String(setupData.businessDescription ?? "").trim() && String(setupData.mainOffering ?? "").trim()), completedAt: progressResult.data?.updated_at ?? null, href: "/app/getting-started#business-profile", guidance: "These details help prefill future campaign briefs." },
            { id: "brand-kit", title: "Configure Brand Kit", description: "Save your brand voice, colors and CTA preference for creative work.", required: canManageBrand, completed: Boolean(brandResult.data), completedAt: brandResult.data?.updated_at ?? null, href: "/app/brand-kit" },
            { id: "demo-mode", title: "Review advertising demo mode", description: "Understand that campaigns and reporting stay inside Tandem Ads demo mode.", required: true, completed: Boolean(demoModeAt), completedAt: demoModeAt, href: "/app/getting-started#demo-mode" },
            { id: "first-campaign", title: "Create your first campaign", description: "Save a campaign draft using the existing Campaign Studio.", required: canManageCampaigns, completed: Boolean(firstCampaignAt || campaign), completedAt: firstCampaignAt ?? campaign?.created_at ?? null, href: "/app/campaigns/new" },
            { id: "offline-plan", title: "Generate an offline campaign plan", description: "Create deterministic campaign copy and structure for review.", required: canManageCampaigns, completed: Boolean(generated), completedAt: generated?.created_at ?? null, href: "/app/campaigns/new", guidance: "Generation is labeled AI Simulation and does not call a generative AI service." },
            { id: "first-creative", title: "Save your first creative", description: "Create and save a branded creative or editable typography layout.", required: canManageCreatives, completed: Boolean(firstCreativeAt || creative), completedAt: firstCreativeAt ?? creative?.created_at ?? null, href: "/app/creatives/new" },
            { id: "review", title: "Complete a review step", description: "Submit a generated campaign and use the existing review decision flow.", required: canReviewCampaigns, completed: Boolean(reviewed), completedAt: reviewed?.created_at ?? null, href: campaign ? "/app/campaigns/" + campaign.id + "/review" : "/app/campaigns" },
            { id: "demo-publish", title: "Simulate publishing", description: "Publish a currently approved draft to Tandem Ads demo mode.", required: canPublishDemo, completed: Boolean(firstPublishAt || published), completedAt: firstPublishAt ?? published?.created_at ?? null, href: campaign ? "/app/campaigns/" + campaign.id : "/app/campaigns", guidance: "Nothing is sent to Google or Meta and no advertising spend occurs." },
            { id: "first-report", title: "Open demo analytics", description: "View stored simulated metrics with their demo data label.", required: true, completed: Boolean(firstReportAt && report), completedAt: firstReportAt && report ? firstReportAt : null, href: "/app/analytics" },
        ];
        if (workspace.industry_key === "marketing_agencies") {
            const hasSpecialization = Array.isArray(agencyProfile?.specializations) && agencyProfile.specializations.length > 0;
            const hasRelationship = agencyRelationships.length > 0;
            items.splice(2, 0, { id: "agency-profile", title: "Complete agency profile", description: "Save an agency description, website or specialization in Agency Command Center.", required: hasWorkspacePermission(role, "agency.manage"), completed: Boolean(agencyProfile && (agencyProfile.description?.trim() || agencyProfile.website_url || hasSpecialization)), completedAt: agencyProfile?.updated_at ?? null, href: "/app/agency/settings" }, { id: "agency-client-request", title: "Create a client collaboration request", description: "Create a relationship request through the authorized agency workflow.", required: false, completed: hasRelationship, completedAt: agencyRelationships[0]?.created_at ?? null, href: "/app/agency/clients", guidance: "A request does not grant client workspace access." }, { id: "agency-invitation", title: "Create an invitation link", description: "Use the existing invitation flow to create an identity-bound link.", required: false, completed: agencyInvitations.length > 0, completedAt: agencyInvitations[0]?.created_at ?? null, href: "/app/agency/clients", guidance: "Invitation link created — not emailed." }, { id: "agency-team", title: "Review team assignments", description: "Assign team members only to a client relationship you are authorized to manage.", required: false, completed: agencyAssignments.length > 0, completedAt: agencyAssignments[0]?.created_at ?? null, href: "/app/agency/team" }, { id: "agency-client-access", title: "Open an authorized client workspace", description: "Client access appears only after a valid invitation and membership grant.", required: false, completed: agencyClientGrants.length > 0, completedAt: null, href: "/app/agency/clients", guidance: "Client workspaces keep their own membership and subscription." });
        }
        const total = items.filter((item) => item.required).length;
        const completed = items.filter((item) => item.required && item.completed).length;
        response.status(200).json({
            workspaceId, workspaceName: workspace.name, industryKey: workspace.industry_key, role, items, completed, total,
            percent: Math.round(completed / total * 100), completedAt: eventTimestamp(events, "onboarding_completed"),
        });
    }));
    return router;
}
