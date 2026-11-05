import { z } from "zod";

export const INDUSTRY_KEYS = [
  "real_estate",
  "ecommerce_retail",
  "healthcare_clinics",
  "education_coaching",
  "gyms_fitness",
  "restaurants_cafes",
  "hotels_hospitality",
  "travel_tourism",
  "automobile_dealerships",
  "salons_beauty",
  "professional_services",
  "marketing_agencies",
  "home_services",
  "finance_insurance",
  "events_entertainment",
  "other",
] as const;

export const IndustryKeySchema = z.enum(INDUSTRY_KEYS);
export type IndustryKey = z.infer<typeof IndustryKeySchema>;

export const INDUSTRIES = [
  { key: "real_estate", name: "Real Estate & Property", description: "Property developers, brokerages, property managers and local real estate teams.", icon: "home" },
  { key: "ecommerce_retail", name: "E-commerce & Retail", description: "Online stores, product brands and local retailers.", icon: "bag" },
  { key: "healthcare_clinics", name: "Healthcare & Clinics", description: "Clinics and healthcare providers with responsible patient outreach.", icon: "health" },
  { key: "education_coaching", name: "Education & Coaching", description: "Schools, educators, training providers and coaches.", icon: "education" },
  { key: "gyms_fitness", name: "Gyms & Fitness", description: "Gyms, studios, personal trainers and wellness businesses.", icon: "fitness" },
  { key: "restaurants_cafes", name: "Restaurants & Cafes", description: "Restaurants, cafes, food brands and local dining.", icon: "dining" },
  { key: "hotels_hospitality", name: "Hotels & Hospitality", description: "Hotels, stays, venues and hospitality operators.", icon: "hospitality" },
  { key: "travel_tourism", name: "Travel & Tourism", description: "Travel operators, destinations and experience providers.", icon: "travel" },
  { key: "automobile_dealerships", name: "Automobile & Dealerships", description: "Vehicle dealers, service centers and mobility brands.", icon: "auto" },
  { key: "salons_beauty", name: "Salons & Beauty", description: "Salons, spas, beauty professionals and personal care brands.", icon: "beauty" },
  { key: "professional_services", name: "Professional Services", description: "Consultancies and specialist business-to-business services.", icon: "services" },
  { key: "marketing_agencies", name: "Marketing & Advertising Agencies", description: "Agencies managing their own business and future client workspaces.", icon: "agency" },
  { key: "home_services", name: "Home Services", description: "Home repair, maintenance, renovation and local service businesses.", icon: "tools" },
  { key: "finance_insurance", name: "Finance & Insurance", description: "Financial and insurance providers with compliant communications.", icon: "finance" },
  { key: "events_entertainment", name: "Events & Entertainment", description: "Event producers, venues, performers and entertainment brands.", icon: "events" },
  { key: "other", name: "Other / Custom Industry", description: "Describe another business category that fits your company.", icon: "other" },
] as const satisfies readonly {
  key: IndustryKey;
  name: string;
  description: string;
  icon: string;
}[];

export const WORKSPACE_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export const WorkspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const WORKSPACE_PERMISSIONS = [
  "workspace.read",
  "workspace.updateSettings",
  "workspace.viewMembers",
  "workspace.editOperationalData",
  "integrations.read",
  "integrations.manage",
  "campaigns.read",
  "campaigns.manage",
  "campaigns.review",
  "campaigns.approve",
  "campaigns.publishDemo",
  "brand.read",
  "brand.manage",
  "assets.read",
  "assets.manage",
  "creatives.read",
  "creatives.manage",
  "creatives.review",
  "creatives.approve",
  "optimization.read",
  "optimization.manage",
  "optimization.approve",
  "automation.read",
  "automation.manage",
  "automation.approve",
  "notifications.read",
  "notifications.manage",
  "analytics.read",
  "reports.manage",
  "reports.archive",
  "reports.export",
  "agency.read",
  "agency.manage",
  "client.read",
  "client.collaborate",
  "client.manageAccess",
  "client.approve",
  "billing.manage",
] as const;
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  owner: ["workspace.read", "workspace.updateSettings", "workspace.viewMembers", "workspace.editOperationalData", "integrations.read", "integrations.manage", "campaigns.read", "campaigns.manage", "campaigns.review", "campaigns.approve", "campaigns.publishDemo", "brand.read", "brand.manage", "assets.read", "assets.manage", "creatives.read", "creatives.manage", "creatives.review", "creatives.approve", "optimization.read", "optimization.manage", "optimization.approve", "automation.read", "automation.manage", "automation.approve", "notifications.read", "notifications.manage", "analytics.read", "reports.manage", "reports.archive", "reports.export", "agency.read", "agency.manage", "client.read", "client.collaborate", "client.manageAccess", "client.approve", "billing.manage"],
  admin: ["workspace.read", "workspace.updateSettings", "workspace.viewMembers", "workspace.editOperationalData", "integrations.read", "integrations.manage", "campaigns.read", "campaigns.manage", "campaigns.review", "campaigns.approve", "campaigns.publishDemo", "brand.read", "brand.manage", "assets.read", "assets.manage", "creatives.read", "creatives.manage", "creatives.review", "creatives.approve", "optimization.read", "optimization.manage", "optimization.approve", "automation.read", "automation.manage", "automation.approve", "notifications.read", "notifications.manage", "analytics.read", "reports.manage", "reports.archive", "reports.export", "agency.read", "agency.manage", "client.read", "client.collaborate", "client.manageAccess", "client.approve", "billing.manage"],
  editor: ["workspace.read", "workspace.editOperationalData", "integrations.read", "campaigns.read", "campaigns.manage", "campaigns.review", "brand.read", "assets.read", "assets.manage", "creatives.read", "creatives.manage", "creatives.review", "optimization.read", "optimization.manage", "automation.read", "automation.manage", "notifications.read", "notifications.manage", "analytics.read", "reports.manage", "reports.export", "agency.read", "client.read", "client.collaborate"],
  viewer: ["workspace.read", "integrations.read", "campaigns.read", "brand.read", "assets.read", "creatives.read", "optimization.read", "automation.read", "notifications.read", "analytics.read", "agency.read", "client.read"],
};

