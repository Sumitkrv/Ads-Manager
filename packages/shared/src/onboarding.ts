import { z } from "zod";

export const OnboardingPathSchema = z.enum(["business", "agency", "join"]);
export const OnboardingBudgetRangeSchema = z.enum(["under_500", "500_2000", "2000_5000", "5000_plus", "not_sure"]);
export const OnboardingPlatformSchema = z.enum(["google_ads", "meta_ads"]);
export const OnboardingGoalSchema = z.enum(["website_traffic", "lead_generation", "sales", "awareness", "engagement", "app_promotion"]);
export const OnboardingToneSchema = z.enum(["clear", "warm", "confident", "playful", "premium", "expert"]);
export const OnboardingSetupDataSchema = z.object({
  businessDescription: z.string().trim().max(2000).optional(),
  primaryRegion: z.string().trim().max(200).optional(),
  mainOffering: z.string().trim().max(240).optional(),
  marketingObjective: z.string().trim().max(240).optional(),
  campaignGoal: OnboardingGoalSchema.optional(),
  platformFormat: OnboardingPlatformSchema.optional(),
  budgetRange: OnboardingBudgetRangeSchema.optional(),
  audience: z.string().trim().max(500).optional(),
  brandTone: OnboardingToneSchema.optional(),
  ctaPreference: z.enum(["direct", "warm", "minimal", "confident", "custom"]).optional(),
}).strict();

export const UserOnboardingPreferencesInputSchema = z.object({
  setupPath: OnboardingPathSchema,
  draft: OnboardingSetupDataSchema.extend({
    businessName: z.string().trim().max(120).optional(),
    industryKey: z.string().trim().max(40).optional(),
    industryCustomLabel: z.string().trim().max(100).optional(),
    websiteUrl: z.string().trim().max(2048).optional(),
    countryCode: z.string().trim().max(2).optional(),
    timezone: z.string().trim().max(100).optional(),
    currentStep: z.number().int().min(0).max(6).optional(),
    requestId: z.string().uuid().optional(),
    createdWorkspaceId: z.string().uuid().optional(),
  }).strict(),
}).strict();

export const WorkspaceOnboardingPatchSchema = z.object({
  setupData: OnboardingSetupDataSchema,
  currentStep: z.number().int().min(0).max(6),
  lastCompletedStep: z.number().int().min(-1).max(6),
}).strict().refine((value) => value.lastCompletedStep <= value.currentStep, {
  path: ["lastCompletedStep"], message: "Completed setup steps cannot be ahead of the current step.",
});

export const UserOnboardingPreferencesSchema = z.object({
  setupPath: OnboardingPathSchema,
  draft: UserOnboardingPreferencesInputSchema.shape.draft,
  updatedAt: z.string().datetime({ offset: true }).nullable(),
});

export const WorkspaceOnboardingStateSchema = z.object({
  workspaceId: z.string().uuid(),
  setupData: OnboardingSetupDataSchema,
  currentStep: z.number().int().min(0).max(6),
  lastCompletedStep: z.number().int().min(-1).max(6),
  startedAt: z.string().datetime({ offset: true }),
  lastActiveAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  updatedAt: z.string().datetime({ offset: true }),
  version: z.number().int().positive(),
});

export const ActivationItemSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(320),
  required: z.boolean(),
  completed: z.boolean(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  href: z.string().startsWith("/"),
  guidance: z.string().max(320).optional(),
});

export const WorkspaceActivationResponseSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceName: z.string(),
  industryKey: z.string(),
  role: z.enum(["owner", "admin", "editor", "viewer"]),
  items: z.array(ActivationItemSchema).max(20),
  completed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  percent: z.number().int().min(0).max(100),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  subscription: z.object({ status: z.string().nullable(), plan: z.string().nullable() }).optional(),
});

export const ProductTourProgressSchema = z.object({
  tourId: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  workspaceId: z.string().uuid(),
  stepIndex: z.number().int().min(0).max(40),
  status: z.enum(["running", "skipped", "completed"]),
}).strict();

