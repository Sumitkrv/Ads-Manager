import { z } from "zod";
export declare const INDUSTRY_KEYS: readonly ["real_estate", "ecommerce_retail", "healthcare_clinics", "education_coaching", "gyms_fitness", "restaurants_cafes", "hotels_hospitality", "travel_tourism", "automobile_dealerships", "salons_beauty", "professional_services", "marketing_agencies", "home_services", "finance_insurance", "events_entertainment", "other"];
export declare const IndustryKeySchema: z.ZodEnum<{
    real_estate: "real_estate";
    ecommerce_retail: "ecommerce_retail";
    healthcare_clinics: "healthcare_clinics";
    education_coaching: "education_coaching";
    gyms_fitness: "gyms_fitness";
    restaurants_cafes: "restaurants_cafes";
    hotels_hospitality: "hotels_hospitality";
    travel_tourism: "travel_tourism";
    automobile_dealerships: "automobile_dealerships";
    salons_beauty: "salons_beauty";
    professional_services: "professional_services";
    marketing_agencies: "marketing_agencies";
    home_services: "home_services";
    finance_insurance: "finance_insurance";
    events_entertainment: "events_entertainment";
    other: "other";
}>;
export type IndustryKey = z.infer<typeof IndustryKeySchema>;
export declare const INDUSTRIES: readonly [{
    readonly key: "real_estate";
    readonly name: "Real Estate & Property";
    readonly description: "Property developers, brokerages, property managers and local real estate teams.";
    readonly icon: "home";
}, {
    readonly key: "ecommerce_retail";
    readonly name: "E-commerce & Retail";
    readonly description: "Online stores, product brands and local retailers.";
    readonly icon: "bag";
}, {
    readonly key: "healthcare_clinics";
    readonly name: "Healthcare & Clinics";
    readonly description: "Clinics and healthcare providers with responsible patient outreach.";
    readonly icon: "health";
}, {
    readonly key: "education_coaching";
    readonly name: "Education & Coaching";
    readonly description: "Schools, educators, training providers and coaches.";
    readonly icon: "education";
}, {
    readonly key: "gyms_fitness";
    readonly name: "Gyms & Fitness";
    readonly description: "Gyms, studios, personal trainers and wellness businesses.";
    readonly icon: "fitness";
}, {
    readonly key: "restaurants_cafes";
    readonly name: "Restaurants & Cafes";
    readonly description: "Restaurants, cafes, food brands and local dining.";
    readonly icon: "dining";
}, {
    readonly key: "hotels_hospitality";
    readonly name: "Hotels & Hospitality";
    readonly description: "Hotels, stays, venues and hospitality operators.";
    readonly icon: "hospitality";
}, {
    readonly key: "travel_tourism";
    readonly name: "Travel & Tourism";
    readonly description: "Travel operators, destinations and experience providers.";
    readonly icon: "travel";
}, {
    readonly key: "automobile_dealerships";
    readonly name: "Automobile & Dealerships";
    readonly description: "Vehicle dealers, service centers and mobility brands.";
    readonly icon: "auto";
}, {
    readonly key: "salons_beauty";
    readonly name: "Salons & Beauty";
    readonly description: "Salons, spas, beauty professionals and personal care brands.";
    readonly icon: "beauty";
}, {
    readonly key: "professional_services";
    readonly name: "Professional Services";
    readonly description: "Consultancies and specialist business-to-business services.";
    readonly icon: "services";
}, {
    readonly key: "marketing_agencies";
    readonly name: "Marketing & Advertising Agencies";
    readonly description: "Agencies managing their own business and future client workspaces.";
    readonly icon: "agency";
}, {
    readonly key: "home_services";
    readonly name: "Home Services";
    readonly description: "Home repair, maintenance, renovation and local service businesses.";
    readonly icon: "tools";
}, {
    readonly key: "finance_insurance";
    readonly name: "Finance & Insurance";
    readonly description: "Financial and insurance providers with compliant communications.";
    readonly icon: "finance";
}, {
    readonly key: "events_entertainment";
    readonly name: "Events & Entertainment";
    readonly description: "Event producers, venues, performers and entertainment brands.";
    readonly icon: "events";
}, {
    readonly key: "other";
    readonly name: "Other / Custom Industry";
    readonly description: "Describe another business category that fits your company.";
    readonly icon: "other";
}];
export declare const WORKSPACE_ROLES: readonly ["owner", "admin", "editor", "viewer"];
export declare const WorkspaceRoleSchema: z.ZodEnum<{
    owner: "owner";
    admin: "admin";
    editor: "editor";
    viewer: "viewer";
}>;
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export declare const WORKSPACE_PERMISSIONS: readonly ["workspace.read", "workspace.updateSettings", "workspace.viewMembers", "workspace.editOperationalData", "integrations.read", "integrations.manage", "campaigns.read", "campaigns.manage", "campaigns.review", "campaigns.approve", "campaigns.publishDemo", "brand.read", "brand.manage", "assets.read", "assets.manage", "creatives.read", "creatives.manage", "creatives.review", "creatives.approve", "optimization.read", "optimization.manage", "optimization.approve", "automation.read", "automation.manage", "automation.approve", "notifications.read", "notifications.manage", "analytics.read", "reports.manage", "reports.archive", "reports.export", "agency.read", "agency.manage", "client.read", "client.collaborate", "client.manageAccess", "client.approve", "billing.manage"];
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];
export declare function hasWorkspacePermission(role: WorkspaceRole, permission: WorkspacePermission): boolean;
export declare const WorkspaceBusinessInputSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    industryKey: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    industryCustomLabel: z.ZodNullable<z.ZodString>;
    websiteUrl: z.ZodPipe<z.ZodNullable<z.ZodString>, z.ZodTransform<string | null, string | null>>;
    countryCode: z.ZodNullable<z.ZodString>;
    timezone: z.ZodString;
}, z.core.$strip>;
export declare const CreateWorkspaceInputSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    industryKey: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    industryCustomLabel: z.ZodNullable<z.ZodString>;
    websiteUrl: z.ZodPipe<z.ZodNullable<z.ZodString>, z.ZodTransform<string | null, string | null>>;
    countryCode: z.ZodNullable<z.ZodString>;
    timezone: z.ZodString;
    requestId: z.ZodString;
}, z.core.$strict>;
export declare const WorkspaceSettingsInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    industryKey: z.ZodOptional<z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>>;
    industryCustomLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    websiteUrl: z.ZodOptional<z.ZodPipe<z.ZodNullable<z.ZodString>, z.ZodTransform<string | null, string | null>>>;
    countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timezone: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const WorkspaceRowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    industry_key: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    industry_custom_label: z.ZodNullable<z.ZodString>;
    website_url: z.ZodNullable<z.ZodString>;
    country_code: z.ZodNullable<z.ZodString>;
    timezone: z.ZodString;
    logo_url: z.ZodNullable<z.ZodString>;
    created_by: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strip>;
