import { z } from "zod";
import { IndustryKeySchema } from "./workspace.js";

export const TrackingProviderSchema = z.enum(["google_ads", "meta_ads", "ga4", "google_tag_manager", "meta_pixel", "google_ads_conversion"]);
export type TrackingProvider = z.infer<typeof TrackingProviderSchema>;
export const TrackingRecordStatusSchema = z.enum(["draft", "active", "archived"]);
export const TrackingGoalCategorySchema = z.enum(["lead", "sale", "engagement", "registration", "booking", "custom"]);
export const TrackingSourceTypeSchema = z.enum(["website", "mobile_app", "offline", "crm", "custom"]);
export const TrackingParameterTypeSchema = z.enum(["string", "number", "boolean"]);

export const TrackingProviderCatalogue = [
  { id: "google_ads", category: "advertising", name: "Google Ads", purpose: "Prepare advertising account requirements and conversion planning.", enabled: false },
  { id: "meta_ads", category: "advertising", name: "Meta Ads", purpose: "Prepare business portfolio and ad account requirements.", enabled: false },
  { id: "ga4", category: "measurement", name: "Google Analytics 4", purpose: "Plan events, key events and campaign attribution.", enabled: false },
  { id: "google_tag_manager", category: "measurement", name: "Google Tag Manager", purpose: "Document a proposed tag, trigger and consent implementation.", enabled: false },
  { id: "meta_pixel", category: "measurement", name: "Meta Pixel / Dataset", purpose: "Plan browser-side event mappings and consent review.", enabled: false },
  { id: "google_ads_conversion", category: "measurement", name: "Google Ads Conversion Tracking", purpose: "Document conversion action and offline implementation requirements.", enabled: false },
] as const;

export const ReadinessCategorySchema = z.enum(["business_information", "account_ownership", "advertising_permissions", "website_readiness", "conversion_plan", "billing_preparation", "policy_review"]);
export const READINESS_REQUIREMENTS = [
  { id: "business_details", category: "business_information", description: "Business identity and contact responsibilities have been documented.", required: true },
  { id: "account_owner", category: "account_ownership", description: "An authorized business owner for the ad account has been identified.", required: true },
  { id: "account_identifier", category: "account_ownership", description: "The account identifier has been recorded as planning metadata.", required: true },
  { id: "access_roles", category: "advertising_permissions", description: "Required business and advertising permissions have been reviewed.", required: true },
  { id: "website_destination", category: "website_readiness", description: "The campaign destination website is ready for review.", required: true },
  { id: "measurement_plan", category: "conversion_plan", description: "At least one conversion goal and proposed event mapping are documented.", required: true },
  { id: "billing_responsibility", category: "billing_preparation", description: "The responsible billing party and future payment setup are understood.", required: true },
  { id: "policy_review", category: "policy_review", description: "Applicable advertising policies and business verification needs are reviewed.", required: true },
] as const;

export const IntegrationConfigInputSchema = z.object({
  accountIdentifier: z.string().trim().max(120).default(""),
  businessLabel: z.string().trim().max(160).default(""),
  websiteUrl: z.string().trim().max(2048).default(""),
  notes: z.string().trim().max(1000).default(""),
}).strict().superRefine((value, ctx) => {
  if (/token|secret|password|cookie|session|credential/i.test(`${value.accountIdentifier} ${value.businessLabel} ${value.notes}`)) ctx.addIssue({ code: "custom", path: ["notes"], message: "Do not store credentials or secrets in integration planning." });
  if (value.websiteUrl) {
    try { const url = new URL(value.websiteUrl); if (url.protocol !== "https:") throw new Error(); }
    catch { ctx.addIssue({ code: "custom", path: ["websiteUrl"], message: "Enter a valid HTTPS website URL." }); }
  }
});

export const ReadinessResponseInputSchema = z.object({
  requirementId: z.string().min(1).max(80),
  completed: z.boolean(),
  note: z.string().trim().max(500).default(""),
}).strict().superRefine((value, ctx) => {
  if (/verified|confirmed by google|confirmed by meta|payment verified|pixel active/i.test(value.note)) ctx.addIssue({ code: "custom", path: ["note"], message: "Readiness notes cannot claim external verification." });
});

