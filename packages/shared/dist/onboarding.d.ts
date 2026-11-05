import { z } from "zod";
export declare const OnboardingPathSchema: z.ZodEnum<{
    agency: "agency";
    business: "business";
    join: "join";
}>;
export declare const OnboardingBudgetRangeSchema: z.ZodEnum<{
    under_500: "under_500";
    "500_2000": "500_2000";
    "2000_5000": "2000_5000";
    "5000_plus": "5000_plus";
    not_sure: "not_sure";
}>;
export declare const OnboardingPlatformSchema: z.ZodEnum<{
    google_ads: "google_ads";
    meta_ads: "meta_ads";
}>;
export declare const OnboardingGoalSchema: z.ZodEnum<{
    website_traffic: "website_traffic";
    lead_generation: "lead_generation";
    sales: "sales";
    awareness: "awareness";
    engagement: "engagement";
    app_promotion: "app_promotion";
}>;
export declare const OnboardingToneSchema: z.ZodEnum<{
    clear: "clear";
    warm: "warm";
    confident: "confident";
    playful: "playful";
    premium: "premium";
    expert: "expert";
}>;
export declare const OnboardingSetupDataSchema: z.ZodObject<{
    businessDescription: z.ZodOptional<z.ZodString>;
    primaryRegion: z.ZodOptional<z.ZodString>;
    mainOffering: z.ZodOptional<z.ZodString>;
    marketingObjective: z.ZodOptional<z.ZodString>;
    campaignGoal: z.ZodOptional<z.ZodEnum<{
        website_traffic: "website_traffic";
        lead_generation: "lead_generation";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        app_promotion: "app_promotion";
    }>>;
    platformFormat: z.ZodOptional<z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>>;
    budgetRange: z.ZodOptional<z.ZodEnum<{
        under_500: "under_500";
        "500_2000": "500_2000";
        "2000_5000": "2000_5000";
        "5000_plus": "5000_plus";
        not_sure: "not_sure";
    }>>;
    audience: z.ZodOptional<z.ZodString>;
    brandTone: z.ZodOptional<z.ZodEnum<{
        clear: "clear";
        warm: "warm";
        confident: "confident";
        playful: "playful";
        premium: "premium";
        expert: "expert";
    }>>;
    ctaPreference: z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        warm: "warm";
        confident: "confident";
        direct: "direct";
        minimal: "minimal";
    }>>;
}, z.core.$strict>;
export declare const UserOnboardingPreferencesInputSchema: z.ZodObject<{
    setupPath: z.ZodEnum<{
        agency: "agency";
        business: "business";
        join: "join";
    }>;
    draft: z.ZodObject<{
        businessDescription: z.ZodOptional<z.ZodString>;
        primaryRegion: z.ZodOptional<z.ZodString>;
        mainOffering: z.ZodOptional<z.ZodString>;
        marketingObjective: z.ZodOptional<z.ZodString>;
        campaignGoal: z.ZodOptional<z.ZodEnum<{
            website_traffic: "website_traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>>;
        platformFormat: z.ZodOptional<z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>>;
        budgetRange: z.ZodOptional<z.ZodEnum<{
            under_500: "under_500";
            "500_2000": "500_2000";
            "2000_5000": "2000_5000";
            "5000_plus": "5000_plus";
            not_sure: "not_sure";
        }>>;
        audience: z.ZodOptional<z.ZodString>;
        brandTone: z.ZodOptional<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        ctaPreference: z.ZodOptional<z.ZodEnum<{
            custom: "custom";
            warm: "warm";
            confident: "confident";
            direct: "direct";
            minimal: "minimal";
        }>>;
        businessName: z.ZodOptional<z.ZodString>;
        industryKey: z.ZodOptional<z.ZodString>;
        industryCustomLabel: z.ZodOptional<z.ZodString>;
        websiteUrl: z.ZodOptional<z.ZodString>;
        countryCode: z.ZodOptional<z.ZodString>;
        timezone: z.ZodOptional<z.ZodString>;
        currentStep: z.ZodOptional<z.ZodNumber>;
        requestId: z.ZodOptional<z.ZodString>;
        createdWorkspaceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const WorkspaceOnboardingPatchSchema: z.ZodObject<{
    setupData: z.ZodObject<{
        businessDescription: z.ZodOptional<z.ZodString>;
        primaryRegion: z.ZodOptional<z.ZodString>;
        mainOffering: z.ZodOptional<z.ZodString>;
        marketingObjective: z.ZodOptional<z.ZodString>;
        campaignGoal: z.ZodOptional<z.ZodEnum<{
            website_traffic: "website_traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>>;
        platformFormat: z.ZodOptional<z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>>;
        budgetRange: z.ZodOptional<z.ZodEnum<{
            under_500: "under_500";
            "500_2000": "500_2000";
            "2000_5000": "2000_5000";
            "5000_plus": "5000_plus";
            not_sure: "not_sure";
        }>>;
        audience: z.ZodOptional<z.ZodString>;
        brandTone: z.ZodOptional<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        ctaPreference: z.ZodOptional<z.ZodEnum<{
            custom: "custom";
            warm: "warm";
            confident: "confident";
            direct: "direct";
            minimal: "minimal";
        }>>;
    }, z.core.$strict>;
    currentStep: z.ZodNumber;
    lastCompletedStep: z.ZodNumber;
}, z.core.$strict>;
export declare const UserOnboardingPreferencesSchema: z.ZodObject<{
    setupPath: z.ZodEnum<{
        agency: "agency";
        business: "business";
        join: "join";
    }>;
    draft: z.ZodObject<{
        businessDescription: z.ZodOptional<z.ZodString>;
        primaryRegion: z.ZodOptional<z.ZodString>;
        mainOffering: z.ZodOptional<z.ZodString>;
        marketingObjective: z.ZodOptional<z.ZodString>;
        campaignGoal: z.ZodOptional<z.ZodEnum<{
            website_traffic: "website_traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>>;
        platformFormat: z.ZodOptional<z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>>;
        budgetRange: z.ZodOptional<z.ZodEnum<{
            under_500: "under_500";
            "500_2000": "500_2000";
            "2000_5000": "2000_5000";
            "5000_plus": "5000_plus";
            not_sure: "not_sure";
        }>>;
        audience: z.ZodOptional<z.ZodString>;
        brandTone: z.ZodOptional<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        ctaPreference: z.ZodOptional<z.ZodEnum<{
            custom: "custom";
            warm: "warm";
            confident: "confident";
            direct: "direct";
            minimal: "minimal";
        }>>;
        businessName: z.ZodOptional<z.ZodString>;
        industryKey: z.ZodOptional<z.ZodString>;
        industryCustomLabel: z.ZodOptional<z.ZodString>;
        websiteUrl: z.ZodOptional<z.ZodString>;
        countryCode: z.ZodOptional<z.ZodString>;
        timezone: z.ZodOptional<z.ZodString>;
        currentStep: z.ZodOptional<z.ZodNumber>;
        requestId: z.ZodOptional<z.ZodString>;
        createdWorkspaceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    updatedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const WorkspaceOnboardingStateSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    setupData: z.ZodObject<{
        businessDescription: z.ZodOptional<z.ZodString>;
        primaryRegion: z.ZodOptional<z.ZodString>;
        mainOffering: z.ZodOptional<z.ZodString>;
        marketingObjective: z.ZodOptional<z.ZodString>;
        campaignGoal: z.ZodOptional<z.ZodEnum<{
            website_traffic: "website_traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>>;
        platformFormat: z.ZodOptional<z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>>;
        budgetRange: z.ZodOptional<z.ZodEnum<{
            under_500: "under_500";
            "500_2000": "500_2000";
            "2000_5000": "2000_5000";
            "5000_plus": "5000_plus";
            not_sure: "not_sure";
        }>>;
        audience: z.ZodOptional<z.ZodString>;
        brandTone: z.ZodOptional<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        ctaPreference: z.ZodOptional<z.ZodEnum<{
            custom: "custom";
            warm: "warm";
            confident: "confident";
            direct: "direct";
            minimal: "minimal";
        }>>;
    }, z.core.$strict>;
    currentStep: z.ZodNumber;
    lastCompletedStep: z.ZodNumber;
    startedAt: z.ZodString;
    lastActiveAt: z.ZodString;
    completedAt: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodString;
    version: z.ZodNumber;
}, z.core.$strip>;
export declare const ActivationItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    required: z.ZodBoolean;
    completed: z.ZodBoolean;
    completedAt: z.ZodNullable<z.ZodString>;
    href: z.ZodString;
    guidance: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const WorkspaceActivationResponseSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    workspaceName: z.ZodString;
    industryKey: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        required: z.ZodBoolean;
        completed: z.ZodBoolean;
        completedAt: z.ZodNullable<z.ZodString>;
        href: z.ZodString;
        guidance: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    completed: z.ZodNumber;
    total: z.ZodNumber;
    percent: z.ZodNumber;
    completedAt: z.ZodNullable<z.ZodString>;
    subscription: z.ZodOptional<z.ZodObject<{
        status: z.ZodNullable<z.ZodString>;
        plan: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ProductTourProgressSchema: z.ZodObject<{
    tourId: z.ZodString;
    workspaceId: z.ZodString;
    stepIndex: z.ZodNumber;
    status: z.ZodEnum<{
        skipped: "skipped";
        completed: "completed";
        running: "running";
    }>;
}, z.core.$strict>;
export declare const ProductTourProgressListSchema: z.ZodObject<{
    progress: z.ZodArray<z.ZodObject<{
        tourId: z.ZodString;
        workspaceId: z.ZodString;
        stepIndex: z.ZodNumber;
        status: z.ZodEnum<{
            skipped: "skipped";
            completed: "completed";
            running: "running";
        }>;
        startedAt: z.ZodString;
        updatedAt: z.ZodString;
        completedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const RecordOnboardingEventSchema: z.ZodObject<{
    eventKey: z.ZodEnum<{
        demo_mode_reviewed: "demo_mode_reviewed";
        report_viewed: "report_viewed";
    }>;
}, z.core.$strict>;
export declare const OnboardingApiResponseSchema: z.ZodObject<{
    preferences: z.ZodNullable<z.ZodObject<{
        setupPath: z.ZodEnum<{
            agency: "agency";
            business: "business";
            join: "join";
        }>;
        draft: z.ZodObject<{
            businessDescription: z.ZodOptional<z.ZodString>;
            primaryRegion: z.ZodOptional<z.ZodString>;
            mainOffering: z.ZodOptional<z.ZodString>;
            marketingObjective: z.ZodOptional<z.ZodString>;
            campaignGoal: z.ZodOptional<z.ZodEnum<{
                website_traffic: "website_traffic";
                lead_generation: "lead_generation";
                sales: "sales";
                awareness: "awareness";
                engagement: "engagement";
                app_promotion: "app_promotion";
            }>>;
            platformFormat: z.ZodOptional<z.ZodEnum<{
                google_ads: "google_ads";
                meta_ads: "meta_ads";
            }>>;
            budgetRange: z.ZodOptional<z.ZodEnum<{
                under_500: "under_500";
                "500_2000": "500_2000";
                "2000_5000": "2000_5000";
                "5000_plus": "5000_plus";
                not_sure: "not_sure";
            }>>;
            audience: z.ZodOptional<z.ZodString>;
            brandTone: z.ZodOptional<z.ZodEnum<{
                clear: "clear";
                warm: "warm";
                confident: "confident";
                playful: "playful";
                premium: "premium";
                expert: "expert";
            }>>;
            ctaPreference: z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                warm: "warm";
                confident: "confident";
                direct: "direct";
                minimal: "minimal";
            }>>;
            businessName: z.ZodOptional<z.ZodString>;
            industryKey: z.ZodOptional<z.ZodString>;
            industryCustomLabel: z.ZodOptional<z.ZodString>;
            websiteUrl: z.ZodOptional<z.ZodString>;
            countryCode: z.ZodOptional<z.ZodString>;
            timezone: z.ZodOptional<z.ZodString>;
            currentStep: z.ZodOptional<z.ZodNumber>;
            requestId: z.ZodOptional<z.ZodString>;
            createdWorkspaceId: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        updatedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WorkspaceOnboardingApiResponseSchema: z.ZodObject<{
    onboarding: z.ZodNullable<z.ZodObject<{
        workspaceId: z.ZodString;
        setupData: z.ZodObject<{
            businessDescription: z.ZodOptional<z.ZodString>;
            primaryRegion: z.ZodOptional<z.ZodString>;
            mainOffering: z.ZodOptional<z.ZodString>;
            marketingObjective: z.ZodOptional<z.ZodString>;
            campaignGoal: z.ZodOptional<z.ZodEnum<{
                website_traffic: "website_traffic";
                lead_generation: "lead_generation";
                sales: "sales";
                awareness: "awareness";
                engagement: "engagement";
                app_promotion: "app_promotion";
            }>>;
            platformFormat: z.ZodOptional<z.ZodEnum<{
                google_ads: "google_ads";
                meta_ads: "meta_ads";
            }>>;
            budgetRange: z.ZodOptional<z.ZodEnum<{
                under_500: "under_500";
                "500_2000": "500_2000";
                "2000_5000": "2000_5000";
                "5000_plus": "5000_plus";
                not_sure: "not_sure";
            }>>;
            audience: z.ZodOptional<z.ZodString>;
            brandTone: z.ZodOptional<z.ZodEnum<{
                clear: "clear";
                warm: "warm";
                confident: "confident";
                playful: "playful";
                premium: "premium";
                expert: "expert";
            }>>;
            ctaPreference: z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                warm: "warm";
                confident: "confident";
                direct: "direct";
                minimal: "minimal";
            }>>;
        }, z.core.$strict>;
        currentStep: z.ZodNumber;
        lastCompletedStep: z.ZodNumber;
        startedAt: z.ZodString;
        lastActiveAt: z.ZodString;
        completedAt: z.ZodNullable<z.ZodString>;
        updatedAt: z.ZodString;
        version: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ProductTourProgressApiResponseSchema: z.ZodObject<{
    progress: z.ZodArray<z.ZodObject<{
        tourId: z.ZodString;
        workspaceId: z.ZodString;
        stepIndex: z.ZodNumber;
        status: z.ZodEnum<{
            skipped: "skipped";
            completed: "completed";
            running: "running";
        }>;
        startedAt: z.ZodString;
        updatedAt: z.ZodString;
        completedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const PlatformTourProgressInputSchema: z.ZodObject<{
    tourId: z.ZodLiteral<"platform-operator">;
    stepIndex: z.ZodNumber;
    status: z.ZodEnum<{
        skipped: "skipped";
        completed: "completed";
        running: "running";
    }>;
}, z.core.$strict>;
export declare const PlatformTourProgressStateSchema: z.ZodObject<{
    tourId: z.ZodLiteral<"platform-operator">;
    stepIndex: z.ZodNumber;
    status: z.ZodEnum<{
        skipped: "skipped";
        completed: "completed";
        running: "running";
    }>;
    startedAt: z.ZodString;
    updatedAt: z.ZodString;
    completedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const PlatformTourProgressApiResponseSchema: z.ZodObject<{
    progress: z.ZodNullable<z.ZodObject<{
        tourId: z.ZodLiteral<"platform-operator">;
        stepIndex: z.ZodNumber;
        status: z.ZodEnum<{
            skipped: "skipped";
            completed: "completed";
            running: "running";
        }>;
        startedAt: z.ZodString;
        updatedAt: z.ZodString;
        completedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const RecordOnboardingEventResponseSchema: z.ZodObject<{
    recorded: z.ZodBoolean;
}, z.core.$strip>;
export type PlatformTourProgressInput = z.infer<typeof PlatformTourProgressInputSchema>;
export type PlatformTourProgressState = z.infer<typeof PlatformTourProgressStateSchema>;
export declare const INDUSTRY_ONBOARDING_GUIDANCE: Record<string, {
    goal: string;
    example: string;
    care?: string;
}>;
export type OnboardingPath = z.infer<typeof OnboardingPathSchema>;
export type OnboardingSetupData = z.infer<typeof OnboardingSetupDataSchema>;
export type UserOnboardingPreferencesInput = z.infer<typeof UserOnboardingPreferencesInputSchema>;
export type WorkspaceActivationResponse = z.infer<typeof WorkspaceActivationResponseSchema>;
//# sourceMappingURL=onboarding.d.ts.map