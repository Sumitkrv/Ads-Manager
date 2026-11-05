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
export declare const HealthResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ok">;
    service: z.ZodLiteral<"ai-ads-api">;
    version: z.ZodString;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export declare const ApiErrorResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"error">;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
//# sourceMappingURL=index.d.ts.map