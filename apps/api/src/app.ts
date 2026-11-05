import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import {
  ApiErrorResponseSchema,
  CreateWorkspaceInputSchema,
  HealthResponseSchema,
  WorkspaceMembersResponseSchema,
  WorkspaceResponseSchema,
  WorkspaceSettingsInputSchema,
  WorkspacesResponseSchema,
  hasWorkspacePermission,
  MeResponseSchema,
} from "@ai-ads/shared";
import { config, type ApiConfig } from "./config.js";
import {
  createRequireAuthenticatedUser,
  type AuthenticatedApiUser,
  type TokenVerifier,
} from "./auth.js";
import { HttpError } from "./errors.js";
import { createAdvertisingIntegrationsRouter } from "./integrations/routes.js";
import { createCampaignsRouter } from "./campaigns/routes.js";
import { createCreativesRouter } from "./creatives/routes.js";
import { createOptimizationRouter } from "./optimization/routes.js";
import { createAnalyticsRouter } from "./analytics/routes.js";
import { createAgencyRouter } from "./agency/routes.js";
import { createBillingRouter } from "./billing/routes.js";
import { createPlatformAdminRouter } from "./platform-admin/routes.js";
import { createOnboardingRouter } from "./onboarding/routes.js";
import { createSettingsRouter } from "./settings/routes.js";
import { createTrackingRouter } from "./tracking/routes.js";
import { verifySupabaseAccessToken } from "./supabase-auth.js";
import {
  createSupabaseWorkspaceRepository,
  type WorkspaceRepositoryFactory,
} from "./workspaces.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sendHealth(_request: Request, response: Response): void {
  const payload = HealthResponseSchema.parse({
    status: "ok",
    service: "ai-ads-api",
    version: process.env.npm_package_version ?? "0.1.0",
    timestamp: new Date().toISOString(),
  });

  response.status(200).json(payload);
}

function sendMe(_request: Request, response: Response): void {
  const user = response.locals.authenticatedUser;
  const payload = MeResponseSchema.parse({ user });
  response.status(200).json(payload);
}

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const knownError = error instanceof HttpError;
  const bodyErrorType =
    isRecord(error) && typeof error.type === "string" ? error.type : null;
  const bodyWasTooLarge = bodyErrorType === "entity.too.large";
  const bodyWasInvalid = bodyErrorType === "entity.parse.failed";

  const statusCode = knownError
    ? error.statusCode
    : bodyWasTooLarge
      ? 413
      : bodyWasInvalid
        ? 400
        : 500;
  const code = knownError
    ? error.code
    : bodyWasTooLarge
      ? "request_too_large"
      : bodyWasInvalid
        ? "invalid_json"
        : "internal_error";
  const message = knownError
    ? error.message
    : bodyWasTooLarge
      ? "The request body exceeds the allowed size."
      : bodyWasInvalid
        ? "The request body is not valid JSON."
        : "An unexpected error occurred.";

  const payload = ApiErrorResponseSchema.parse({
    status: "error",
    error: { code, message },
  });

  response.status(statusCode).json(payload);
};

