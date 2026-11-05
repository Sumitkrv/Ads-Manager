import { createHash, randomBytes } from "node:crypto";
import express from "express";
import { z } from "zod";
import { AgencyAssignmentInputSchema, AgencyListQuerySchema, AgencyProfileInputSchema, AgencyRelationshipRequestSchema, AgencyRelationshipTransitionSchema, ClientCommentInputSchema, ClientTaskInputSchema, ClientTaskPatchSchema, InvitationAcceptSchema, WorkspaceInvitationInputSchema, WorkspaceRoleSchema, hasWorkspacePermission, } from "@ai-ads/shared";
import { createRequireAuthenticatedUser } from "../auth.js";
import { HttpError } from "../errors.js";
import { createSupabaseAgencyRepository } from "./repository.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const inviteRate = new Map();
const inviteWindowMs = 15 * 60 * 1000;
const inviteLimit = 8;
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function actor(response) {
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
function recordId(value, name) {
    if (typeof value !== "string" || !UUID.test(value))
        throw new HttpError(400, "invalid_record_id", `${name} identifier is invalid.`);
    return value;
}
function repoFor(response, factory) {
    const token = response.locals.authenticatedAccessToken;
    const selected = factory === undefined ? createSupabaseAgencyRepository : factory;
    if (typeof token !== "string" || !selected)
        throw new HttpError(503, "agency_service_unavailable", "Agency storage is not configured.");
    const repo = selected(token);
    if (!repo)
        throw new HttpError(503, "agency_service_unavailable", "Agency storage is not configured.");
    return repo;
}
function parseBody(schema, value, message) {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new HttpError(400, "agency_request_invalid", message);
    return parsed.data;
}
async function authorize(repo, workspace, user, permission) {
    const role = WorkspaceRoleSchema.safeParse(await repo.getRole(workspace, user.id));
    if (!role.success)
        throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    if (!hasWorkspacePermission(role.data, permission))
        throw new HttpError(403, "agency_forbidden", "Your current workspace role cannot perform this collaboration action.");
    return role.data;
}
function inviteTokenHash(token) { return createHash("sha256").update(token, "utf8").digest("hex"); }
function invitationOrigin(request, apiConfig) {
    const requested = request.get("origin");
    const origin = requested && apiConfig.corsAllowedOrigins.includes(requested) ? requested : apiConfig.corsAllowedOrigins[0];
    if (!origin)
        throw new HttpError(503, "invitation_link_unavailable", "No approved application origin is configured for invitation links.");
    return origin;
}
function makeInvitationLink(request, apiConfig, token) {
    const link = new URL("/app/invitations/accept", invitationOrigin(request, apiConfig));
    // Tokens stay in the fragment: browsers do not send it to the server in HTTP requests or referrers.
    link.hash = new URLSearchParams({ token }).toString();
    return link.toString();
}
function rateLimitInvitationAcceptance(request) {
    const key = request.ip || "unknown";
    const now = Date.now();
    const current = inviteRate.get(key);
    if (!current || now - current.start >= inviteWindowMs) {
        inviteRate.set(key, { start: now, count: 1 });
        return;
    }
    current.count += 1;
    if (current.count > inviteLimit)
        throw new HttpError(429, "invitation_rate_limited", "Too many invitation attempts. Wait before trying again.");
}
export function createAgencyRouter(apiConfig, verifyToken, dependencies = {}) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifyToken);
    const repoFactory = dependencies.repositoryFactory;
    router.put("/api/workspaces/:workspaceId/agency/profile", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        const input = parseBody(AgencyProfileInputSchema, request.body, "Agency profile details are invalid.");
        response.status(200).json({ profile: await repo.saveAgencyProfile(id, {
                description: input.description ?? null,
                websiteUrl: input.websiteUrl ?? null,
                specializations: input.specializations,
            }) });
    }));
    router.get("/api/workspaces/:workspaceId/agency/overview", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.read");
        const profile = await repo.agencyProfile(id);
        if (!profile) {
            response.status(200).json({ designated: false, profile: null, clients: [], counts: { authorized_client_count: 0, campaign_count: 0, pending_campaign_reviews: 0, open_tasks: 0 } });
            return;
        }
        const [counts, relations, memberIds, invitations] = await Promise.all([repo.agencyOverview(id), repo.relationships(id, "agency"), repo.memberWorkspaceIds(user.id), repo.invitations(id)]);
        const clientIds = [...new Set(relations.filter((r) => r.status === "active" && memberIds.includes(String(r.client_workspace_id))).map((r) => String(r.client_workspace_id)))];
        const workspaceRows = await repo.clientWorkspaces(clientIds);
        const byId = new Map(workspaceRows.map((w) => [String(w.id), w]));
        const clients = relations.map((relation) => {
            const authorized = memberIds.includes(String(relation.client_workspace_id));
            return { relationship: relation, client: authorized ? byId.get(String(relation.client_workspace_id)) ?? null : null, access: authorized ? "member_authorized" : "membership_required" };
        });
        response.status(200).json({ designated: true, profile, counts, clients, pendingInvitations: invitations.filter((i) => i.status === "pending").length, dataSource: "POSTGRESQL_RECORDS_AND_SIMULATED_CAMPAIGN_STATUS" });
    }));
    router.get("/api/workspaces/:workspaceId/agency/clients", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.read");
        if (!await repo.agencyProfile(id))
            throw new HttpError(409, "agency_not_designated", "Set up this workspace as an agency before managing client relationships.");
        const parsed = AgencyListQuerySchema.safeParse(request.query);
        if (!parsed.success)
            throw new HttpError(400, "agency_filter_invalid", "Client directory filters are invalid.");
        const [relations, memberIds] = await Promise.all([repo.relationships(id, "agency"), repo.memberWorkspaceIds(user.id)]);
        const page = parsed.data.page;
        const pageSize = parsed.data.pageSize;
        const scoped = relations.filter((item) => (!parsed.data.status || item.status === parsed.data.status));
        const authorizedIds = [...new Set(scoped.filter((r) => r.status === "active" && memberIds.includes(String(r.client_workspace_id))).map((r) => String(r.client_workspace_id)))];
        const workspaces = await repo.clientWorkspaces(authorizedIds);
        const byId = new Map(workspaces.map((w) => [String(w.id), w]));
        const search = parsed.data.search?.toLowerCase();
        const industry = parsed.data.industry;
        const rows = scoped.map((relationship) => {
            const isMember = memberIds.includes(String(relationship.client_workspace_id));
            const client = relationship.status === "active" && isMember ? byId.get(String(relationship.client_workspace_id)) ?? null : null;
            return { relationship, client, access: client ? "member_authorized" : "membership_required" };
        }).filter((item) => !search || String(item.client?.name ?? "awaiting authorization").toLowerCase().includes(search))
            .filter((item) => !industry || item.client?.industry_key === industry);
        const start = (page - 1) * pageSize;
        response.status(200).json({ rows: rows.slice(start, start + pageSize), total: rows.length, page, pageSize });
    }));
    router.post("/api/workspaces/:workspaceId/agency/relationships", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        if (!await repo.agencyProfile(id))
            throw new HttpError(409, "agency_not_designated", "Set up this workspace as an agency before requesting client collaboration.");
        const input = parseBody(AgencyRelationshipRequestSchema, request.body, "Enter a valid client workspace identifier.");
        const relationship = await repo.requestRelationship(id, input.otherWorkspaceId, "agency");
        response.status(201).json({ relationship, note: "The client owner must accept before the relationship becomes active." });
    }));
    router.post("/api/workspaces/:workspaceId/agency/relationships/:relationshipId/decision", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const relationId = recordId(request.params.relationshipId, "Relationship");
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        const input = parseBody(AgencyRelationshipTransitionSchema, request.body, "Choose a supported relationship action.");
        if (!(await repo.relationships(id, "agency")).some((relationship) => relationship.id === relationId))
            throw new HttpError(404, "agency_relationship_not_found", "The relationship was not found in this agency workspace.");
        const relation = await repo.transitionRelationship(relationId, input.action);
        if (relation.agency_workspace_id !== id)
            throw new HttpError(404, "agency_relationship_not_found", "The relationship was not found in this agency workspace.");
        response.status(200).json({ relationship: relation });
    }));
    router.get("/api/workspaces/:workspaceId/agency/team", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        if (!await repo.agencyProfile(id))
            throw new HttpError(409, "agency_not_designated", "Set up this workspace as an agency first.");
        const [members, assignments, relations] = await Promise.all([repo.teamMembers(id), repo.assignments(id), repo.relationships(id, "agency")]);
        response.status(200).json({ members, assignments, relationships: relations, emailDelivery: "unavailable" });
    }));
    router.post("/api/workspaces/:workspaceId/agency/assignments", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        const input = parseBody(AgencyAssignmentInputSchema, request.body, "Assignment details are invalid.");
        const assignment = await repo.createAssignment(input.relationshipId, input.assigneeUserId, input.responsibility);
        if (assignment.agency_workspace_id !== id)
            throw new HttpError(404, "agency_relationship_not_found", "The relationship was not found in this agency workspace.");
        response.status(201).json({ assignment, authorization: "Client workspace membership is still required; assignments alone do not grant access." });
    }));
    router.delete("/api/workspaces/:workspaceId/agency/assignments/:assignmentId", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const assignmentId = recordId(request.params.assignmentId, "Assignment");
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        const assignment = await repo.revokeAssignment(assignmentId);
        if (assignment.agency_workspace_id !== id)
            throw new HttpError(404, "agency_assignment_not_found", "The assignment was not found in this agency workspace.");
        response.status(200).json({ assignment });
    }));
    router.delete("/api/workspaces/:workspaceId/agency/team/:userId", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const targetId = recordId(request.params.userId, "User");
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        const result = await repo.removeTeamMember(id, targetId);
        response.status(200).json({ result, independentClientMemberships: "Preserved; only memberships created from this agency's tracked grants are removed." });
    }));
    router.get("/api/workspaces/:workspaceId/agency/invitations", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        response.status(200).json({ invitations: await repo.invitations(id), delivery: "not_emailed" });
    }));
    router.post("/api/workspaces/:workspaceId/agency/invitations", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        const parsed = WorkspaceInvitationInputSchema.safeParse(request.body);
        if (!parsed.success || parsed.data.relationshipId)
            throw new HttpError(400, "agency_invitation_invalid", "Use an agency team role and email address for this invitation.");
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const invitation = await repo.createInvitation({ workspaceId: id, relationshipId: null, email: parsed.data.email, role: parsed.data.role, tokenHash: inviteTokenHash(token), expiresAt });
        response.status(201).json({ invitation, invitationLink: makeInvitationLink(request, apiConfig, token), delivery: "not_emailed", copyInstruction: "Invitation link created — not emailed. Share it with the invited person through your approved channel." });
    }));
    router.post("/api/workspaces/:workspaceId/agency/invitations/:invitationId/revoke", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const invitationId = recordId(request.params.invitationId, "Invitation");
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.manage");
        const invitation = await repo.revokeInvitation(invitationId);
        if (invitation.workspace_id !== id)
            throw new HttpError(404, "agency_invitation_not_found", "The invitation was not found in this agency workspace.");
        response.status(200).json({ invitation });
    }));
    router.get("/api/workspaces/:workspaceId/agency/activity", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "agency.read");
        const parsed = AgencyListQuerySchema.pick({ page: true, pageSize: true }).safeParse(request.query);
        if (!parsed.success)
            throw new HttpError(400, "agency_filter_invalid", "Activity pagination is invalid.");
        response.status(200).json(await repo.activity(id, "agency", parsed.data.page, parsed.data.pageSize));
    }));
    router.get("/api/workspaces/:workspaceId/client/overview", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.read");
        const [overview, relations, tasks, comments] = await Promise.all([repo.clientOverview(id), repo.relationships(id, "client"), repo.tasks(id), repo.comments(id)]);
        response.status(200).json({ overview, relationships: relations, tasks: tasks.filter((task) => task.visibility === "client_visible"), comments: comments.filter((comment) => comment.visibility === "client_visible"), dataSource: "WORKSPACE_RECORDS_AND_DEMO_CAMPAIGN_STATUS" });
    }));
    router.get("/api/workspaces/:workspaceId/client/relationships", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.read");
        const relations = await repo.relationships(id, "client");
        response.status(200).json({ relationships: relations });
    }));
    router.post("/api/workspaces/:workspaceId/client/relationships", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.manageAccess");
        const input = parseBody(AgencyRelationshipRequestSchema, request.body, "Enter a valid agency workspace identifier.");
        const relationship = await repo.requestRelationship(id, input.otherWorkspaceId, "client");
        response.status(201).json({ relationship, note: "The agency owner or admin must accept this collaboration request." });
    }));
    router.post("/api/workspaces/:workspaceId/client/relationships/:relationshipId/decision", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const relationshipId = recordId(request.params.relationshipId, "Relationship");
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.manageAccess");
        const input = parseBody(AgencyRelationshipTransitionSchema, request.body, "Choose a supported relationship action.");
        if (!(await repo.relationships(id, "client")).some((relationship) => relationship.id === relationshipId))
            throw new HttpError(404, "client_relationship_not_found", "The relationship was not found in this client workspace.");
        const relationship = await repo.transitionRelationship(relationshipId, input.action);
        if (relationship.client_workspace_id !== id)
            throw new HttpError(404, "client_relationship_not_found", "The relationship was not found in this client workspace.");
        response.status(200).json({ relationship });
    }));
    router.post("/api/workspaces/:workspaceId/client/agency-invitations", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.manageAccess");
        const parsed = WorkspaceInvitationInputSchema.safeParse(request.body);
        if (!parsed.success || !parsed.data.relationshipId || !["editor", "viewer"].includes(parsed.data.role))
            throw new HttpError(400, "client_invitation_invalid", "Choose an active agency relationship, verified agency member email, and editor/viewer role.");
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const invitation = await repo.createInvitation({ workspaceId: id, relationshipId: parsed.data.relationshipId, email: parsed.data.email, role: parsed.data.role, tokenHash: inviteTokenHash(token), expiresAt });
        response.status(201).json({ invitation, invitationLink: makeInvitationLink(request, apiConfig, token), delivery: "not_emailed", copyInstruction: "Invitation link created — not emailed. The invited agency member must sign in with the verified invited email." });
    }));
    router.get("/api/workspaces/:workspaceId/client/tasks", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.read");
        const taskRows = await repo.tasks(id);
        response.status(200).json({ tasks: taskRows });
    }));
    router.post("/api/workspaces/:workspaceId/client/tasks", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.collaborate");
        const input = parseBody(ClientTaskInputSchema, request.body, "Task details are invalid.");
        const task = await repo.createTask(id, input);
        response.status(201).json({ task });
    }));
    router.patch("/api/workspaces/:workspaceId/client/tasks/:taskId", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const taskId = recordId(request.params.taskId, "Task");
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.collaborate");
        const input = parseBody(ClientTaskPatchSchema, request.body, "Task changes are invalid.");
        const { expectedVersion, ...patch } = input;
        const task = await repo.updateTask(id, taskId, expectedVersion, patch);
        response.status(200).json({ task });
    }));
    router.get("/api/workspaces/:workspaceId/client/comments", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.read");
        const resourceType = typeof request.query.resourceType === "string" ? request.query.resourceType : undefined;
        const resourceId = request.query.resourceId === undefined ? undefined : recordId(request.query.resourceId, "Resource");
        response.status(200).json({ comments: await repo.comments(id, resourceType, resourceId) });
    }));
    router.post("/api/workspaces/:workspaceId/client/comments", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.collaborate");
        const input = parseBody(ClientCommentInputSchema, request.body, "Comment details are invalid.");
        const comment = await repo.createComment(id, input);
        response.status(201).json({ comment });
    }));
    router.post("/api/workspaces/:workspaceId/client/comments/:commentId/resolve", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const commentId = recordId(request.params.commentId, "Comment");
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.collaborate");
        const input = parseBody(z.object({ resolve: z.boolean() }).strict(), request.body, "Choose whether to resolve the discussion.");
        response.status(200).json({ comment: await repo.resolveComment(id, commentId, input.resolve) });
    }));
    router.get("/api/workspaces/:workspaceId/client/activity", authenticate, asyncRoute(async (request, response) => {
        const id = workspaceId(request.params.workspaceId);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        await authorize(repo, id, user, "client.read");
        const parsed = AgencyListQuerySchema.pick({ page: true, pageSize: true }).safeParse(request.query);
        if (!parsed.success)
            throw new HttpError(400, "agency_filter_invalid", "Activity pagination is invalid.");
        response.status(200).json(await repo.activity(id, "client", parsed.data.page, parsed.data.pageSize));
    }));
    router.post("/api/invitations/accept", authenticate, asyncRoute(async (request, response) => {
        rateLimitInvitationAcceptance(request);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        const input = parseBody(InvitationAcceptSchema, request.body, "Invitation token is invalid.");
        if (!user.emailConfirmedAt || !user.email)
            throw new HttpError(403, "invitation_email_unverified", "Verify the invitation email address before accepting.");
        const result = await repo.acceptInvitation(inviteTokenHash(input.token), "accept");
        response.status(200).json({ result, membershipAdded: result.membership_existed !== true });
    }));
    router.post("/api/invitations/decline", authenticate, asyncRoute(async (request, response) => {
        rateLimitInvitationAcceptance(request);
        const user = actor(response);
        const repo = repoFor(response, repoFactory);
        const input = parseBody(InvitationAcceptSchema, request.body, "Invitation token is invalid.");
        if (!user.emailConfirmedAt || !user.email)
            throw new HttpError(403, "invitation_email_unverified", "Verify the invitation email address before declining.");
        response.status(200).json({ result: await repo.acceptInvitation(inviteTokenHash(input.token), "decline") });
    }));
    return router;
}
