import { z } from "zod";
export * from "./auth.js";
export * from "./workspace.js";
export * from "./settings.js";
export * from "./advertising-integrations.js";
export * from "./campaigns.js";
export * from "./creatives.js";
export * from "./optimization.js";
export * from "./analytics.js";
export * from "./agency.js";
export * from "./billing.js";
export * from "./onboarding.js";
export * from "./tracking.js";
export const HealthResponseSchema = z.object({
    status: z.literal("ok"),
    service: z.literal("ai-ads-api"),
    version: z.string().min(1),
    timestamp: z.string().datetime(),
});
export const ApiErrorResponseSchema = z.object({
    status: z.literal("error"),
    error: z.object({
        code: z.string().min(1),
        message: z.string().min(1),
    }),
});
//# sourceMappingURL=index.js.map