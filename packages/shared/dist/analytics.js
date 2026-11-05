import { z } from "zod";
import { CampaignObjectiveSchema, CampaignPlatformSchema, CampaignStatusSchema } from "./campaigns.js";
import { IndustryKeySchema } from "./workspace.js";
export const AnalyticsMetricSchema = z.enum(["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "conversions", "conversion_rate", "cpa", "roas"]);
export const AnalyticsDatePresetSchema = z.enum(["today", "yesterday", "last_7_days", "last_14_days", "last_30_days", "last_90_days", "this_month", "last_month", "custom"]);
export const AnalyticsDimensionSchema = z.enum(["campaign", "platform", "objective", "industry", "currency", "scenario", "date"]);
export const ReportTypeSchema = z.enum([
    "executive_overview", "campaign_performance", "platform_comparison", "creative_analysis",
    "budget_efficiency", "performance_trends", "custom", "google_search", "meta_campaign",
]);
export const ReportSectionTypeSchema = z.enum(["heading", "kpi_summary", "chart", "table", "comparison", "notes", "methodology"]);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const OptionalBoundedText = z.string().trim().max(300).optional();
export const AnalyticsFilterSchema = z.object({
    preset: AnalyticsDatePresetSchema.default("last_30_days"),
    from: DateSchema.optional(),
    to: DateSchema.optional(),
    platform: z.union([z.literal("all"), CampaignPlatformSchema]).default("all"),
    campaignId: z.string().uuid().optional(),
    objective: CampaignObjectiveSchema.optional(),
    status: CampaignStatusSchema.optional(),
    industry: IndustryKeySchema.optional(),
    scenario: z.enum(["low", "average", "high", "gradual_improvement", "decline"]).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    comparePrevious: z.boolean().default(false),
}).strict().superRefine((value, context) => {
    if (value.preset === "custom" && (!value.from || !value.to)) {
        context.addIssue({ code: "custom", path: ["from"], message: "Choose both dates for a custom range." });
    }
    if (value.from && value.to && value.from > value.to) {
        context.addIssue({ code: "custom", path: ["to"], message: "The end date must be on or after the start date." });
    }
});
export const AnalyticsSavedViewInputSchema = z.object({
    name: z.string().trim().min(1).max(100),
    filters: AnalyticsFilterSchema,
    visibleColumns: z.array(z.enum(["campaign", "platform", "objective", "status", "currency", "spend", "impressions", "clicks", "ctr", "cpc", "cpm", "conversions", "cpa", "roas"])).min(1).max(20),
    sort: z.enum(["spend", "impressions", "clicks", "ctr", "campaign", "updated"]).default("spend"),
    expectedVersion: z.number().int().positive().optional(),
}).strict();
export const ReportSectionSchema = z.object({
    id: z.string().uuid(),
    type: ReportSectionTypeSchema,
    title: z.string().trim().max(120).default(""),
    metric: AnalyticsMetricSchema.optional(),
    dimension: AnalyticsDimensionSchema.optional(),
    content: z.string().trim().max(4000).optional(),
}).strict();
export const ReportDefinitionInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(""),
    reportType: ReportTypeSchema,
    filters: AnalyticsFilterSchema,
    metrics: z.array(AnalyticsMetricSchema).min(1).max(10),
    dimensions: z.array(AnalyticsDimensionSchema).max(7),
    sections: z.array(ReportSectionSchema).min(1).max(20),
    dateRangePolicy: z.object({
        kind: z.enum(["fixed", "rolling"]).default("rolling"),
        preset: AnalyticsDatePresetSchema.default("last_30_days"),
        from: DateSchema.optional(),
        to: DateSchema.optional(),
        schedulePreference: z.enum(["daily", "weekly", "monthly"]).nullable().default(null),
    }).strict(),
    expectedVersion: z.number().int().positive().optional(),
}).strict().superRefine((value, context) => {
    if (value.dateRangePolicy.kind === "fixed" && (!value.dateRangePolicy.from || !value.dateRangePolicy.to)) {
        context.addIssue({ code: "custom", path: ["dateRangePolicy", "from"], message: "A fixed date range needs both dates." });
    }
    if (value.dateRangePolicy.from && value.dateRangePolicy.to && value.dateRangePolicy.from > value.dateRangePolicy.to) {
        context.addIssue({ code: "custom", path: ["dateRangePolicy", "to"], message: "The end date must be on or after the start date." });
    }
});
export const ReportDuplicateInputSchema = z.object({ name: OptionalBoundedText }).strict();
export const ReportExportInputSchema = z.object({ format: z.enum(["csv", "pdf"]) }).strict();
export const ReportArchiveInputSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
//# sourceMappingURL=analytics.js.map