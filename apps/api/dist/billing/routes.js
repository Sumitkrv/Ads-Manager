import express from "express";
import { z } from "zod";
import { BillingCancelRequestSchema, BillingPlanRequestSchema, BillingSummarySchema } from "@ai-ads/shared";
import { createRequireAuthenticatedUser } from "../auth.js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { verifySupabaseAccessToken } from "../supabase-auth.js";
import { createDemoInvoicePdf } from "./pdf.js";
import { createSupabasePlatformAdminRepository } from "../platform-admin/repository.js";
import { createSupabaseBillingAdminRepository, createSupabaseBillingRepository, } from "./repository.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IdSchema = z.string().regex(UUID);
const AdminPlanInputSchema = z.object({
    id: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/), name: z.string().trim().min(1).max(80), description: z.string().max(500).default(""),
    currency: z.string().regex(/^[A-Z]{3}$/), monthlyPriceMinor: z.number().int().nonnegative().nullable(), annualPriceMinor: z.number().int().nonnegative().nullable(),
    trialDays: z.number().int().min(0).max(90), features: z.record(z.string(), z.boolean()), limits: z.record(z.string(), z.number().int().min(-1)),
    public: z.boolean(), active: z.boolean(), sortOrder: z.number().int(),
}).strict();
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function actor(response) {
    const user = response.locals.authenticatedUser;
    if (!user)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return user;
}
function workspaceId(value) {
    const parsed = IdSchema.safeParse(value);
    if (!parsed.success)
        throw new HttpError(400, "invalid_workspace_id", "Workspace identifier is invalid.");
    return parsed.data;
}
function repoFor(response, factory) {
    const token = response.locals.authenticatedAccessToken;
    const selected = factory === undefined ? createSupabaseBillingRepository : factory;
    if (typeof token !== "string" || !selected)
        throw new HttpError(503, "billing_unavailable", "Billing simulation is not available.");
    const repository = selected(token);
    if (!repository)
        throw new HttpError(503, "billing_unavailable", "Billing simulation is not available.");
    return repository;
}
function adminRepoFor(factory) {
    const selected = factory === undefined ? createSupabaseBillingAdminRepository : factory;
    const repository = selected?.();
    if (!repository)
        throw new HttpError(503, "billing_admin_unavailable", "The local billing operator service is not configured.");
    return repository;
}
function isLocalOperator(user, apiConfig) {
    if (apiConfig.APP_ENV !== "development" || apiConfig.BILLING_MODE !== "simulation" || !apiConfig.SUPABASE_URL)
        return false;
    const loopback = (() => { try {
        return new Set(["127.0.0.1", "localhost", "::1"]).has(new URL(apiConfig.SUPABASE_URL).hostname);
    }
    catch {
        return false;
    } })();
    if (!loopback)
        return false;
    const allowlist = apiConfig.BILLING_DEMO_ADMIN_USER_IDS?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
    return allowlist.includes(user.id);
}
async function hasBillingAdminCapability(user, apiConfig, custom) {
    if (custom)
        return custom(user, apiConfig);
    if (isLocalOperator(user, apiConfig))
        return true;
    const repository = createSupabasePlatformAdminRepository(apiConfig);
    return repository ? repository.hasCapability(user.id, "platform.billing.manage") : false;
}
async function requireBillingOperator(user, apiConfig, custom) {
    if (!(await hasBillingAdminCapability(user, apiConfig, custom))) {
        throw new HttpError(403, "billing_operator_forbidden", "This operation requires the platform billing management capability.");
    }
}
function parseDbJson(value) {
    if (value && typeof value === "object" && !Array.isArray(value))
        return value;
    throw new HttpError(503, "billing_response_invalid", "Billing service returned an invalid response.");
}
export function createBillingRouter(apiConfig = config, verifier, dependencies = {}) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifier === undefined ? (apiConfig.supabaseConfigured ? verifySupabaseAccessToken : null) : verifier);
    const factory = dependencies.repositoryFactory;
    const adminFactory = dependencies.adminRepositoryFactory;
    router.get("/api/billing/plans", asyncRoute(async (_request, response) => {
        const selected = factory === undefined ? createSupabaseBillingRepository(null, apiConfig) : factory?.("public-catalog") ?? null;
        if (!selected)
            throw new HttpError(503, "billing_unavailable", "The plan catalog is temporarily unavailable.");
        const plans = await selected.plans();
        if (!Array.isArray(plans))
            throw new HttpError(503, "billing_response_invalid", "The plan catalog returned an invalid response.");
        response.setHeader("Cache-Control", "public, max-age=60");
        response.status(200).json({ mode: apiConfig.BILLING_MODE, plans });
    }));
    router.get("/api/workspaces/:workspaceId/billing/subscription", authenticate, asyncRoute(async (request, response) => {
        const result = BillingSummarySchema.safeParse(await repoFor(response, factory).summary(workspaceId(request.params.workspaceId)));
        if (!result.success)
            throw new HttpError(503, "billing_response_invalid", "The subscription response was invalid.");
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json(result.data);
    }));
    router.get("/api/workspaces/:workspaceId/billing/usage", authenticate, asyncRoute(async (request, response) => {
        const usage = parseDbJson(await repoFor(response, factory).usage(workspaceId(request.params.workspaceId)));
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json({ mode: "simulation", ...usage, label: "Usage metered by this workspace's saved records" });
    }));
    router.get("/api/workspaces/:workspaceId/billing/history", authenticate, asyncRoute(async (request, response) => {
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json(parseDbJson(await repoFor(response, factory).history(workspaceId(request.params.workspaceId))));
    }));
    router.post("/api/workspaces/:workspaceId/billing/change-requests", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const input = BillingPlanRequestSchema.safeParse(request.body);
        if (!input.success)
            throw new HttpError(400, "billing_request_invalid", "Choose a valid plan and billing interval.");
        const result = await repoFor(response, factory).requestPlan(workspace, input.data.planId, input.data.interval, input.data.idempotencyKey);
        response.status(201).json({ request: parseDbJson(result), message: "Plan change request saved. It is not a payment or an active subscription." });
    }));
    router.post("/api/workspaces/:workspaceId/billing/cancel-request", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const input = BillingCancelRequestSchema.safeParse(request.body);
        if (!input.success)
            throw new HttpError(400, "billing_request_invalid", "Cancellation request is invalid.");
        response.status(200).json({ request: parseDbJson(await repoFor(response, factory).cancel(workspace, input.data.idempotencyKey, input.data.reason)), mode: "simulation" });
    }));
    router.post("/api/workspaces/:workspaceId/billing/reactivate-request", authenticate, asyncRoute(async (request, response) => {
        const workspace = workspaceId(request.params.workspaceId);
        const parsed = z.object({ idempotencyKey: z.string().uuid() }).strict().safeParse(request.body);
        if (!parsed.success)
            throw new HttpError(400, "billing_request_invalid", "Reactivation request is invalid.");
        response.status(200).json({ request: parseDbJson(await repoFor(response, factory).reactivate(workspace, parsed.data.idempotencyKey)), mode: "simulation" });
    }));
    router.get("/api/workspaces/:workspaceId/billing/invoices/:invoiceId/pdf", authenticate, asyncRoute(async (request, response) => {
        const result = parseDbJson(await repoFor(response, factory).invoice(workspaceId(request.params.workspaceId), workspaceId(request.params.invoiceId)));
        const invoice = parseDbJson(result.invoice);
        const rawItems = Array.isArray(result.items) ? result.items : [];
        const planId = String(invoice.plan_id ?? "demo plan");
        const plansResult = await repoFor(response, factory).plans();
        const plan = Array.isArray(plansResult) ? plansResult.find((item) => item && typeof item === "object" && item.id === planId) : undefined;
        const pdf = createDemoInvoicePdf({
            workspaceName: parseDbJson(result.workspace).name, invoiceId: invoice.id, planName: plan?.name ?? planId, interval: invoice.billing_interval,
            currency: invoice.currency, subtotalMinor: invoice.subtotal_minor, taxMinor: invoice.illustrative_tax_minor, totalMinor: invoice.total_minor,
            periodStart: invoice.billing_period_start, periodEnd: invoice.billing_period_end,
            items: rawItems.map((value) => value && typeof value === "object" ? value : {}),
        });
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Disposition", `attachment; filename="demo-invoice-${String(invoice.id)}.pdf"`);
        response.status(200).send(pdf);
    }));
    router.get("/api/platform-admin/billing/access", authenticate, asyncRoute(async (_request, response) => {
        const authorized = await hasBillingAdminCapability(actor(response), apiConfig, dependencies.adminAllowed);
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json({ allowed: authorized, mode: apiConfig.BILLING_MODE, environment: apiConfig.APP_ENV });
    }));
    router.get("/api/platform-admin/billing/plans", authenticate, asyncRoute(async (_request, response) => {
        const user = actor(response);
        await requireBillingOperator(user, apiConfig, dependencies.adminAllowed);
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json({ plans: await adminRepoFor(adminFactory).catalog(), mode: "simulation" });
    }));
    router.post("/api/platform-admin/billing/plans", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        await requireBillingOperator(user, apiConfig, dependencies.adminAllowed);
        const input = AdminPlanInputSchema.safeParse(request.body);
        if (!input.success)
            throw new HttpError(400, "billing_plan_invalid", "Plan values or entitlements are invalid.");
        response.status(200).json({ plan: await adminRepoFor(adminFactory).savePlan(input.data, user.id), mode: "simulation" });
    }));
    router.get("/api/platform-admin/billing/subscriptions", authenticate, asyncRoute(async (_request, response) => {
        const user = actor(response);
        await requireBillingOperator(user, apiConfig, dependencies.adminAllowed);
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json({ subscriptions: await adminRepoFor(adminFactory).subscriptions(), mode: "simulation" });
    }));
    router.post("/api/platform-admin/billing/demo-transitions", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        await requireBillingOperator(user, apiConfig, dependencies.adminAllowed);
        const input = z.object({ requestId: z.string().uuid() }).strict().safeParse(request.body);
        if (!input.success)
            throw new HttpError(400, "billing_request_invalid", "Choose a valid pending request.");
        response.status(200).json({ result: await adminRepoFor(adminFactory).activate(input.data.requestId, user.id), mode: "simulation", paymentProcessed: false });
    }));
    router.post("/api/platform-admin/billing/renewals", authenticate, asyncRoute(async (request, response) => {
        const user = actor(response);
        await requireBillingOperator(user, apiConfig, dependencies.adminAllowed);
        const input = z.object({ workspaceId: IdSchema, idempotencyKey: z.string().uuid() }).strict().safeParse(request.body);
        if (!input.success)
            throw new HttpError(400, "billing_request_invalid", "Workspace and idempotency identifiers are required.");
        response.status(200).json({ result: await adminRepoFor(adminFactory).renew(input.data.workspaceId, user.id, input.data.idempotencyKey), mode: "simulation", paymentProcessed: false });
    }));
    return router;
}
