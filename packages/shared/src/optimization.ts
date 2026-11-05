import { z } from "zod";
import { CampaignPlatformSchema } from "./campaigns.js";
import { IndustryKeySchema } from "./workspace.js";

export const OptimizationMetricSchema = z.object({
  impressions: z.number().int().nonnegative(), clicks: z.number().int().nonnegative(),
  conversions: z.number().nonnegative(), spend: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/),
  ctr: z.number().nonnegative().nullable(), cpc: z.number().nonnegative().nullable(),
  cpm: z.number().nonnegative().nullable(), cpa: z.number().nonnegative().nullable(),
  roas: z.number().nonnegative().nullable(), conversionRate: z.number().nonnegative().nullable(),
  budgetUtilization: z.number().nonnegative().nullable(), days: z.number().int().nonnegative(),
  simulatedAt: z.string().datetime({ offset: true }),
  label: z.literal("Simulated Data — Not Actual Ad Performance"),
});

export const OptimizationRecommendationStatusSchema = z.enum([
  "new", "reviewed", "approved", "rejected", "applied_to_demo", "dismissed", "superseded",
]);
export const OptimizationRecommendationSchema = z.object({
  id: z.string().uuid(), workspaceId: z.string().uuid(), campaignId: z.string().uuid(),
  campaignName: z.string(), campaignRevision: z.number().int().positive(), platform: CampaignPlatformSchema,
  category: z.enum(["budget", "creative", "audience", "targeting", "schedule", "keyword_structure", "performance_trend", "campaign_configuration"]),
  priority: z.enum(["low", "medium", "high", "critical"]), type: z.string().min(1).max(80),
  status: OptimizationRecommendationStatusSchema, title: z.string().min(1).max(160),
  detected: z.string().min(1).max(800), evidence: z.record(z.string(), z.unknown()),
  proposedAction: z.record(z.string(), z.unknown()), tradeoffs: z.array(z.string().max(500)).max(12),
  evidenceLimitations: z.array(z.string().max(500)).max(12), confidence: z.enum(["low", "medium", "high"]),
  version: z.number().int().positive(), createdAt: z.string().datetime({ offset: true }),
});
export const OptimizationRecommendationsResponseSchema = z.object({ recommendations: z.array(OptimizationRecommendationSchema), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() });
export const RecommendationDecisionSchema = z.object({ action: z.enum(["review", "approve", "reject", "dismiss", "apply_demo"]), expectedVersion: z.number().int().positive(), comments: z.string().trim().max(2000).default("") }).strict();

export const BudgetScenarioInputSchema = z.object({
  campaignId: z.string().uuid(), name: z.string().trim().min(1).max(120),
  adjustment: z.enum(["absolute", "percentage"]), proposedBudget: z.number().finite().min(-90).max(10_000_000),
}).strict().superRefine((input, context) => {
  if (input.adjustment === "absolute" && input.proposedBudget <= 0) {
    context.addIssue({ code: "custom", path: ["proposedBudget"], message: "An absolute budget must be positive." });
  }
  if (input.adjustment === "percentage" && input.proposedBudget > 500) {
    context.addIssue({ code: "custom", path: ["proposedBudget"], message: "Percentage adjustments must be 500% or less." });
  }
});
export const BudgetScenarioSchema = z.object({
  id: z.string().uuid(), workspaceId: z.string().uuid(), campaignId: z.string().uuid(), campaignName: z.string(),
  campaignRevision: z.number().int().positive(), version: z.number().int().positive(), name: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/), budgetType: z.enum(["daily", "lifetime"]),
  currentBudget: z.number().positive(), proposedBudget: z.number().positive(), adjustment: z.enum(["absolute", "percentage"]),
  baseline: OptimizationMetricSchema.nullable(), projection: OptimizationMetricSchema.nullable(),
  assumptions: z.array(z.string()), status: z.enum(["draft", "needs_approval", "approved", "rejected", "applied", "stale"]),
  createdAt: z.string().datetime({ offset: true }), approvedAt: z.string().datetime({ offset: true }).nullable(), appliedAt: z.string().datetime({ offset: true }).nullable(),
});
export const BudgetScenariosResponseSchema = z.object({ scenarios: z.array(BudgetScenarioSchema) });

