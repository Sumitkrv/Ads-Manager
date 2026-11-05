import { z } from "zod";
import { WorkspaceRoleSchema } from "./workspace.js";

export const ThemePreferenceSchema = z.enum(["light", "dark", "system"]);
export const UserNotificationPreferencesSchema = z.object({
  campaign_reviews: z.boolean(),
  creative_reviews: z.boolean(),
  automation_activity: z.boolean(),
  usage_limit_alerts: z.boolean(),
  subscription_events: z.boolean(),
  agency_collaboration: z.boolean(),
  client_approvals: z.boolean(),
  team_invitations: z.boolean(),
  support_cases: z.boolean(),
}).strict();

export const UserPreferencesSchema = z.object({
  themePreference: ThemePreferenceSchema,
  preferredLanguage: z.literal("en"),
  timezone: z.string().trim().min(1).max(100),
  dateFormat: z.enum(["local", "iso", "mdy", "dmy"]),
  timeFormat: z.enum(["12h", "24h"]),
  displayCurrency: z.string().regex(/^[A-Z]{3}$/),
  notifications: UserNotificationPreferencesSchema,
}).strict();

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  themePreference: "system",
  preferredLanguage: "en",
  timezone: "UTC",
  dateFormat: "local",
  timeFormat: "24h",
  displayCurrency: "USD",
  notifications: {
    campaign_reviews: true,
    creative_reviews: true,
    automation_activity: true,
    usage_limit_alerts: true,
    subscription_events: true,
    agency_collaboration: true,
    client_approvals: true,
    team_invitations: true,
    support_cases: true,
  },
};

export const UserPreferencesPatchSchema = UserPreferencesSchema.partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one preference to update.");

export const WorkspacePreferencesSchema = z.object({
  businessDescription: z.string().trim().max(1200),
  businessCategory: z.string().trim().max(120),
  operatingRegion: z.string().trim().max(120),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  defaultLandingPage: z.enum(["overview", "campaigns", "analytics", "reports"]),
  defaultCampaignFormat: z.enum(["google_search", "meta_social", "mixed"]),
  defaultReportDateRange: z.enum(["7d", "30d", "90d"]),
  defaultMarketingObjective: z.enum(["leads", "sales", "traffic", "awareness", "engagement"]),
  displayDensity: z.enum(["comfortable", "compact"]),
}).strict();

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  businessDescription: "",
  businessCategory: "",
  operatingRegion: "",
  defaultCurrency: "USD",
  defaultLandingPage: "overview",
  defaultCampaignFormat: "google_search",
  defaultReportDateRange: "30d",
  defaultMarketingObjective: "leads",
  displayDensity: "comfortable",
};

export const WorkspacePreferencesPatchSchema = WorkspacePreferencesSchema.partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one workspace default to update.");

export const WorkspaceTeamMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string().nullable(),
  email: z.string().email().nullable(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().url().nullable(),
  role: WorkspaceRoleSchema,
  joinedAt: z.string().datetime({ offset: true }),
}).strict();

export const WorkspaceInvitationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  relationshipId: z.string().uuid().nullable(),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  status: z.enum(["pending", "accepted", "declined", "revoked", "expired"]),
  createdBy: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export const WorkspaceTeamResponseSchema = z.object({
  members: z.array(WorkspaceTeamMemberSchema),
  invitations: z.array(WorkspaceInvitationSchema),
  role: WorkspaceRoleSchema,
  emailDelivery: z.literal("not_emailed"),
}).strict();

export const WorkspaceInvitationCreateSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["admin", "editor", "viewer"]),
}).strict();

export const WorkspaceMemberRolePatchSchema = z.object({ role: z.enum(["admin", "editor", "viewer"]) }).strict();

export const WorkspaceSettingsAuditSchema = z.object({
  id: z.string().uuid(),
  action: z.string().min(1).max(64),
  targetUserId: z.string().uuid().nullable(),
  changedFields: z.array(z.string().max(64)),
  actorUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export const ClosureRequestResponseSchema = z.object({
  request: z.object({
    id: z.string().uuid(),
    scope: z.enum(["account", "workspace"]),
    status: z.literal("pending_review"),
    createdAt: z.string().datetime({ offset: true }),
  }).strict(),
  message: z.literal("Request recorded for administrative review. No data was deleted."),
}).strict();

export type ThemePreferenceValue = z.infer<typeof ThemePreferenceSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserPreferencesPatch = z.infer<typeof UserPreferencesPatchSchema>;
export type WorkspacePreferences = z.infer<typeof WorkspacePreferencesSchema>;
export type WorkspacePreferencesPatch = z.infer<typeof WorkspacePreferencesPatchSchema>;
export type WorkspaceTeamResponse = z.infer<typeof WorkspaceTeamResponseSchema>;
export type WorkspaceInvitationCreateInput = z.infer<typeof WorkspaceInvitationCreateSchema>;