export const ConversionGoalInputSchema = z.object({
  name: z.string().trim().min(2).max(120), category: TrackingGoalCategorySchema,
  description: z.string().trim().max(1000).default(""), eventName: z.string().trim().min(2).max(64).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  objective: z.string().trim().max(240).default(""), illustrativeValue: z.number().finite().nonnegative().max(1_000_000_000).nullable().default(null),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().default(null), countingPolicy: z.enum(["once_per_event", "once_per_session", "once_per_user"]).default("once_per_event"),
  attributionNotes: z.string().trim().max(1000).default(""), status: TrackingRecordStatusSchema.default("draft"), industry: IndustryKeySchema.nullable().default(null),
}).strict().superRefine((value, ctx) => {
  if ((value.illustrativeValue !== null) !== (value.currency !== null)) ctx.addIssue({ code: "custom", path: ["currency"], message: "An illustrative value and currency must be supplied together." });
});

export const EventParameterSchema = z.object({ type: TrackingParameterTypeSchema, required: z.boolean(), description: z.string().max(240).default("") }).strict();
export const EventDefinitionInputSchema = z.object({
  eventKey: z.string().trim().min(2).max(64).regex(/^[A-Z][A-Z0-9_]*$/), displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""), triggerDefinition: z.string().trim().max(1000).default(""), sourceType: TrackingSourceTypeSchema,
  expectedParameters: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/), EventParameterSchema).default({}),
  deduplicationReference: z.string().trim().max(120).default(""), consentRequired: z.boolean().default(true), status: TrackingRecordStatusSchema.default("draft"),
}).strict().superRefine((value, ctx) => {
  if (Object.keys(value.expectedParameters).length > 30) ctx.addIssue({ code: "custom", path: ["expectedParameters"], message: "An event can define up to 30 parameters." });
});

export const EventMappingInputSchema = z.object({
  eventDefinitionId: z.string().uuid(), provider: TrackingProviderSchema, providerEventName: z.string().trim().min(2).max(100).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  parameterMap: z.record(z.string().max(40), z.string().max(40)).default({}), status: TrackingRecordStatusSchema.default("draft"), notes: z.string().trim().max(600).default(""),
}).strict();

export const UTMParameterSchema = z.object({ key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,39}$/), value: z.string().trim().min(1).max(160) }).strict();
export const UTMTemplateInputSchema = z.object({
  name: z.string().trim().min(2).max(120), destinationUrl: z.string().trim().min(8).max(2048),
  source: z.string().trim().min(1).max(100), medium: z.string().trim().min(1).max(100), campaign: z.string().trim().min(1).max(160),
  content: z.string().trim().max(160).default(""), term: z.string().trim().max(160).default(""), customParameters: z.array(UTMParameterSchema).max(10).default([]),
  replaceExisting: z.boolean().default(false), campaignId: z.string().uuid().nullable().default(null), goalId: z.string().uuid().nullable().default(null), status: TrackingRecordStatusSchema.default("active"),
}).strict().superRefine((value, ctx) => {
  let url: URL | null = null;
  try { url = new URL(value.destinationUrl); } catch { /* Report the URL field below. */ }
  if (!url || url.protocol !== "https:" || url.username || url.password) ctx.addIssue({ code: "custom", path: ["destinationUrl"], message: "Use a valid HTTPS destination without embedded credentials." });
  const parameters = [value.source, value.medium, value.campaign, value.content, value.term, ...value.customParameters.map((item) => item.value)];
  if (parameters.some((item) => /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(item) || /(?:\+?\d[\d ().-]{7,}\d)/.test(item))) ctx.addIssue({ code: "custom", path: ["customParameters"], message: "Do not place email addresses or phone numbers in tracking URLs." });
  const keys = value.customParameters.map((item) => item.key);
  if (new Set(keys).size !== keys.length || keys.some((key) => key.startsWith("utm_"))) ctx.addIssue({ code: "custom", path: ["customParameters"], message: "Custom parameter names must be unique and cannot replace reserved UTM fields." });
  if (url && !value.replaceExisting && ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].some((key) => url!.searchParams.has(key))) ctx.addIssue({ code: "custom", path: ["replaceExisting"], message: "The destination already has UTM values. Review and explicitly replace them." });
});