export function createApp(
  apiConfig: ApiConfig = config,
  injectedVerifier?: TokenVerifier | null,
  injectedWorkspaceRepositoryFactory?: WorkspaceRepositoryFactory | null,
): express.Express {
  const app = express();
  const allowedOrigins = new Set(apiConfig.corsAllowedOrigins);
  const verifyToken =
    injectedVerifier === undefined
      ? apiConfig.supabaseConfigured
        ? verifySupabaseAccessToken
        : null
      : injectedVerifier;
  const repositoryFactory = injectedWorkspaceRepositoryFactory === undefined
    ? createSupabaseWorkspaceRepository
    : injectedWorkspaceRepositoryFactory;

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, false);
          return;
        }

        if (allowedOrigins.has(origin)) {
          callback(null, origin);
          return;
        }

        callback(
          new HttpError(403, "origin_not_allowed", "This origin is not allowed."),
        );
      },
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Asset-Filename", "X-Asset-Type"],
      credentials: false,
      optionsSuccessStatus: 204,
    }),
  );
  app.use("/api/workspaces/:workspaceId/assets", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "5mb" }));
  app.use(express.json({ limit: "100kb", strict: true }));
  app.use(createAdvertisingIntegrationsRouter(apiConfig, verifyToken));
  app.use(createCampaignsRouter(apiConfig, verifyToken));
  app.use(createCreativesRouter(apiConfig, verifyToken));
  app.use(createOptimizationRouter(apiConfig, verifyToken));
  app.use(createAnalyticsRouter(apiConfig, verifyToken));
  app.use(createAgencyRouter(apiConfig, verifyToken));
  app.use(createBillingRouter(apiConfig, verifyToken));
  app.use(createPlatformAdminRouter(apiConfig, verifyToken));
  app.use(createOnboardingRouter(apiConfig, verifyToken));
  app.use(createSettingsRouter(apiConfig, verifyToken));
  app.use(createTrackingRouter(apiConfig, verifyToken));

  app.get("/api/health", sendHealth);
  app.get("/api/me", createRequireAuthenticatedUser(verifyToken), sendMe);

  const authenticate = createRequireAuthenticatedUser(verifyToken);

  function currentUser(response: Response): AuthenticatedApiUser {
    const user = response.locals.authenticatedUser as AuthenticatedApiUser | undefined;
    if (!user) throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return user;
  }

  function workspaceRepository(response: Response) {
    const token = response.locals.authenticatedAccessToken as string | undefined;
    if (!token || !repositoryFactory) {
      throw new HttpError(503, "workspace_service_unavailable", "Workspace service is temporarily unavailable.");
    }
    const repository = repositoryFactory(token);
    if (!repository) {
      throw new HttpError(503, "workspace_service_unavailable", "Workspace service is temporarily unavailable.");
    }
    return repository;
  }

  function parseWorkspaceId(value: unknown): string {
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new HttpError(400, "invalid_workspace_id", "Workspace identifier is invalid.");
    }
    return value;
  }

  const asyncRoute = (
    handler: (request: Request, response: Response) => Promise<void>,
  ): express.RequestHandler => (request, response, next) => {
    void handler(request, response).catch(next);
  };

  app.get("/api/workspaces", authenticate, asyncRoute(async (_request, response) => {
    const user = currentUser(response);
    const workspaces = await workspaceRepository(response).listForUser(user.id);
    response.status(200).json(WorkspacesResponseSchema.parse({ workspaces }));
  }));

  app.post("/api/workspaces", authenticate, asyncRoute(async (request, response) => {
    const parsed = CreateWorkspaceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "invalid_workspace", "Review the workspace details and try again.");
    }
    const created = await workspaceRepository(response).create(parsed.data);
    response.status(201).json(WorkspaceResponseSchema.parse({ workspace: created, role: "owner" }));
  }));

  app.get("/api/workspaces/:workspaceId", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseWorkspaceId(request.params.workspaceId);
    const repository = workspaceRepository(response);
    const user = currentUser(response);
    const role = await repository.getRole(workspaceId, user.id);
    if (!role) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    const workspace = await repository.get(workspaceId);
    if (!workspace) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    response.status(200).json(WorkspaceResponseSchema.parse({ workspace, role }));
  }));

  app.patch("/api/workspaces/:workspaceId", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseWorkspaceId(request.params.workspaceId);
    const parsed = WorkspaceSettingsInputSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "invalid_workspace_settings", "Review the business settings and try again.");
    }
    const repository = workspaceRepository(response);
    const user = currentUser(response);
    const role = await repository.getRole(workspaceId, user.id);
    if (!role) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    if (!hasWorkspacePermission(role, "workspace.updateSettings")) {
      throw new HttpError(403, "workspace_forbidden", "Your workspace role cannot update business settings.");
    }
    const workspace = await repository.update(workspaceId, parsed.data);
    if (!workspace) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    const updatedRole = await repository.getRole(workspaceId, user.id);
    if (!updatedRole) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    response.status(200).json(WorkspaceResponseSchema.parse({ workspace, role: updatedRole }));
  }));

  app.get("/api/workspaces/:workspaceId/members", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseWorkspaceId(request.params.workspaceId);
    const repository = workspaceRepository(response);
    const user = currentUser(response);
    const role = await repository.getRole(workspaceId, user.id);
    if (!role) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    if (!hasWorkspacePermission(role, "workspace.viewMembers")) {
      throw new HttpError(403, "workspace_forbidden", "Your workspace role cannot view its membership list.");
    }
    const members = await repository.listMembers(workspaceId);
    response.status(200).json(WorkspaceMembersResponseSchema.parse({ members }));
  }));

  app.use((_request, _response, next) => {
    next(new HttpError(404, "not_found", "The requested resource was not found."));
  });
  app.use(errorHandler);

  return app;
}
