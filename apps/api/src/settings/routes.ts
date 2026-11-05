import { createHash, randomBytes } from "node:crypto";
import express, { type Request, type Response } from "express";
import {
  ClosureRequestResponseSchema,
  UserPreferencesPatchSchema,
  UserPreferencesSchema,
  WorkspaceInvitationCreateSchema,
  WorkspaceMemberRolePatchSchema,
  WorkspacePreferencesPatchSchema,
  WorkspacePreferencesSchema,
  WorkspaceRoleSchema,
  WorkspaceTeamResponseSchema,
  hasWorkspacePermission,
} from "@ai-ads/shared";
import { createRequireAuthenticatedUser, type AuthenticatedApiUser, type TokenVerifier } from "../auth.js";
import { HttpError } from "../errors.js";
import { config, type ApiConfig } from "../config.js";
import { verifySupabaseAccessToken } from "../supabase-auth.js";
import { createSupabaseSettingsRepository, type SettingsRepository, type SettingsRepositoryFactory } from "./repository.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const inviteAttempts = new Map<string, { start: number; count: number }>();
const INVITE_WINDOW_MS = 15 * 60 * 1000;
const INVITE_LIMIT = 8;

export type SettingsRouteDependencies = { repositoryFactory?: SettingsRepositoryFactory | null };

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): express.RequestHandler {
  return (request, response, next) => { void handler(request, response).catch(next); };
}

function actor(response: Response): AuthenticatedApiUser {
  const result = response.locals.authenticatedUser as AuthenticatedApiUser | undefined;
  if (!result) throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
  return result;
}

function parseId(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, "settings_id_invalid", `${label} identifier is invalid.`);
  return value;
}

function repository(response: Response, factory: SettingsRepositoryFactory | null | undefined): SettingsRepository {
  const token = response.locals.authenticatedAccessToken;
  const selected = factory === undefined ? createSupabaseSettingsRepository : factory;
  if (typeof token !== "string" || !selected) throw new HttpError(503, "settings_service_unavailable", "Settings storage is not configured.");
  const result = selected(token);
  if (!result) throw new HttpError(503, "settings_service_unavailable", "Settings storage is not configured.");
  return result;
}

function parseWorkspaceRole(value: string | null): "owner" | "admin" | "editor" | "viewer" {
  const parsed = WorkspaceRoleSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
  return parsed.data;
}

async function authorizeWorkspace(
  repo: SettingsRepository,
  workspaceId: string,
  userId: string,
  permission: "workspace.read" | "workspace.updateSettings" | "workspace.viewMembers",
): Promise<"owner" | "admin" | "editor" | "viewer"> {
  const role = parseWorkspaceRole(await repo.getWorkspaceRole(workspaceId, userId));
  if (!hasWorkspacePermission(role, permission)) throw new HttpError(403, "settings_forbidden", "Your current workspace role does not allow this settings action.");
  return role;
}

function invitationOrigin(request: Request, apiConfig: ApiConfig): string {
  const requested = request.get("origin");
  const origin = requested && apiConfig.corsAllowedOrigins.includes(requested) ? requested : apiConfig.corsAllowedOrigins[0];
  if (!origin) throw new HttpError(503, "invitation_link_unavailable", "No approved application origin is configured for invitation links.");
  return origin;
}

function invitationLink(request: Request, apiConfig: ApiConfig, token: string): string {
  const link = new URL("/app/invitations/accept", invitationOrigin(request, apiConfig));
  link.hash = new URLSearchParams({ token }).toString();
  return link.toString();
}