export const TrackingTestInputSchema = z.object({ goalId: z.string().uuid().nullable().default(null), eventDefinitionId: z.string().uuid(), parameters: z.record(z.string().max(40), z.union([z.string().max(200), z.number().finite(), z.boolean()])).default({}) }).strict().superRefine((value, ctx) => {
  if (Object.keys(value.parameters).length > 30 || JSON.stringify(value.parameters).length > 8_000) ctx.addIssue({ code: "custom", path: ["parameters"], message: "Synthetic event payload is too large." });
  if (Object.values(value.parameters).some((item) => typeof item === "string" && (/[@]/.test(item) || /\b\d{8,}\b/.test(item)))) ctx.addIssue({ code: "custom", path: ["parameters"], message: "Synthetic events must not contain email addresses or long personal identifiers." });
});

export const CampaignTrackingInputSchema = z.object({ campaignId: z.string().uuid(), goalId: z.string().uuid().nullable(), utmTemplateId: z.string().uuid().nullable(), notes: z.string().trim().max(600).default("") }).strict();

export const TrackingPrivacyChecklistSchema = z.object({ privacyNoticeReviewed: z.boolean(), consentPlanningReviewed: z.boolean(), jurisdictionReviewNeeded: z.boolean(), dataMinimizationReviewed: z.boolean(), sensitiveFieldsExcluded: z.boolean(), retentionReviewed: z.boolean(), thirdPartySharingReviewed: z.boolean() }).strict();
export const TrackingPlanInputSchema = z.object({
  name: z.string().trim().min(2).max(120), destinationWebsite: z.string().trim().url().max(2048), provider: TrackingProviderSchema,
  installationMethod: z.enum(["google_tag_ga4", "google_tag_manager", "meta_pixel", "google_ads_conversion_tag", "future_server_side"]),
  measurementIdentifier: z.string().trim().max(120).default(""), consentPrerequisites: z.string().trim().max(1000).default(""),
  testPlan: z.string().trim().max(2000).default(""), implementationOwnerLabel: z.string().trim().max(120).default(""),
  reviewStatus: z.enum(["draft", "internal_review", "client_review", "approved_for_future_implementation"]).default("draft"),
  privacyChecklist: TrackingPrivacyChecklistSchema.default({ privacyNoticeReviewed: false, consentPlanningReviewed: false, jurisdictionReviewNeeded: false, dataMinimizationReviewed: false, sensitiveFieldsExcluded: false, retentionReviewed: false, thirdPartySharingReviewed: false }),
}).strict().superRefine((value, ctx) => {
  try { const destination = new URL(value.destinationWebsite); if (destination.protocol !== "https:" || destination.username || destination.password) throw new Error(); }
  catch { ctx.addIssue({ code: "custom", path: ["destinationWebsite"], message: "Use a valid HTTPS destination without embedded credentials." }); }
  if (/token|secret|password|cookie|session|credential/i.test(`${value.measurementIdentifier} ${value.consentPrerequisites} ${value.testPlan}`)) ctx.addIssue({ code: "custom", path: ["measurementIdentifier"], message: "Do not store secrets or credentials in a tracking plan." });
});
export const TrackingPreferencesInputSchema = z.object({
  casing: z.enum(["lower", "upper", "preserve"]).default("lower"),
  separator: z.enum(["_", "-", "."]).default("_"),
  campaignFormat: z.string().trim().min(1).max(120).default("{campaign}_{channel}_{date}"),
  sourcePresets: z.array(z.string().trim().min(1).max(40)).max(12).default(["google", "meta", "linkedin"]),
  contentLabels: z.array(z.string().trim().min(1).max(40)).max(20).default(["image", "video", "headline"]),
  dateTokenFormat: z.enum(["yyyyMMdd", "yyyy-MM-dd", "MMM-yyyy"]).default("yyyyMMdd"),
}).strict().superRefine((value, ctx) => {
  if (/[{}]/.test(value.campaignFormat.replaceAll("{campaign}", "").replaceAll("{channel}", "").replaceAll("{date}", ""))) ctx.addIssue({ code: "custom", path: ["campaignFormat"], message: "Only {campaign}, {channel}, and {date} tokens are supported." });
  if (new Set(value.sourcePresets.map((item) => item.toLowerCase())).size !== value.sourcePresets.length) ctx.addIssue({ code: "custom", path: ["sourcePresets"], message: "Source presets must be unique." });
});