export const AutomationConditionSchema = z.object({
  metric: z.enum(["ctr", "cpc", "cpm", "cpa", "roas", "conversions", "spend", "impressions", "clicks", "budget_utilization"]),
  operator: z.enum(["lt", "lte", "eq", "gte", "gt"]),
  threshold: z.number().finite().min(0).max(10_000_000),
});
export const AutomationRuleDefinitionSchema = z.object({
  version: z.literal(1), trigger: z.literal("manual"),
  conditionLogic: z.enum(["all", "any"]), conditions: z.array(AutomationConditionSchema).min(1).max(8),
  action: z.enum(["create_recommendation", "create_review_task", "flag_campaign", "propose_demo_budget", "suggest_creative_variation", "append_activity"]),
  approvalRequired: z.boolean(), industry: IndustryKeySchema.nullable().default(null),
  budgetAdjustmentPercent: z.number().positive().max(50).optional(),
}).strict().superRefine((rule, context) => {
  if (rule.action === "propose_demo_budget" && rule.budgetAdjustmentPercent === undefined) {
    context.addIssue({ code: "custom", path: ["budgetAdjustmentPercent"], message: "A demo budget adjustment percent is required for this action." });
  }
  if (rule.action !== "append_activity" && !rule.approvalRequired) {
    context.addIssue({ code: "custom", path: ["approvalRequired"], message: "Workspace actions require owner/admin approval." });
  }
});
export const AutomationRuleInputSchema = z.object({ name: z.string().trim().min(1).max(120), definition: AutomationRuleDefinitionSchema, enabled: z.boolean().default(false), expectedVersion: z.number().int().positive().optional() }).strict();
export const AutomationRuleSchema = z.object({ id: z.string().uuid(), workspaceId: z.string().uuid(), name: z.string(), definition: AutomationRuleDefinitionSchema, version: z.number().int().positive(), enabled: z.boolean(), createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }) });
export const AutomationRulesResponseSchema = z.object({ rules: z.array(AutomationRuleSchema) });
export const AutomationRunInputSchema = z.object({ campaignId: z.string().uuid(), idempotencyKey: z.string().uuid(), previewOnly: z.boolean().default(false) }).strict();
export const AutomationExecutionSchema = z.object({ id: z.string().uuid(), workspaceId: z.string().uuid(), ruleId: z.string().uuid(), campaignId: z.string().uuid(), ruleVersion: z.number().int().positive(), trigger: z.string(), matched: z.boolean(), result: z.enum(["evaluated", "awaiting_approval", "approved", "rejected", "applied", "failed", "skipped"]), inputSnapshot: z.record(z.string(), z.unknown()), actionProposal: z.record(z.string(), z.unknown()).nullable(), errorCode: z.string().nullable(), createdAt: z.string().datetime({ offset: true }) });
export const AutomationExecutionsResponseSchema = z.object({ executions: z.array(AutomationExecutionSchema), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() });
export const AutomationExecutionDecisionSchema = z.object({ decision: z.enum(["approve", "reject", "apply"]), expectedVersion: z.number().int().positive(), expectedRuleVersion: z.number().int().positive(), comments: z.string().trim().max(2000).default("") }).strict();

export const WorkspaceNotificationSchema = z.object({ id: z.string().uuid(), workspaceId: z.string().uuid(), campaignId: z.string().uuid().nullable(), notificationType: z.enum(["optimization_opportunity", "rule_execution", "rule_failed", "approval_required", "recommendation_decision", "campaign_review", "demo_threshold"]), title: z.string(), body: z.string(), href: z.string().nullable(), readAt: z.string().datetime({ offset: true }).nullable(), dismissedAt: z.string().datetime({ offset: true }).nullable(), createdAt: z.string().datetime({ offset: true }) });
export const NotificationsResponseSchema = z.object({ notifications: z.array(WorkspaceNotificationSchema), total: z.number().int().nonnegative(), unread: z.number().int().nonnegative() });
export const NotificationUpdateSchema = z.object({ action: z.enum(["read", "unread", "dismiss"]) }).strict();

export type OptimizationMetric = z.infer<typeof OptimizationMetricSchema>;
export type OptimizationRecommendation = z.infer<typeof OptimizationRecommendationSchema>;
export type BudgetScenario = z.infer<typeof BudgetScenarioSchema>;
export type AutomationRuleDefinition = z.infer<typeof AutomationRuleDefinitionSchema>;
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
export type AutomationExecution = z.infer<typeof AutomationExecutionSchema>;
