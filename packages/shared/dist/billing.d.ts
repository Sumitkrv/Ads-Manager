import { z } from "zod";
export declare const BillingModeSchema: z.ZodLiteral<"simulation">;
export declare const BillingIntervalSchema: z.ZodEnum<{
    monthly: "monthly";
    annual: "annual";
}>;
export declare const SubscriptionStatusSchema: z.ZodEnum<{
    cancelled: "cancelled";
    trialing: "trialing";
    active_demo: "active_demo";
    past_due_demo: "past_due_demo";
    cancel_scheduled: "cancel_scheduled";
    expired: "expired";
    suspended: "suspended";
    legacy_access: "legacy_access";
}>;
export declare const BillingPlanSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    currency: z.ZodString;
    monthlyPriceMinor: z.ZodNullable<z.ZodNumber>;
    annualPriceMinor: z.ZodNullable<z.ZodNumber>;
    trialDays: z.ZodNumber;
    features: z.ZodRecord<z.ZodString, z.ZodBoolean>;
    limits: z.ZodRecord<z.ZodString, z.ZodNumber>;
    public: z.ZodBoolean;
    active: z.ZodBoolean;
    sortOrder: z.ZodNumber;
    version: z.ZodNumber;
    effectiveAt: z.ZodString;
}, z.core.$strict>;
export declare const BillingPlanRequestSchema: z.ZodObject<{
    planId: z.ZodString;
    interval: z.ZodEnum<{
        monthly: "monthly";
        annual: "annual";
    }>;
    idempotencyKey: z.ZodString;
}, z.core.$strict>;
export declare const BillingCancelRequestSchema: z.ZodObject<{
    idempotencyKey: z.ZodString;
    reason: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const BillingSubscriptionSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    planId: z.ZodString;
    planVersion: z.ZodNumber;
    status: z.ZodEnum<{
        cancelled: "cancelled";
        trialing: "trialing";
        active_demo: "active_demo";
        past_due_demo: "past_due_demo";
        cancel_scheduled: "cancel_scheduled";
        expired: "expired";
        suspended: "suspended";
        legacy_access: "legacy_access";
    }>;
    interval: z.ZodEnum<{
        monthly: "monthly";
        annual: "annual";
    }>;
    periodStart: z.ZodString;
    periodEnd: z.ZodString;
    trialEndsAt: z.ZodNullable<z.ZodString>;
    cancelAtPeriodEnd: z.ZodBoolean;
    source: z.ZodEnum<{
        demo_simulation: "demo_simulation";
        migration: "migration";
    }>;
    legacyUntil: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export declare const BillingSummarySchema: z.ZodObject<{
    mode: z.ZodLiteral<"simulation">;
    subscription: z.ZodObject<{
        workspaceId: z.ZodString;
        planId: z.ZodString;
        planVersion: z.ZodNumber;
        status: z.ZodEnum<{
            cancelled: "cancelled";
            trialing: "trialing";
            active_demo: "active_demo";
            past_due_demo: "past_due_demo";
            cancel_scheduled: "cancel_scheduled";
            expired: "expired";
            suspended: "suspended";
            legacy_access: "legacy_access";
        }>;
        interval: z.ZodEnum<{
            monthly: "monthly";
            annual: "annual";
        }>;
        periodStart: z.ZodString;
        periodEnd: z.ZodString;
        trialEndsAt: z.ZodNullable<z.ZodString>;
        cancelAtPeriodEnd: z.ZodBoolean;
        source: z.ZodEnum<{
            demo_simulation: "demo_simulation";
            migration: "migration";
        }>;
        legacyUntil: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
    plan: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        currency: z.ZodString;
        monthlyPriceMinor: z.ZodNullable<z.ZodNumber>;
        annualPriceMinor: z.ZodNullable<z.ZodNumber>;
        trialDays: z.ZodNumber;
        features: z.ZodRecord<z.ZodString, z.ZodBoolean>;
        limits: z.ZodRecord<z.ZodString, z.ZodNumber>;
        public: z.ZodBoolean;
        active: z.ZodBoolean;
        sortOrder: z.ZodNumber;
        version: z.ZodNumber;
        effectiveAt: z.ZodString;
    }, z.core.$strict>;
    features: z.ZodRecord<z.ZodString, z.ZodBoolean>;
    limits: z.ZodRecord<z.ZodString, z.ZodNumber>;
    usage: z.ZodRecord<z.ZodString, z.ZodNumber>;
    remaining: z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodNumber>>;
    pendingChange: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    notices: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const BillingChangeRequestSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    requestedPlanId: z.ZodString;
    requestedVersion: z.ZodNumber;
    interval: z.ZodEnum<{
        monthly: "monthly";
        annual: "annual";
    }>;
    status: z.ZodEnum<{
        pending: "pending";
        cancelled: "cancelled";
        activated_demo: "activated_demo";
        rejected: "rejected";
    }>;
    createdAt: z.ZodString;
}, z.core.$strict>;
export type BillingPlan = z.infer<typeof BillingPlanSchema>;
export type BillingSummary = z.infer<typeof BillingSummarySchema>;
//# sourceMappingURL=billing.d.ts.map