export function hasWorkspacePermission(
  role: WorkspaceRole,
  permission: WorkspacePermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters for the workspace URL.")
  .max(48, "Use 48 characters or fewer for the workspace URL.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.");

const optionalWebsiteSchema = z
  .string()
  .trim()
  .max(2048, "Website URL is too long.")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Enter a valid website URL beginning with https:// or http://.")
  .nullable()
  .transform((value) => value || null);

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use a two-letter country code, such as US, GB or IN.")
  .nullable();

const workspaceBasics = {
  name: z.string().trim().min(2, "Enter a business name.").max(120, "Business name must be 120 characters or fewer."),
  slug: slugSchema,
  industryKey: IndustryKeySchema,
  industryCustomLabel: z.string().trim().max(100, "Custom industry must be 100 characters or fewer.").nullable(),
  websiteUrl: optionalWebsiteSchema,
  countryCode: countryCodeSchema,
  timezone: z.string().trim().min(1, "Choose a time zone.").max(100, "Time zone is too long."),
};

export const WorkspaceBusinessInputSchema = z
  .object(workspaceBasics)
  .superRefine((value, context) => {
    if (value.industryKey === "other" && !value.industryCustomLabel?.trim()) {
      context.addIssue({ code: "custom", path: ["industryCustomLabel"], message: "Describe your industry." });
    }
    if (value.industryKey !== "other" && value.industryCustomLabel) {
      context.addIssue({ code: "custom", path: ["industryCustomLabel"], message: "Only custom industries use this field." });
    }
  });

export const CreateWorkspaceInputSchema = WorkspaceBusinessInputSchema.extend({
  requestId: z.string().uuid(),
}).strict();

export const WorkspaceSettingsInputSchema = z
  .object({
    name: workspaceBasics.name.optional(),
    industryKey: IndustryKeySchema.optional(),
    industryCustomLabel: z.string().trim().max(100).nullable().optional(),
    websiteUrl: optionalWebsiteSchema.optional(),
    countryCode: countryCodeSchema.optional(),
    timezone: workspaceBasics.timezone.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one setting to update.");

export const WorkspaceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  industry_key: IndustryKeySchema,
  industry_custom_label: z.string().nullable(),
  website_url: z.string().nullable(),
  country_code: z.string().nullable(),
  timezone: z.string(),
  logo_url: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  industryKey: IndustryKeySchema,
  industryCustomLabel: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  countryCode: z.string().nullable(),
  timezone: z.string(),
  logoUrl: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const WorkspaceWithRoleSchema = WorkspaceSchema.extend({ role: WorkspaceRoleSchema });
export const WorkspaceResponseSchema = z.object({ workspace: WorkspaceSchema, role: WorkspaceRoleSchema });
export const WorkspacesResponseSchema = z.object({ workspaces: z.array(WorkspaceWithRoleSchema) });
export const WorkspaceMembersResponseSchema = z.object({
  members: z.array(z.object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: WorkspaceRoleSchema,
    createdAt: z.string().datetime({ offset: true }),
  })),
});

export type WorkspaceMembersResponse = z.infer<typeof WorkspaceMembersResponseSchema>;
export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;
export type WorkspacesResponse = z.infer<typeof WorkspacesResponseSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;
export type WorkspaceBusinessInput = z.infer<typeof WorkspaceBusinessInputSchema>;
export type WorkspaceSettingsInput = z.infer<typeof WorkspaceSettingsInputSchema>;
export type WorkspaceRow = z.infer<typeof WorkspaceRowSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceWithRole = z.infer<typeof WorkspaceWithRoleSchema>;

export function workspaceFromRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industryKey: row.industry_key,
    industryCustomLabel: row.industry_custom_label,
    websiteUrl: row.website_url,
    countryCode: row.country_code,
    timezone: row.timezone,
    logoUrl: row.logo_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