export const ProductTourProgressListSchema = z.object({ progress: z.array(z.object({
  tourId: z.string(), workspaceId: z.string().uuid(), stepIndex: z.number().int(), status: z.enum(["running", "skipped", "completed"]),
  startedAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }).nullable(),
})), });

export const RecordOnboardingEventSchema = z.object({
  eventKey: z.enum(["demo_mode_reviewed", "report_viewed"]),
}).strict();

export const OnboardingApiResponseSchema = z.object({ preferences: UserOnboardingPreferencesSchema.nullable() });
export const WorkspaceOnboardingApiResponseSchema = z.object({ onboarding: WorkspaceOnboardingStateSchema.nullable() });
export const ProductTourProgressApiResponseSchema = z.object({ progress: ProductTourProgressListSchema.shape.progress });

export const PlatformTourProgressInputSchema = z.object({
  tourId: z.literal("platform-operator"),
  stepIndex: z.number().int().min(0).max(8),
  status: z.enum(["running", "skipped", "completed"]),
}).strict();

export const PlatformTourProgressStateSchema = z.object({
  tourId: z.literal("platform-operator"),
  stepIndex: z.number().int().min(0).max(8),
  status: z.enum(["running", "skipped", "completed"]),
  startedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
});

export const PlatformTourProgressApiResponseSchema = z.object({ progress: PlatformTourProgressStateSchema.nullable() });
export const RecordOnboardingEventResponseSchema = z.object({ recorded: z.boolean() });

export type PlatformTourProgressInput = z.infer<typeof PlatformTourProgressInputSchema>;
export type PlatformTourProgressState = z.infer<typeof PlatformTourProgressStateSchema>;

export const INDUSTRY_ONBOARDING_GUIDANCE: Record<string, { goal: string; example: string; care?: string }> = {
  real_estate: { goal: "Promote a property or invite local enquiries.", example: "A neighborhood-focused property viewing campaign." },
  ecommerce_retail: { goal: "Plan product discovery or a sales campaign.", example: "A seasonal product collection promotion." },
  healthcare_clinics: { goal: "Share factual appointment information.", example: "An appointment availability campaign.", care: "Keep claims factual and avoid personal health details or guaranteed outcomes." },
  education_coaching: { goal: "Invite interest in a course or admissions period.", example: "A course registration campaign." },
  gyms_fitness: { goal: "Promote a membership or introductory class.", example: "A trial class invitation." },
  restaurants_cafes: { goal: "Reach nearby diners or encourage reservations.", example: "A local dining promotion." },
  hotels_hospitality: { goal: "Share stay and booking information.", example: "A seasonal booking promotion." },
  travel_tourism: { goal: "Invite enquiries about a trip or package.", example: "A tour package information campaign." },
  automobile_dealerships: { goal: "Invite test-drive or service enquiries.", example: "A vehicle test-drive campaign." },
  salons_beauty: { goal: "Promote appointments or a service menu.", example: "A new service availability campaign." },
  professional_services: { goal: "Explain a service and invite a consultation.", example: "A consultation enquiry campaign." },
  marketing_agencies: { goal: "Build your agency workspace and collaboration process.", example: "An agency brand and client-workflow setup." },
  home_services: { goal: "Reach local customers seeking a service.", example: "A seasonal maintenance enquiry campaign." },
  finance_insurance: { goal: "Share clear service information and invite a consultation.", example: "A product-information campaign.", care: "Avoid guaranteed returns, savings or coverage claims." },
  events_entertainment: { goal: "Promote an event or invite registrations.", example: "An upcoming event registration campaign." },
  other: { goal: "Choose a clear offer and audience that fit your business.", example: "A simple awareness or enquiry campaign." },
};

export type OnboardingPath = z.infer<typeof OnboardingPathSchema>;
export type OnboardingSetupData = z.infer<typeof OnboardingSetupDataSchema>;
export type UserOnboardingPreferencesInput = z.infer<typeof UserOnboardingPreferencesInputSchema>;
export type WorkspaceActivationResponse = z.infer<typeof WorkspaceActivationResponseSchema>;