export declare const WorkspaceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    industryKey: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    industryCustomLabel: z.ZodNullable<z.ZodString>;
    websiteUrl: z.ZodNullable<z.ZodString>;
    countryCode: z.ZodNullable<z.ZodString>;
    timezone: z.ZodString;
    logoUrl: z.ZodNullable<z.ZodString>;
    createdBy: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const WorkspaceWithRoleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    industryKey: z.ZodEnum<{
        real_estate: "real_estate";
        ecommerce_retail: "ecommerce_retail";
        healthcare_clinics: "healthcare_clinics";
        education_coaching: "education_coaching";
        gyms_fitness: "gyms_fitness";
        restaurants_cafes: "restaurants_cafes";
        hotels_hospitality: "hotels_hospitality";
        travel_tourism: "travel_tourism";
        automobile_dealerships: "automobile_dealerships";
        salons_beauty: "salons_beauty";
        professional_services: "professional_services";
        marketing_agencies: "marketing_agencies";
        home_services: "home_services";
        finance_insurance: "finance_insurance";
        events_entertainment: "events_entertainment";
        other: "other";
    }>;
    industryCustomLabel: z.ZodNullable<z.ZodString>;
    websiteUrl: z.ZodNullable<z.ZodString>;
    countryCode: z.ZodNullable<z.ZodString>;
    timezone: z.ZodString;
    logoUrl: z.ZodNullable<z.ZodString>;
    createdBy: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
}, z.core.$strip>;
export declare const WorkspaceResponseSchema: z.ZodObject<{
    workspace: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        slug: z.ZodString;
        industryKey: z.ZodEnum<{
            real_estate: "real_estate";
            ecommerce_retail: "ecommerce_retail";
            healthcare_clinics: "healthcare_clinics";
            education_coaching: "education_coaching";
            gyms_fitness: "gyms_fitness";
            restaurants_cafes: "restaurants_cafes";
            hotels_hospitality: "hotels_hospitality";
            travel_tourism: "travel_tourism";
            automobile_dealerships: "automobile_dealerships";
            salons_beauty: "salons_beauty";
            professional_services: "professional_services";
            marketing_agencies: "marketing_agencies";
            home_services: "home_services";
            finance_insurance: "finance_insurance";
            events_entertainment: "events_entertainment";
            other: "other";
        }>;
        industryCustomLabel: z.ZodNullable<z.ZodString>;
        websiteUrl: z.ZodNullable<z.ZodString>;
        countryCode: z.ZodNullable<z.ZodString>;
        timezone: z.ZodString;
        logoUrl: z.ZodNullable<z.ZodString>;
        createdBy: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
}, z.core.$strip>;
export declare const WorkspacesResponseSchema: z.ZodObject<{
    workspaces: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        slug: z.ZodString;
        industryKey: z.ZodEnum<{
            real_estate: "real_estate";
            ecommerce_retail: "ecommerce_retail";
            healthcare_clinics: "healthcare_clinics";
            education_coaching: "education_coaching";
            gyms_fitness: "gyms_fitness";
            restaurants_cafes: "restaurants_cafes";
            hotels_hospitality: "hotels_hospitality";
            travel_tourism: "travel_tourism";
            automobile_dealerships: "automobile_dealerships";
            salons_beauty: "salons_beauty";
            professional_services: "professional_services";
            marketing_agencies: "marketing_agencies";
            home_services: "home_services";
            finance_insurance: "finance_insurance";
            events_entertainment: "events_entertainment";
            other: "other";
        }>;
        industryCustomLabel: z.ZodNullable<z.ZodString>;
        websiteUrl: z.ZodNullable<z.ZodString>;
        countryCode: z.ZodNullable<z.ZodString>;
        timezone: z.ZodString;
        logoUrl: z.ZodNullable<z.ZodString>;
        createdBy: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            editor: "editor";
            viewer: "viewer";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WorkspaceMembersResponseSchema: z.ZodObject<{
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        userId: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            editor: "editor";
            viewer: "viewer";
        }>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WorkspaceMembersResponse = z.infer<typeof WorkspaceMembersResponseSchema>;
export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;
export type WorkspacesResponse = z.infer<typeof WorkspacesResponseSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;
export type WorkspaceBusinessInput = z.infer<typeof WorkspaceBusinessInputSchema>;
export type WorkspaceSettingsInput = z.infer<typeof WorkspaceSettingsInputSchema>;
export type WorkspaceRow = z.infer<typeof WorkspaceRowSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceWithRole = z.infer<typeof WorkspaceWithRoleSchema>;
export declare function workspaceFromRow(row: WorkspaceRow): Workspace;
//# sourceMappingURL=workspace.d.ts.map