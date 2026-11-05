import { z } from "zod";
export declare const AnalyticsMetricSchema: z.ZodEnum<{
    spend: "spend";
    impressions: "impressions";
    clicks: "clicks";
    ctr: "ctr";
    cpc: "cpc";
    cpm: "cpm";
    conversions: "conversions";
    conversion_rate: "conversion_rate";
    cpa: "cpa";
    roas: "roas";
}>;
export declare const AnalyticsDatePresetSchema: z.ZodEnum<{
    custom: "custom";
    today: "today";
    yesterday: "yesterday";
    last_7_days: "last_7_days";
    last_14_days: "last_14_days";
    last_30_days: "last_30_days";
    last_90_days: "last_90_days";
    this_month: "this_month";
    last_month: "last_month";
}>;
export declare const AnalyticsDimensionSchema: z.ZodEnum<{
    currency: "currency";
    date: "date";
    campaign: "campaign";
    industry: "industry";
    platform: "platform";
    objective: "objective";
    scenario: "scenario";
}>;
export declare const ReportTypeSchema: z.ZodEnum<{
    custom: "custom";
    executive_overview: "executive_overview";
    campaign_performance: "campaign_performance";
    platform_comparison: "platform_comparison";
    creative_analysis: "creative_analysis";
    budget_efficiency: "budget_efficiency";
    performance_trends: "performance_trends";
    google_search: "google_search";
    meta_campaign: "meta_campaign";
}>;
export declare const ReportSectionTypeSchema: z.ZodEnum<{
    heading: "heading";
    kpi_summary: "kpi_summary";
    chart: "chart";
    table: "table";
    comparison: "comparison";
    notes: "notes";
    methodology: "methodology";
}>;
export declare const AnalyticsFilterSchema: z.ZodObject<{
    preset: z.ZodDefault<z.ZodEnum<{
        custom: "custom";
        today: "today";
        yesterday: "yesterday";
        last_7_days: "last_7_days";
        last_14_days: "last_14_days";
        last_30_days: "last_30_days";
        last_90_days: "last_90_days";
        this_month: "this_month";
        last_month: "last_month";
    }>>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    platform: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<"all">, z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>]>>;
    campaignId: z.ZodOptional<z.ZodString>;
    objective: z.ZodOptional<z.ZodEnum<{
        website_traffic: "website_traffic";
        traffic: "traffic";
        lead_generation: "lead_generation";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        app_promotion: "app_promotion";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        generated_simulation: "generated_simulation";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        approved_for_demo: "approved_for_demo";
        demo_published: "demo_published";
        archived: "archived";
    }>>;
    industry: z.ZodOptional<z.ZodEnum<{
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
    scenario: z.ZodOptional<z.ZodEnum<{
        low: "low";
        high: "high";
        average: "average";
        gradual_improvement: "gradual_improvement";
        decline: "decline";
    }>>;
    currency: z.ZodOptional<z.ZodString>;
    comparePrevious: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const AnalyticsSavedViewInputSchema: z.ZodObject<{
    name: z.ZodString;
    filters: z.ZodObject<{
        preset: z.ZodDefault<z.ZodEnum<{
            custom: "custom";
            today: "today";
            yesterday: "yesterday";
            last_7_days: "last_7_days";
            last_14_days: "last_14_days";
            last_30_days: "last_30_days";
            last_90_days: "last_90_days";
            this_month: "this_month";
            last_month: "last_month";
        }>>;
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
        platform: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<"all">, z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>]>>;
        campaignId: z.ZodOptional<z.ZodString>;
        objective: z.ZodOptional<z.ZodEnum<{
            website_traffic: "website_traffic";
            traffic: "traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            generated_simulation: "generated_simulation";
            needs_review: "needs_review";
            changes_requested: "changes_requested";
            approved_for_demo: "approved_for_demo";
            demo_published: "demo_published";
            archived: "archived";
        }>>;
        industry: z.ZodOptional<z.ZodEnum<{
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
        scenario: z.ZodOptional<z.ZodEnum<{
            low: "low";
            high: "high";
            average: "average";
            gradual_improvement: "gradual_improvement";
            decline: "decline";
        }>>;
        currency: z.ZodOptional<z.ZodString>;
        comparePrevious: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>;
    visibleColumns: z.ZodArray<z.ZodEnum<{
        currency: "currency";
        status: "status";
        campaign: "campaign";
        platform: "platform";
        objective: "objective";
        spend: "spend";
        impressions: "impressions";
        clicks: "clicks";
        ctr: "ctr";
        cpc: "cpc";
        cpm: "cpm";
        conversions: "conversions";
        cpa: "cpa";
        roas: "roas";
    }>>;
    sort: z.ZodDefault<z.ZodEnum<{
        campaign: "campaign";
        updated: "updated";
        spend: "spend";
        impressions: "impressions";
        clicks: "clicks";
        ctr: "ctr";
    }>>;
    expectedVersion: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const ReportSectionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        heading: "heading";
        kpi_summary: "kpi_summary";
        chart: "chart";
        table: "table";
        comparison: "comparison";
        notes: "notes";
        methodology: "methodology";
    }>;
    title: z.ZodDefault<z.ZodString>;
    metric: z.ZodOptional<z.ZodEnum<{
        spend: "spend";
        impressions: "impressions";
        clicks: "clicks";
        ctr: "ctr";
        cpc: "cpc";
        cpm: "cpm";
        conversions: "conversions";
        conversion_rate: "conversion_rate";
        cpa: "cpa";
        roas: "roas";
    }>>;
    dimension: z.ZodOptional<z.ZodEnum<{
        currency: "currency";
        date: "date";
        campaign: "campaign";
        industry: "industry";
        platform: "platform";
        objective: "objective";
        scenario: "scenario";
    }>>;
    content: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const ReportDefinitionInputSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    reportType: z.ZodEnum<{
        custom: "custom";
        executive_overview: "executive_overview";
        campaign_performance: "campaign_performance";
        platform_comparison: "platform_comparison";
        creative_analysis: "creative_analysis";
        budget_efficiency: "budget_efficiency";
        performance_trends: "performance_trends";
        google_search: "google_search";
        meta_campaign: "meta_campaign";
    }>;
    filters: z.ZodObject<{
        preset: z.ZodDefault<z.ZodEnum<{
            custom: "custom";
            today: "today";
            yesterday: "yesterday";
            last_7_days: "last_7_days";
            last_14_days: "last_14_days";
            last_30_days: "last_30_days";
            last_90_days: "last_90_days";
            this_month: "this_month";
            last_month: "last_month";
        }>>;
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
        platform: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<"all">, z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>]>>;
        campaignId: z.ZodOptional<z.ZodString>;
        objective: z.ZodOptional<z.ZodEnum<{
            website_traffic: "website_traffic";
            traffic: "traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            generated_simulation: "generated_simulation";
            needs_review: "needs_review";
            changes_requested: "changes_requested";
            approved_for_demo: "approved_for_demo";
            demo_published: "demo_published";
            archived: "archived";
        }>>;
        industry: z.ZodOptional<z.ZodEnum<{
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
        scenario: z.ZodOptional<z.ZodEnum<{
            low: "low";
            high: "high";
            average: "average";
            gradual_improvement: "gradual_improvement";
            decline: "decline";
        }>>;
        currency: z.ZodOptional<z.ZodString>;
        comparePrevious: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>;
    metrics: z.ZodArray<z.ZodEnum<{
        spend: "spend";
        impressions: "impressions";
        clicks: "clicks";
        ctr: "ctr";
        cpc: "cpc";
        cpm: "cpm";
        conversions: "conversions";
        conversion_rate: "conversion_rate";
        cpa: "cpa";
        roas: "roas";
    }>>;
    dimensions: z.ZodArray<z.ZodEnum<{
        currency: "currency";
        date: "date";
        campaign: "campaign";
        industry: "industry";
        platform: "platform";
        objective: "objective";
        scenario: "scenario";
    }>>;
    sections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            heading: "heading";
            kpi_summary: "kpi_summary";
            chart: "chart";
            table: "table";
            comparison: "comparison";
            notes: "notes";
            methodology: "methodology";
        }>;
        title: z.ZodDefault<z.ZodString>;
        metric: z.ZodOptional<z.ZodEnum<{
            spend: "spend";
            impressions: "impressions";
            clicks: "clicks";
            ctr: "ctr";
            cpc: "cpc";
            cpm: "cpm";
            conversions: "conversions";
            conversion_rate: "conversion_rate";
            cpa: "cpa";
            roas: "roas";
        }>>;
        dimension: z.ZodOptional<z.ZodEnum<{
            currency: "currency";
            date: "date";
            campaign: "campaign";
            industry: "industry";
            platform: "platform";
            objective: "objective";
            scenario: "scenario";
        }>>;
        content: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    dateRangePolicy: z.ZodObject<{
        kind: z.ZodDefault<z.ZodEnum<{
            fixed: "fixed";
            rolling: "rolling";
        }>>;
        preset: z.ZodDefault<z.ZodEnum<{
            custom: "custom";
            today: "today";
            yesterday: "yesterday";
            last_7_days: "last_7_days";
            last_14_days: "last_14_days";
            last_30_days: "last_30_days";
            last_90_days: "last_90_days";
            this_month: "this_month";
            last_month: "last_month";
        }>>;
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
        schedulePreference: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            daily: "daily";
            weekly: "weekly";
            monthly: "monthly";
        }>>>;
    }, z.core.$strict>;
    expectedVersion: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const ReportDuplicateInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const ReportExportInputSchema: z.ZodObject<{
    format: z.ZodEnum<{
        csv: "csv";
        pdf: "pdf";
    }>;
}, z.core.$strict>;
export declare const ReportArchiveInputSchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
}, z.core.$strict>;
export type AnalyticsMetric = z.infer<typeof AnalyticsMetricSchema>;
export type AnalyticsFilter = z.infer<typeof AnalyticsFilterSchema>;
export type AnalyticsDimension = z.infer<typeof AnalyticsDimensionSchema>;
export type AnalyticsSavedViewInput = z.infer<typeof AnalyticsSavedViewInputSchema>;
export type ReportType = z.infer<typeof ReportTypeSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReportDefinitionInput = z.infer<typeof ReportDefinitionInputSchema>;
//# sourceMappingURL=analytics.d.ts.map