export const INDUSTRY_GOAL_PRESETS: Partial<Record<z.infer<typeof IndustryKeySchema>, { name: string; category: z.infer<typeof TrackingGoalCategorySchema>; eventName: string; objective: string }[]>> = {
  real_estate: [{ name: "Property inquiry", category: "lead", eventName: "PropertyInquiry", objective: "Qualify property interest" }, { name: "Site visit requested", category: "booking", eventName: "SiteVisitRequested", objective: "Arrange a property visit" }, { name: "Callback requested", category: "lead", eventName: "CallbackRequested", objective: "Follow up with a prospect" }],
  education_coaching: [{ name: "Course inquiry", category: "lead", eventName: "CourseInquiry", objective: "Capture course interest" }, { name: "Application started", category: "registration", eventName: "ApplicationStarted", objective: "Measure application intent" }],
  gyms_fitness: [{ name: "Trial class booked", category: "booking", eventName: "TrialClassBooked", objective: "Schedule a trial class" }, { name: "Membership inquiry", category: "lead", eventName: "MembershipInquiry", objective: "Capture membership interest" }],
  healthcare_clinics: [{ name: "Appointment requested", category: "booking", eventName: "AppointmentRequested", objective: "Request an appointment" }, { name: "Callback requested", category: "lead", eventName: "CallbackRequested", objective: "Request clinic follow-up" }],
  ecommerce_retail: [{ name: "View item", category: "engagement", eventName: "view_item", objective: "Measure product interest" }, { name: "Add to cart", category: "engagement", eventName: "add_to_cart", objective: "Measure cart intent" }, { name: "Begin checkout", category: "sale", eventName: "begin_checkout", objective: "Measure checkout intent" }, { name: "Purchase", category: "sale", eventName: "purchase", objective: "Measure completed purchase" }],
  automobile_dealerships: [{ name: "Test drive requested", category: "booking", eventName: "TestDriveRequested", objective: "Schedule a test drive" }, { name: "Brochure downloaded", category: "engagement", eventName: "BrochureDownloaded", objective: "Measure vehicle research" }],
  hotels_hospitality: [{ name: "Booking inquiry", category: "lead", eventName: "BookingInquiry", objective: "Capture booking interest" }, { name: "Reservation requested", category: "booking", eventName: "ReservationRequested", objective: "Request a reservation" }],
  marketing_agencies: [{ name: "Client lead submitted", category: "lead", eventName: "ClientLeadSubmitted", objective: "Measure client lead acquisition" }, { name: "Consultation booked", category: "booking", eventName: "ConsultationBooked", objective: "Schedule a consultation" }],
};

export function buildTrackingUrl(input: z.infer<typeof UTMTemplateInputSchema>): { url: string; warnings: string[] } {
  const valid = UTMTemplateInputSchema.parse(input);
  const url = new URL(valid.destinationUrl);
  const reserved = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  if (valid.replaceExisting) for (const key of reserved) url.searchParams.delete(key);
  const put = (key: string, value: string) => { if (value) url.searchParams.set(key, value); };
  put("utm_source", valid.source); put("utm_medium", valid.medium); put("utm_campaign", valid.campaign);
  put("utm_content", valid.content); put("utm_term", valid.term);
  for (const item of valid.customParameters) url.searchParams.set(item.key, item.value);
  const warnings = valid.replaceExisting && reserved.some((key) => new URL(valid.destinationUrl).searchParams.has(key)) ? ["Existing UTM values were explicitly replaced."] : [];
  return { url: url.toString(), warnings };
}

export function readinessScore(completedRequirementIds: ReadonlySet<string>): number {
  const required = READINESS_REQUIREMENTS.filter((requirement) => requirement.required);
  return Math.round((required.filter((requirement) => completedRequirementIds.has(requirement.id)).length / required.length) * 100);
}