function rateLimitInvitationCreation(userId: string): void {
  const now = Date.now();
  const current = inviteAttempts.get(userId);
  if (!current || now - current.start >= INVITE_WINDOW_MS) {
    inviteAttempts.set(userId, { start: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > INVITE_LIMIT) throw new HttpError(429, "invitation_rate_limited", "Too many invitation links were created. Wait before trying again.");
}

function closurePayload(row: Record<string, unknown>, scope: "account" | "workspace") {
  const parsed = ClosureRequestResponseSchema.safeParse({
    request: { id: row.id, scope: row.scope, status: row.status, createdAt: row.created_at },
    message: "Request recorded for administrative review. No data was deleted.",
  });
  if (!parsed.success || parsed.data.request.scope !== scope) throw new HttpError(503, "settings_response_invalid", "The closure request could not be confirmed.");
  return parsed.data;
}

export function createSettingsRouter(
  apiConfig: ApiConfig = config,
  verifier?: TokenVerifier | null,
  dependencies: SettingsRouteDependencies = {},
): express.Router {
  const router = express.Router();
  const authenticate = createRequireAuthenticatedUser(verifier === undefined ? (apiConfig.supabaseConfigured ? verifySupabaseAccessToken : null) : verifier);
  const factory = dependencies.repositoryFactory;

  router.get("/api/me/preferences", authenticate, asyncRoute(async (_request, response) => {
    response.setHeader("Cache-Control", "private, no-store");
    const preferences = await repository(response, factory).getUserPreferences(actor(response).id);
    response.status(200).json({ preferences: UserPreferencesSchema.parse(preferences) });
  }));

  router.patch("/api/me/preferences", authenticate, asyncRoute(async (request, response) => {
    const parsed = UserPreferencesPatchSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "preferences_invalid", "Review the personal preferences and try again.");
    const repo = repository(response, factory);
    const current = await repo.getUserPreferences(actor(response).id);
    const merged = UserPreferencesSchema.safeParse({ ...current, ...parsed.data, notifications: { ...current.notifications, ...parsed.data.notifications } });
    if (!merged.success) throw new HttpError(400, "preferences_invalid", "Review the personal preferences and try again.");
    const preferences = await repo.saveUserPreferences(actor(response).id, merged.data);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ preferences });
  }));

  router.get("/api/me/export", authenticate, asyncRoute(async (_request, response) => {
    const user = actor(response);
    const data = await repository(response, factory).accountExport(user.id);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Disposition", 'attachment; filename="tandem-account-export.json"');
    response.status(200).json({ exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email, emailConfirmedAt: user.emailConfirmedAt, createdAt: user.createdAt }, data });
  }));

  router.get("/api/me/closure-requests", authenticate, asyncRoute(async (_request, response) => {
    const user = actor(response);
    const requests = await repository(response, factory).closureRequests("account", user.id, null);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ requests });
  }));

  router.post("/api/me/closure-requests", authenticate, asyncRoute(async (_request, response) => {
    const row = await repository(response, factory).requestClosure("account", null);
    response.status(201).json(closurePayload(row, "account"));
  }));

  router.get("/api/workspaces/:workspaceId/preferences", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, actor(response).id, "workspace.read");
    const preferences = await repo.getWorkspacePreferences(workspaceId);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ preferences: WorkspacePreferencesSchema.parse(preferences) });
  }));

  router.patch("/api/workspaces/:workspaceId/preferences", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const parsed = WorkspacePreferencesPatchSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "workspace_preferences_invalid", "Review the workspace defaults and try again.");
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, actor(response).id, "workspace.updateSettings");
    const current = await repo.getWorkspacePreferences(workspaceId);
    const merged = WorkspacePreferencesSchema.safeParse({ ...current, ...parsed.data });
    if (!merged.success) throw new HttpError(400, "workspace_preferences_invalid", "Review the workspace defaults and try again.");
    response.status(200).json({ preferences: await repo.saveWorkspacePreferences(workspaceId, merged.data) });
  }));

  router.get("/api/workspaces/:workspaceId/team", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const repo = repository(response, factory);
    const role = await authorizeWorkspace(repo, workspaceId, actor(response).id, "workspace.viewMembers");
    const team = await repo.getTeam(workspaceId, role);
    const parsed = WorkspaceTeamResponseSchema.safeParse(team);
    if (!parsed.success) throw new HttpError(503, "settings_response_invalid", "The team response was invalid.");
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json(parsed.data);
  }));

  router.post("/api/workspaces/:workspaceId/team/invitations", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const user = actor(response);
    const repo = repository(response, factory);
    const role = await authorizeWorkspace(repo, workspaceId, user.id, "workspace.viewMembers");
    const parsed = WorkspaceInvitationCreateSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "invitation_invalid", "Enter a valid email address and permitted team role.");
    if (role === "admin" && parsed.data.role === "admin") throw new HttpError(403, "invitation_role_forbidden", "Admins may invite editors and viewers only.");
    rateLimitInvitationCreation(user.id);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invitation = await repo.createInvitation({
      workspaceId,
      email: parsed.data.email.trim().toLowerCase(),
      role: parsed.data.role,
      tokenHash: createHash("sha256").update(token, "utf8").digest("hex"),
      expiresAt,
    });
    response.status(201).json({
      invitation: { id: invitation.id, email: invitation.invited_email, role: invitation.invited_role, status: invitation.status, expiresAt: invitation.expires_at },
      invitationLink: invitationLink(request, apiConfig, token),
      delivery: "not_emailed",
      copyInstruction: "Invitation link created — not emailed. Share it with the invited person through your approved channel.",
    });
  }));

  router.post("/api/workspaces/:workspaceId/team/invitations/:invitationId/revoke", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const invitationId = parseId(request.params.invitationId, "Invitation");
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, actor(response).id, "workspace.viewMembers");
    const invitation = await repo.revokeInvitation(workspaceId, invitationId);
    response.status(200).json({ invitation: { id: invitation.id, workspaceId, status: invitation.status } });
  }));

  router.patch("/api/workspaces/:workspaceId/team/:userId", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const targetUserId = parseId(request.params.userId, "User");
    const user = actor(response);
    const parsed = WorkspaceMemberRolePatchSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "member_role_invalid", "Choose a permitted team role.");
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, user.id, "workspace.viewMembers");
    const result = await repo.updateMemberRole(workspaceId, targetUserId, parsed.data.role);
    response.status(200).json({ member: result });
  }));

  router.delete("/api/workspaces/:workspaceId/team/:userId", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const targetUserId = parseId(request.params.userId, "User");
    const user = actor(response);
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, user.id, "workspace.viewMembers");
    const result = await repo.removeMember(workspaceId, targetUserId);
    response.status(200).json({ member: result });
  }));

  router.get("/api/workspaces/:workspaceId/security/activity", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, actor(response).id, "workspace.viewMembers");
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ activity: await repo.activity(workspaceId) });
  }));

  router.get("/api/workspaces/:workspaceId/export", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, actor(response).id, "workspace.read");
    const data = await repo.workspaceExport(workspaceId);
    if (!data) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Disposition", 'attachment; filename="tandem-workspace-metadata.json"');
    response.status(200).json({ exportedAt: new Date().toISOString(), data });
  }));

  router.get("/api/workspaces/:workspaceId/closure-requests", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const repo = repository(response, factory);
    await authorizeWorkspace(repo, workspaceId, actor(response).id, "workspace.viewMembers");
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ requests: await repo.closureRequests("workspace", actor(response).id, workspaceId) });
  }));

  router.post("/api/workspaces/:workspaceId/closure-requests", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "Workspace");
    const repo = repository(response, factory);
    const role = parseWorkspaceRole(await repo.getWorkspaceRole(workspaceId, actor(response).id));
    if (role !== "owner") throw new HttpError(403, "workspace_closure_forbidden", "Only the workspace owner may request workspace closure.");
    const result = await repo.requestClosure("workspace", workspaceId);
    response.status(201).json(closurePayload(result, "workspace"));
  }));

  return router;
}
