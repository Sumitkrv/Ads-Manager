import { z } from "zod";
import { IndustryKeySchema, WorkspaceRoleSchema } from "./workspace.js";
export const CampaignPlatformSchema = z.enum(["google_ads", "meta_ads"]);
export const CampaignObjectiveSchema = z.enum([
    "website_traffic", "traffic", "lead_generation", "sales", "awareness", "engagement", "app_promotion",
]);
export const CampaignStatusSchema = z.enum([
    "draft", "generated_simulation", "needs_review", "changes_requested",
    "approved_for_demo", "demo_published", "archived",
]);
export const BudgetTypeSchema = z.enum(["daily", "lifetime"]);
export const BrandVoiceSchema = z.enum(["clear", "warm", "confident", "playful", "premium", "expert"]);
const httpUrl = z.string().trim().max(2048).url().refine((value) => {
    try {
        const url = new URL(value);
        return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    }
    catch {
        return false;
    }
}, "Use an http or https destination URL.");
export const CampaignBriefSchema = z.object({
    businessName: z.string().trim().min(1).max(120),
    industry: IndustryKeySchema,
    industryLabel: z.string().trim().max(100).nullable().default(null),
    productService: z.string().trim().min(1).max(240),
    businessDescription: z.string().trim().max(2000).default(""),
    offer: z.string().trim().max(300).default(""),
    landingPageUrl: httpUrl,
    uniqueSellingPoints: z.array(z.string().trim().min(1).max(180)).max(12).default([]),
    brandVoice: BrandVoiceSchema.default("clear"),
    preferredCta: z.string().trim().min(1).max(80),
    country: z.string().trim().min(2).max(80),
    regions: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    language: z.string().trim().min(2).max(60).default("English"),
    intendedCustomer: z.string().trim().min(1).max(300),
    audienceDescription: z.string().trim().max(1000).default(""),
    keywords: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    interestThemes: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    exclusions: z.array(z.string().trim().min(1).max(180)).max(50).default([]),
    budgetType: BudgetTypeSchema.default("daily"),
    budgetAmount: z.number().positive().max(10_000_000),
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
    startDate: z.string().date(),
    endDate: z.string().date().nullable().default(null),
    budgetRationale: z.string().trim().max(500).default(""),
    biddingPreference: z.enum(["maximize_clicks", "maximize_conversions", "manual_review"]).default("manual_review"),
    tone: BrandVoiceSchema.default("clear"),
    mainMessage: z.string().trim().max(500).default(""),
    promotionalHook: z.string().trim().max(300).default(""),
    brandAttributes: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
    copyStyle: z.enum(["concise", "story", "benefit_led"]).default("benefit_led"),
}).superRefine((brief, ctx) => {
    if (brief.endDate && brief.endDate < brief.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
    }
    if (brief.industry === "other" && !brief.industryLabel?.trim()) {
        ctx.addIssue({ code: "custom", path: ["industryLabel"], message: "Describe this custom industry." });
    }
});
export const KeywordSchema = z.object({ text: z.string().trim().min(1).max(100), matchType: z.enum(["broad", "phrase", "exact"]) });
export const SearchAdSchema = z.object({
    id: z.string().uuid(), headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
    descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(4), finalUrl: httpUrl,
});
export const GoogleAdGroupSchema = z.object({
    id: z.string().uuid(), name: z.string().trim().min(1).max(100),
    keywords: z.array(KeywordSchema).min(1).max(100), ads: z.array(SearchAdSchema).min(1).max(10),
});
export const MetaAdSchema = z.object({
    id: z.string().uuid(), primaryText: z.string().trim().min(1).max(2000),
    headline: z.string().trim().min(1).max(255), description: z.string().trim().max(500),
    cta: z.string().trim().min(1).max(80), destinationUrl: httpUrl, creativeReference: z.string().trim().max(500).nullable(),
});
export const MetaAdSetSchema = z.object({
    id: z.string().uuid(), name: z.string().trim().min(1).max(100), audience: z.string().trim().min(1).max(1000),
    locations: z.array(z.string().trim().min(1).max(100)).max(30), placements: z.array(z.enum(["feed", "stories", "reels", "automatic"])).min(1),
    budgetAmount: z.number().positive().max(10_000_000), budgetType: BudgetTypeSchema,
    ads: z.array(MetaAdSchema).min(1).max(10),
});
export const CampaignPlanSchema = z.object({
    platform: CampaignPlatformSchema,
    objective: CampaignObjectiveSchema,
    strategy: z.string().trim().min(1).max(1200),
    audienceSuggestions: z.array(z.string().trim().min(1).max(300)).max(20),
    creativeSuggestions: z.array(z.string().trim().min(1).max(300)).max(20),
    warnings: z.array(z.string().trim().min(1).max(400)).max(20),
    generation: z.object({ mode: z.enum(["simulation", "openai"]), label: z.enum(["AI Simulation", "AI Generated Draft"]), version: z.string(), seed: z.number().int(), generatedAt: z.string().datetime({ offset: true }), inputSnapshot: z.record(z.string(), z.unknown()), selectedVariations: z.array(z.number().int()), userModifications: z.array(z.string()) }),
    google: z.object({ adGroups: z.array(GoogleAdGroupSchema).min(1).max(30) }).optional(),
    meta: z.object({ adSets: z.array(MetaAdSetSchema).min(1).max(30) }).optional(),
}).superRefine((plan, ctx) => {
    const expectedGenerationLabel = plan.generation.mode === "openai" ? "AI Generated Draft" : "AI Simulation";
    if (plan.generation.label !== expectedGenerationLabel)
        ctx.addIssue({ code: "custom", path: ["generation", "label"], message: "Generation label must match its recorded source." });
    if (plan.platform === "google_ads" && !plan.google)
        ctx.addIssue({ code: "custom", path: ["google"], message: "Google Search draft structure is required." });
    if (plan.platform === "meta_ads" && !plan.meta)
        ctx.addIssue({ code: "custom", path: ["meta"], message: "Meta ad set draft structure is required." });
});
export const CampaignSummarySchema = z.object({
    id: z.string().uuid(), workspaceId: z.string().uuid(), name: z.string(), platform: CampaignPlatformSchema,
    objective: CampaignObjectiveSchema, status: CampaignStatusSchema, revision: z.number().int().positive(),
    approvedRevision: z.number().int().positive().nullable(), generatedAt: z.string().datetime({ offset: true }).nullable(),
    createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }),
    generationMode: z.enum(["none", "simulation", "openai"]).default("none"),
    executionMode: z.literal("demo"), publishedExternally: z.literal(false),
});
export const CampaignRecordSchema = CampaignSummarySchema.extend({ brief: CampaignBriefSchema, plan: CampaignPlanSchema.nullable() });
export const CampaignActivitySchema = z.object({ id: z.string().uuid(), event: z.string(), actorUserId: z.string().uuid().nullable(), details: z.record(z.string(), z.unknown()), createdAt: z.string().datetime({ offset: true }) });
export const CampaignListResponseSchema = z.object({ campaigns: z.array(CampaignSummarySchema), counts: z.record(CampaignStatusSchema, z.number().int().nonnegative()), page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative() });
export const CampaignResponseSchema = z.object({ campaign: CampaignRecordSchema });
export const CampaignWriteSchema = z.object({ name: z.string().trim().min(1).max(160), platform: CampaignPlatformSchema, objective: CampaignObjectiveSchema, brief: CampaignBriefSchema, plan: CampaignPlanSchema.nullable(), expectedRevision: z.number().int().positive().optional() }).strict().superRefine((value, ctx) => {
    const googleObjectives = ["website_traffic", "lead_generation", "sales", "awareness"];
    const metaObjectives = ["traffic", "lead_generation", "sales", "awareness", "engagement", "app_promotion"];
    if (value.platform === "google_ads" && !googleObjectives.includes(value.objective))
        ctx.addIssue({ code: "custom", path: ["objective"], message: "This objective is not in the supported Google Search draft profile." });
    if (value.platform === "meta_ads" && !metaObjectives.includes(value.objective))
        ctx.addIssue({ code: "custom", path: ["objective"], message: "This objective is not in the supported Meta draft profile." });
    if (value.plan && (value.plan.platform !== value.platform || value.plan.objective !== value.objective))
        ctx.addIssue({ code: "custom", path: ["plan"], message: "Campaign plan format and objective must match the campaign." });
});
export const CampaignListQuerySchema = z.object({ search: z.string().trim().max(120).default(""), status: CampaignStatusSchema.optional(), platform: CampaignPlatformSchema.optional(), sort: z.enum(["updated", "created", "name"]).default("updated"), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(12) });
export const CampaignActionResponseSchema = z.object({ status: z.string(), message: z.string(), campaign: CampaignRecordSchema.optional(), attempt: z.record(z.string(), z.unknown()).optional() });
export const CampaignIssueSchema = z.object({ severity: z.enum(["error", "warning", "information"]), code: z.string(), message: z.string(), field: z.string().nullable() });
export const CampaignValidationResponseSchema = z.object({ valid: z.boolean(), label: z.literal("Passes local draft validation"), providerVerified: z.literal(false), issues: z.array(CampaignIssueSchema) });
export const CampaignRoleSchema = WorkspaceRoleSchema;
//# sourceMappingURL=campaigns.js.map