import { z } from "zod";
import { IndustryKeySchema } from "./workspace.js";
export declare const TrackingProviderSchema: z.ZodEnum<{
    google_ads: "google_ads";
    meta_ads: "meta_ads";
    ga4: "ga4";
    google_tag_manager: "google_tag_manager";
    meta_pixel: "meta_pixel";
    google_ads_conversion: "google_ads_conversion";
}>;
export type TrackingProvider = z.infer<typeof TrackingProviderSchema>;
export declare const TrackingRecordStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
    archived: "archived";
}>;
export declare const TrackingGoalCategorySchema: z.ZodEnum<{
    custom: "custom";
    engagement: "engagement";
    lead: "lead";
    sale: "sale";
    registration: "registration";
    booking: "booking";
}>;
export declare const TrackingSourceTypeSchema: z.ZodEnum<{
    custom: "custom";
    offline: "offline";
    website: "website";
    mobile_app: "mobile_app";
    crm: "crm";
}>;
export declare const TrackingParameterTypeSchema: z.ZodEnum<{
    string: "string";
    number: "number";
    boolean: "boolean";
}>;
export declare const TrackingProviderCatalogue: readonly [{
    readonly id: "google_ads";
    readonly category: "advertising";
    readonly name: "Google Ads";
    readonly purpose: "Prepare advertising account requirements and conversion planning.";
    readonly enabled: false;
}, {
    readonly id: "meta_ads";
    readonly category: "advertising";
    readonly name: "Meta Ads";
    readonly purpose: "Prepare business portfolio and ad account requirements.";
    readonly enabled: false;
}, {
    readonly id: "ga4";
    readonly category: "measurement";
    readonly name: "Google Analytics 4";
    readonly purpose: "Plan events, key events and campaign attribution.";
    readonly enabled: false;
}, {
    readonly id: "google_tag_manager";
    readonly category: "measurement";
    readonly name: "Google Tag Manager";
    readonly purpose: "Document a proposed tag, trigger and consent implementation.";
    readonly enabled: false;
}, {
    readonly id: "meta_pixel";
    readonly category: "measurement";
    readonly name: "Meta Pixel / Dataset";
    readonly purpose: "Plan browser-side event mappings and consent review.";
    readonly enabled: false;
}, {
    readonly id: "google_ads_conversion";
    readonly category: "measurement";
    readonly name: "Google Ads Conversion Tracking";
    readonly purpose: "Document conversion action and offline implementation requirements.";
    readonly enabled: false;
}];
export declare const ReadinessCategorySchema: z.ZodEnum<{
    business_information: "business_information";
    account_ownership: "account_ownership";
    advertising_permissions: "advertising_permissions";
    website_readiness: "website_readiness";
    conversion_plan: "conversion_plan";
    billing_preparation: "billing_preparation";
    policy_review: "policy_review";
}>;
export declare const READINESS_REQUIREMENTS: readonly [{
    readonly id: "business_details";
    readonly category: "business_information";
    readonly description: "Business identity and contact responsibilities have been documented.";
    readonly required: true;
}, {
    readonly id: "account_owner";
    readonly category: "account_ownership";
    readonly description: "An authorized business owner for the ad account has been identified.";
    readonly required: true;
}, {
    readonly id: "account_identifier";
    readonly category: "account_ownership";
    readonly description: "The account identifier has been recorded as planning metadata.";
    readonly required: true;
}, {
    readonly id: "access_roles";
    readonly category: "advertising_permissions";
    readonly description: "Required business and advertising permissions have been reviewed.";
    readonly required: true;
}, {
    readonly id: "website_destination";
    readonly category: "website_readiness";
    readonly description: "The campaign destination website is ready for review.";
    readonly required: true;
}, {
    readonly id: "measurement_plan";
    readonly category: "conversion_plan";
    readonly description: "At least one conversion goal and proposed event mapping are documented.";
    readonly required: true;
}, {
    readonly id: "billing_responsibility";
    readonly category: "billing_preparation";
    readonly description: "The responsible billing party and future payment setup are understood.";
    readonly required: true;
}, {
    readonly id: "policy_review";
    readonly category: "policy_review";
    readonly description: "Applicable advertising policies and business verification needs are reviewed.";
    readonly required: true;
}];
export declare const IntegrationConfigInputSchema: z.ZodObject<{
    accountIdentifier: z.ZodDefault<z.ZodString>;
    businessLabel: z.ZodDefault<z.ZodString>;
    websiteUrl: z.ZodDefault<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const ReadinessResponseInputSchema: z.ZodObject<{
    requirementId: z.ZodString;
    completed: z.ZodBoolean;
    note: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const ConversionGoalInputSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodEnum<{
        custom: "custom";
        engagement: "engagement";
        lead: "lead";
        sale: "sale";
        registration: "registration";
        booking: "booking";
    }>;
    description: z.ZodDefault<z.ZodString>;
    eventName: z.ZodString;
    objective: z.ZodDefault<z.ZodString>;
    illustrativeValue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    currency: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    countingPolicy: z.ZodDefault<z.ZodEnum<{
        once_per_event: "once_per_event";
        once_per_session: "once_per_session";
        once_per_user: "once_per_user";
    }>>;
    attributionNotes: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
    }>>;
    industry: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
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
    }>>>;
}, z.core.$strict>;
export declare const EventParameterSchema: z.ZodObject<{
    type: z.ZodEnum<{
        string: "string";
        number: "number";
        boolean: "boolean";
    }>;
    required: z.ZodBoolean;
    description: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const EventDefinitionInputSchema: z.ZodObject<{
    eventKey: z.ZodString;
    displayName: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    triggerDefinition: z.ZodDefault<z.ZodString>;
    sourceType: z.ZodEnum<{
        custom: "custom";
        offline: "offline";
        website: "website";
        mobile_app: "mobile_app";
        crm: "crm";
    }>;
    expectedParameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
        }>;
        required: z.ZodBoolean;
        description: z.ZodDefault<z.ZodString>;
    }, z.core.$strict>>>;
    deduplicationReference: z.ZodDefault<z.ZodString>;
    consentRequired: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
    }>>;
}, z.core.$strict>;
export declare const EventMappingInputSchema: z.ZodObject<{
    eventDefinitionId: z.ZodString;
    provider: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
        ga4: "ga4";
        google_tag_manager: "google_tag_manager";
        meta_pixel: "meta_pixel";
        google_ads_conversion: "google_ads_conversion";
    }>;
    providerEventName: z.ZodString;
    parameterMap: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
    }>>;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const UTMParameterSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodString;
}, z.core.$strict>;
export declare const UTMTemplateInputSchema: z.ZodObject<{
    name: z.ZodString;
    destinationUrl: z.ZodString;
    source: z.ZodString;
    medium: z.ZodString;
    campaign: z.ZodString;
    content: z.ZodDefault<z.ZodString>;
    term: z.ZodDefault<z.ZodString>;
    customParameters: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, z.core.$strict>>>;
    replaceExisting: z.ZodDefault<z.ZodBoolean>;
    campaignId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    goalId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
    }>>;
}, z.core.$strict>;
export declare const TrackingTestInputSchema: z.ZodObject<{
    goalId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    eventDefinitionId: z.ZodString;
    parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
}, z.core.$strict>;
export declare const CampaignTrackingInputSchema: z.ZodObject<{
    campaignId: z.ZodString;
    goalId: z.ZodNullable<z.ZodString>;
    utmTemplateId: z.ZodNullable<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const TrackingPrivacyChecklistSchema: z.ZodObject<{
    privacyNoticeReviewed: z.ZodBoolean;
    consentPlanningReviewed: z.ZodBoolean;
    jurisdictionReviewNeeded: z.ZodBoolean;
    dataMinimizationReviewed: z.ZodBoolean;
    sensitiveFieldsExcluded: z.ZodBoolean;
    retentionReviewed: z.ZodBoolean;
    thirdPartySharingReviewed: z.ZodBoolean;
}, z.core.$strict>;
export declare const TrackingPlanInputSchema: z.ZodObject<{
    name: z.ZodString;
    destinationWebsite: z.ZodString;
    provider: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
        ga4: "ga4";
        google_tag_manager: "google_tag_manager";
        meta_pixel: "meta_pixel";
        google_ads_conversion: "google_ads_conversion";
    }>;
    installationMethod: z.ZodEnum<{
        google_tag_manager: "google_tag_manager";
        meta_pixel: "meta_pixel";
        google_tag_ga4: "google_tag_ga4";
        google_ads_conversion_tag: "google_ads_conversion_tag";
        future_server_side: "future_server_side";
    }>;
    measurementIdentifier: z.ZodDefault<z.ZodString>;
    consentPrerequisites: z.ZodDefault<z.ZodString>;
    testPlan: z.ZodDefault<z.ZodString>;
    implementationOwnerLabel: z.ZodDefault<z.ZodString>;
    reviewStatus: z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        internal_review: "internal_review";
        client_review: "client_review";
        approved_for_future_implementation: "approved_for_future_implementation";
    }>>;
    privacyChecklist: z.ZodDefault<z.ZodObject<{
        privacyNoticeReviewed: z.ZodBoolean;
        consentPlanningReviewed: z.ZodBoolean;
        jurisdictionReviewNeeded: z.ZodBoolean;
        dataMinimizationReviewed: z.ZodBoolean;
        sensitiveFieldsExcluded: z.ZodBoolean;
        retentionReviewed: z.ZodBoolean;
        thirdPartySharingReviewed: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const TrackingPreferencesInputSchema: z.ZodObject<{
    casing: z.ZodDefault<z.ZodEnum<{
        lower: "lower";
        upper: "upper";
        preserve: "preserve";
    }>>;
    separator: z.ZodDefault<z.ZodEnum<{
        _: "_";
        "-": "-";
        ".": ".";
    }>>;
    campaignFormat: z.ZodDefault<z.ZodString>;
    sourcePresets: z.ZodDefault<z.ZodArray<z.ZodString>>;
    contentLabels: z.ZodDefault<z.ZodArray<z.ZodString>>;
    dateTokenFormat: z.ZodDefault<z.ZodEnum<{
        yyyyMMdd: "yyyyMMdd";
        "yyyy-MM-dd": "yyyy-MM-dd";
        "MMM-yyyy": "MMM-yyyy";
    }>>;
}, z.core.$strict>;
export declare const INDUSTRY_GOAL_PRESETS: Partial<Record<z.infer<typeof IndustryKeySchema>, {
    name: string;
    category: z.infer<typeof TrackingGoalCategorySchema>;
    eventName: string;
    objective: string;
}[]>>;
export declare function buildTrackingUrl(input: z.infer<typeof UTMTemplateInputSchema>): {
    url: string;
    warnings: string[];
};
export declare function readinessScore(completedRequirementIds: ReadonlySet<string>): number;
//# sourceMappingURL=tracking.d.ts.map