import { z } from "zod";
export const BillingModeSchema = z.literal("simulation");
export const BillingIntervalSchema = z.enum(["monthly", "annual"]);
export const SubscriptionStatusSchema = z.enum([
    "trialing", "active_demo", "past_due_demo", "cancel_scheduled", "cancelled", "expired", "suspended", "legacy_access",
]);
export const BillingPlanSchema = z.object({
    id: z.string().min(2).max(40),
    name: z.string().min(1).max(80),
    description: z.string().max(500),
    currency: z.string().regex(/^[A-Z]{3}$/),
    monthlyPriceMinor: z.number().int().nonnegative().nullable(),
    annualPriceMinor: z.number().int().nonnegative().nullable(),
    trialDays: z.number().int().min(0).max(90),
    features: z.record(z.string(), z.boolean()),
    limits: z.record(z.string(), z.number().int().min(-1)),
    public: z.boolean(),
    active: z.boolean(),
    sortOrder: z.number().int(),
    version: z.number().int().positive(),
    effectiveAt: z.string().datetime({ offset: true }),
}).strict();
export const BillingPlanRequestSchema = z.object({ planId: z.string().min(2).max(40), interval: BillingIntervalSchema, idempotencyKey: z.string().uuid() }).strict();
export const BillingCancelRequestSchema = z.object({ idempotencyKey: z.string().uuid(), reason: z.string().trim().max(500).default("") }).strict();
export const BillingSubscriptionSchema = z.object({
    workspaceId: z.string().uuid(), planId: z.string().min(2), planVersion: z.number().int().positive(),
    status: SubscriptionStatusSchema, interval: BillingIntervalSchema, periodStart: z.string().datetime({ offset: true }),
    periodEnd: z.string().datetime({ offset: true }), trialEndsAt: z.string().datetime({ offset: true }).nullable(),
    cancelAtPeriodEnd: z.boolean(), source: z.enum(["demo_simulation", "migration"]), legacyUntil: z.string().datetime({ offset: true }).nullable(),
}).strict();
export const BillingSummarySchema = z.object({
    mode: BillingModeSchema,
    subscription: BillingSubscriptionSchema,
    plan: BillingPlanSchema,
    features: z.record(z.string(), z.boolean()),
    limits: z.record(z.string(), z.number().int().min(-1)),
    usage: z.record(z.string(), z.number().nonnegative()),
    remaining: z.record(z.string(), z.number().nullable()),
    pendingChange: z.record(z.string(), z.unknown()).nullable(),
    notices: z.array(z.string()),
}).strict();
export const BillingChangeRequestSchema = z.object({
    id: z.string().uuid(), workspaceId: z.string().uuid(), requestedPlanId: z.string(), requestedVersion: z.number().int().positive(),
    interval: BillingIntervalSchema, status: z.enum(["pending", "activated_demo", "rejected", "cancelled"]),
    createdAt: z.string().datetime({ offset: true }),
}).strict();
//# sourceMappingURL=billing.js.map