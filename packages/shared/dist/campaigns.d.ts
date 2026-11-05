import { z } from "zod";
export declare const CampaignPlatformSchema: z.ZodEnum<{
    google_ads: "google_ads";
    meta_ads: "meta_ads";
}>;
export declare const CampaignObjectiveSchema: z.ZodEnum<{
    website_traffic: "website_traffic";
    traffic: "traffic";
    lead_generation: "lead_generation";
    sales: "sales";
    awareness: "awareness";
    engagement: "engagement";
    app_promotion: "app_promotion";
}>;
export declare const CampaignStatusSchema: z.ZodEnum<{
    draft: "draft";
    generated_simulation: "generated_simulation";
    needs_review: "needs_review";
    changes_requested: "changes_requested";
    approved_for_demo: "approved_for_demo";
    demo_published: "demo_published";
    archived: "archived";
}>;
export declare const BudgetTypeSchema: z.ZodEnum<{
    daily: "daily";
    lifetime: "lifetime";
}>;
export declare const BrandVoiceSchema: z.ZodEnum<{
    clear: "clear";
    warm: "warm";
    confident: "confident";
    playful: "playful";
    premium: "premium";
    expert: "expert";
}>;
export declare const CampaignBriefSchema: z.ZodObject<{
    businessName: z.ZodString;
    industry: z.ZodEnum<{
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
    industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    productService: z.ZodString;
    businessDescription: z.ZodDefault<z.ZodString>;
    offer: z.ZodDefault<z.ZodString>;
    landingPageUrl: z.ZodString;
    uniqueSellingPoints: z.ZodDefault<z.ZodArray<z.ZodString>>;
    brandVoice: z.ZodDefault<z.ZodEnum<{
        clear: "clear";
        warm: "warm";
        confident: "confident";
        playful: "playful";
        premium: "premium";
        expert: "expert";
    }>>;
    preferredCta: z.ZodString;
    country: z.ZodString;
    regions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    language: z.ZodDefault<z.ZodString>;
    intendedCustomer: z.ZodString;
    audienceDescription: z.ZodDefault<z.ZodString>;
    keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
    interestThemes: z.ZodDefault<z.ZodArray<z.ZodString>>;
    exclusions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    budgetType: z.ZodDefault<z.ZodEnum<{
        daily: "daily";
        lifetime: "lifetime";
    }>>;
    budgetAmount: z.ZodNumber;
    currency: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    budgetRationale: z.ZodDefault<z.ZodString>;
    biddingPreference: z.ZodDefault<z.ZodEnum<{
        maximize_clicks: "maximize_clicks";
        maximize_conversions: "maximize_conversions";
        manual_review: "manual_review";
    }>>;
    tone: z.ZodDefault<z.ZodEnum<{
        clear: "clear";
        warm: "warm";
        confident: "confident";
        playful: "playful";
        premium: "premium";
        expert: "expert";
    }>>;
    mainMessage: z.ZodDefault<z.ZodString>;
    promotionalHook: z.ZodDefault<z.ZodString>;
    brandAttributes: z.ZodDefault<z.ZodArray<z.ZodString>>;
    copyStyle: z.ZodDefault<z.ZodEnum<{
        concise: "concise";
        story: "story";
        benefit_led: "benefit_led";
    }>>;
}, z.core.$strip>;
export declare const KeywordSchema: z.ZodObject<{
    text: z.ZodString;
    matchType: z.ZodEnum<{
        exact: "exact";
        broad: "broad";
        phrase: "phrase";
    }>;
}, z.core.$strip>;
export declare const SearchAdSchema: z.ZodObject<{
    id: z.ZodString;
    headlines: z.ZodArray<z.ZodString>;
    descriptions: z.ZodArray<z.ZodString>;
    finalUrl: z.ZodString;
}, z.core.$strip>;
export declare const GoogleAdGroupSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    keywords: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        matchType: z.ZodEnum<{
            exact: "exact";
            broad: "broad";
            phrase: "phrase";
        }>;
    }, z.core.$strip>>;
    ads: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        headlines: z.ZodArray<z.ZodString>;
        descriptions: z.ZodArray<z.ZodString>;
        finalUrl: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const MetaAdSchema: z.ZodObject<{
    id: z.ZodString;
    primaryText: z.ZodString;
    headline: z.ZodString;
    description: z.ZodString;
    cta: z.ZodString;
    destinationUrl: z.ZodString;
    creativeReference: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const MetaAdSetSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    audience: z.ZodString;
    locations: z.ZodArray<z.ZodString>;
    placements: z.ZodArray<z.ZodEnum<{
        feed: "feed";
        stories: "stories";
        reels: "reels";
        automatic: "automatic";
    }>>;
    budgetAmount: z.ZodNumber;
    budgetType: z.ZodEnum<{
        daily: "daily";
        lifetime: "lifetime";
    }>;
    ads: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        primaryText: z.ZodString;
        headline: z.ZodString;
        description: z.ZodString;
        cta: z.ZodString;
        destinationUrl: z.ZodString;
        creativeReference: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CampaignPlanSchema: z.ZodObject<{
    platform: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    objective: z.ZodEnum<{
        website_traffic: "website_traffic";
        traffic: "traffic";
        lead_generation: "lead_generation";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        app_promotion: "app_promotion";
    }>;
    strategy: z.ZodString;
    audienceSuggestions: z.ZodArray<z.ZodString>;
    creativeSuggestions: z.ZodArray<z.ZodString>;
    warnings: z.ZodArray<z.ZodString>;
    generation: z.ZodObject<{
        mode: z.ZodEnum<{
            simulation: "simulation";
            openai: "openai";
        }>;
        label: z.ZodEnum<{
            "AI Simulation": "AI Simulation";
            "AI Generated Draft": "AI Generated Draft";
        }>;
        version: z.ZodString;
        seed: z.ZodNumber;
        generatedAt: z.ZodString;
        inputSnapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        selectedVariations: z.ZodArray<z.ZodNumber>;
        userModifications: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    google: z.ZodOptional<z.ZodObject<{
        adGroups: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            keywords: z.ZodArray<z.ZodObject<{
                text: z.ZodString;
                matchType: z.ZodEnum<{
                    exact: "exact";
                    broad: "broad";
                    phrase: "phrase";
                }>;
            }, z.core.$strip>>;
            ads: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                headlines: z.ZodArray<z.ZodString>;
                descriptions: z.ZodArray<z.ZodString>;
                finalUrl: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    meta: z.ZodOptional<z.ZodObject<{
        adSets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            audience: z.ZodString;
            locations: z.ZodArray<z.ZodString>;
            placements: z.ZodArray<z.ZodEnum<{
                feed: "feed";
                stories: "stories";
                reels: "reels";
                automatic: "automatic";
            }>>;
            budgetAmount: z.ZodNumber;
            budgetType: z.ZodEnum<{
                daily: "daily";
                lifetime: "lifetime";
            }>;
            ads: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                primaryText: z.ZodString;
                headline: z.ZodString;
                description: z.ZodString;
                cta: z.ZodString;
                destinationUrl: z.ZodString;
                creativeReference: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CampaignSummarySchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    platform: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    objective: z.ZodEnum<{
        website_traffic: "website_traffic";
        traffic: "traffic";
        lead_generation: "lead_generation";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        app_promotion: "app_promotion";
    }>;
    status: z.ZodEnum<{
        draft: "draft";
        generated_simulation: "generated_simulation";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        approved_for_demo: "approved_for_demo";
        demo_published: "demo_published";
        archived: "archived";
    }>;
    revision: z.ZodNumber;
    approvedRevision: z.ZodNullable<z.ZodNumber>;
    generatedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    generationMode: z.ZodDefault<z.ZodEnum<{
        simulation: "simulation";
        openai: "openai";
        none: "none";
    }>>;
    executionMode: z.ZodLiteral<"demo">;
    publishedExternally: z.ZodLiteral<false>;
}, z.core.$strip>;
export declare const CampaignRecordSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    platform: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    objective: z.ZodEnum<{
        website_traffic: "website_traffic";
        traffic: "traffic";
        lead_generation: "lead_generation";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        app_promotion: "app_promotion";
    }>;
    status: z.ZodEnum<{
        draft: "draft";
        generated_simulation: "generated_simulation";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        approved_for_demo: "approved_for_demo";
        demo_published: "demo_published";
        archived: "archived";
    }>;
    revision: z.ZodNumber;
    approvedRevision: z.ZodNullable<z.ZodNumber>;
    generatedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    generationMode: z.ZodDefault<z.ZodEnum<{
        simulation: "simulation";
        openai: "openai";
        none: "none";
    }>>;
    executionMode: z.ZodLiteral<"demo">;
    publishedExternally: z.ZodLiteral<false>;
    brief: z.ZodObject<{
        businessName: z.ZodString;
        industry: z.ZodEnum<{
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
        industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        productService: z.ZodString;
        businessDescription: z.ZodDefault<z.ZodString>;
        offer: z.ZodDefault<z.ZodString>;
        landingPageUrl: z.ZodString;
        uniqueSellingPoints: z.ZodDefault<z.ZodArray<z.ZodString>>;
        brandVoice: z.ZodDefault<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        preferredCta: z.ZodString;
        country: z.ZodString;
        regions: z.ZodDefault<z.ZodArray<z.ZodString>>;
        language: z.ZodDefault<z.ZodString>;
        intendedCustomer: z.ZodString;
        audienceDescription: z.ZodDefault<z.ZodString>;
        keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
        interestThemes: z.ZodDefault<z.ZodArray<z.ZodString>>;
        exclusions: z.ZodDefault<z.ZodArray<z.ZodString>>;
        budgetType: z.ZodDefault<z.ZodEnum<{
            daily: "daily";
            lifetime: "lifetime";
        }>>;
        budgetAmount: z.ZodNumber;
        currency: z.ZodString;
        startDate: z.ZodString;
        endDate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        budgetRationale: z.ZodDefault<z.ZodString>;
        biddingPreference: z.ZodDefault<z.ZodEnum<{
            maximize_clicks: "maximize_clicks";
            maximize_conversions: "maximize_conversions";
            manual_review: "manual_review";
        }>>;
        tone: z.ZodDefault<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        mainMessage: z.ZodDefault<z.ZodString>;
        promotionalHook: z.ZodDefault<z.ZodString>;
        brandAttributes: z.ZodDefault<z.ZodArray<z.ZodString>>;
        copyStyle: z.ZodDefault<z.ZodEnum<{
            concise: "concise";
            story: "story";
            benefit_led: "benefit_led";
        }>>;
    }, z.core.$strip>;
    plan: z.ZodNullable<z.ZodObject<{
        platform: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        objective: z.ZodEnum<{
            website_traffic: "website_traffic";
            traffic: "traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>;
        strategy: z.ZodString;
        audienceSuggestions: z.ZodArray<z.ZodString>;
        creativeSuggestions: z.ZodArray<z.ZodString>;
        warnings: z.ZodArray<z.ZodString>;
        generation: z.ZodObject<{
            mode: z.ZodEnum<{
                simulation: "simulation";
                openai: "openai";
            }>;
            label: z.ZodEnum<{
                "AI Simulation": "AI Simulation";
                "AI Generated Draft": "AI Generated Draft";
            }>;
            version: z.ZodString;
            seed: z.ZodNumber;
            generatedAt: z.ZodString;
            inputSnapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            selectedVariations: z.ZodArray<z.ZodNumber>;
            userModifications: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        google: z.ZodOptional<z.ZodObject<{
            adGroups: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                keywords: z.ZodArray<z.ZodObject<{
                    text: z.ZodString;
                    matchType: z.ZodEnum<{
                        exact: "exact";
                        broad: "broad";
                        phrase: "phrase";
                    }>;
                }, z.core.$strip>>;
                ads: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    headlines: z.ZodArray<z.ZodString>;
                    descriptions: z.ZodArray<z.ZodString>;
                    finalUrl: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        meta: z.ZodOptional<z.ZodObject<{
            adSets: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                audience: z.ZodString;
                locations: z.ZodArray<z.ZodString>;
                placements: z.ZodArray<z.ZodEnum<{
                    feed: "feed";
                    stories: "stories";
                    reels: "reels";
                    automatic: "automatic";
                }>>;
                budgetAmount: z.ZodNumber;
                budgetType: z.ZodEnum<{
                    daily: "daily";
                    lifetime: "lifetime";
                }>;
                ads: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    primaryText: z.ZodString;
                    headline: z.ZodString;
                    description: z.ZodString;
                    cta: z.ZodString;
                    destinationUrl: z.ZodString;
                    creativeReference: z.ZodNullable<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CampaignActivitySchema: z.ZodObject<{
    id: z.ZodString;
    event: z.ZodString;
    actorUserId: z.ZodNullable<z.ZodString>;
    details: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const CampaignListResponseSchema: z.ZodObject<{
    campaigns: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        platform: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        objective: z.ZodEnum<{
            website_traffic: "website_traffic";
            traffic: "traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>;
        status: z.ZodEnum<{
            draft: "draft";
            generated_simulation: "generated_simulation";
            needs_review: "needs_review";
            changes_requested: "changes_requested";
            approved_for_demo: "approved_for_demo";
            demo_published: "demo_published";
            archived: "archived";
        }>;
        revision: z.ZodNumber;
        approvedRevision: z.ZodNullable<z.ZodNumber>;
        generatedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        generationMode: z.ZodDefault<z.ZodEnum<{
            simulation: "simulation";
            openai: "openai";
            none: "none";
        }>>;
        executionMode: z.ZodLiteral<"demo">;
        publishedExternally: z.ZodLiteral<false>;
    }, z.core.$strip>>;
    counts: z.ZodRecord<z.ZodEnum<{
        draft: "draft";
        generated_simulation: "generated_simulation";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        approved_for_demo: "approved_for_demo";
        demo_published: "demo_published";
        archived: "archived";
    }>, z.ZodNumber>;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    total: z.ZodNumber;
}, z.core.$strip>;
export declare const CampaignResponseSchema: z.ZodObject<{
    campaign: z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        platform: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        objective: z.ZodEnum<{
            website_traffic: "website_traffic";
            traffic: "traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>;
        status: z.ZodEnum<{
            draft: "draft";
            generated_simulation: "generated_simulation";
            needs_review: "needs_review";
            changes_requested: "changes_requested";
            approved_for_demo: "approved_for_demo";
            demo_published: "demo_published";
            archived: "archived";
        }>;
        revision: z.ZodNumber;
        approvedRevision: z.ZodNullable<z.ZodNumber>;
        generatedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        generationMode: z.ZodDefault<z.ZodEnum<{
            simulation: "simulation";
            openai: "openai";
            none: "none";
        }>>;
        executionMode: z.ZodLiteral<"demo">;
        publishedExternally: z.ZodLiteral<false>;
        brief: z.ZodObject<{
            businessName: z.ZodString;
            industry: z.ZodEnum<{
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
            industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            productService: z.ZodString;
            businessDescription: z.ZodDefault<z.ZodString>;
            offer: z.ZodDefault<z.ZodString>;
            landingPageUrl: z.ZodString;
            uniqueSellingPoints: z.ZodDefault<z.ZodArray<z.ZodString>>;
            brandVoice: z.ZodDefault<z.ZodEnum<{
                clear: "clear";
                warm: "warm";
                confident: "confident";
                playful: "playful";
                premium: "premium";
                expert: "expert";
            }>>;
            preferredCta: z.ZodString;
            country: z.ZodString;
            regions: z.ZodDefault<z.ZodArray<z.ZodString>>;
            language: z.ZodDefault<z.ZodString>;
            intendedCustomer: z.ZodString;
            audienceDescription: z.ZodDefault<z.ZodString>;
            keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
            interestThemes: z.ZodDefault<z.ZodArray<z.ZodString>>;
            exclusions: z.ZodDefault<z.ZodArray<z.ZodString>>;
            budgetType: z.ZodDefault<z.ZodEnum<{
                daily: "daily";
                lifetime: "lifetime";
            }>>;
            budgetAmount: z.ZodNumber;
            currency: z.ZodString;
            startDate: z.ZodString;
            endDate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            budgetRationale: z.ZodDefault<z.ZodString>;
            biddingPreference: z.ZodDefault<z.ZodEnum<{
                maximize_clicks: "maximize_clicks";
                maximize_conversions: "maximize_conversions";
                manual_review: "manual_review";
            }>>;
            tone: z.ZodDefault<z.ZodEnum<{
                clear: "clear";
                warm: "warm";
                confident: "confident";
                playful: "playful";
                premium: "premium";
                expert: "expert";
            }>>;
            mainMessage: z.ZodDefault<z.ZodString>;
            promotionalHook: z.ZodDefault<z.ZodString>;
            brandAttributes: z.ZodDefault<z.ZodArray<z.ZodString>>;
            copyStyle: z.ZodDefault<z.ZodEnum<{
                concise: "concise";
                story: "story";
                benefit_led: "benefit_led";
            }>>;
        }, z.core.$strip>;
        plan: z.ZodNullable<z.ZodObject<{
            platform: z.ZodEnum<{
                google_ads: "google_ads";
                meta_ads: "meta_ads";
            }>;
            objective: z.ZodEnum<{
                website_traffic: "website_traffic";
                traffic: "traffic";
                lead_generation: "lead_generation";
                sales: "sales";
                awareness: "awareness";
                engagement: "engagement";
                app_promotion: "app_promotion";
            }>;
            strategy: z.ZodString;
            audienceSuggestions: z.ZodArray<z.ZodString>;
            creativeSuggestions: z.ZodArray<z.ZodString>;
            warnings: z.ZodArray<z.ZodString>;
            generation: z.ZodObject<{
                mode: z.ZodEnum<{
                    simulation: "simulation";
                    openai: "openai";
                }>;
                label: z.ZodEnum<{
                    "AI Simulation": "AI Simulation";
                    "AI Generated Draft": "AI Generated Draft";
                }>;
                version: z.ZodString;
                seed: z.ZodNumber;
                generatedAt: z.ZodString;
                inputSnapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                selectedVariations: z.ZodArray<z.ZodNumber>;
                userModifications: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            google: z.ZodOptional<z.ZodObject<{
                adGroups: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                    keywords: z.ZodArray<z.ZodObject<{
                        text: z.ZodString;
                        matchType: z.ZodEnum<{
                            exact: "exact";
                            broad: "broad";
                            phrase: "phrase";
                        }>;
                    }, z.core.$strip>>;
                    ads: z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        headlines: z.ZodArray<z.ZodString>;
                        descriptions: z.ZodArray<z.ZodString>;
                        finalUrl: z.ZodString;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            meta: z.ZodOptional<z.ZodObject<{
                adSets: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                    audience: z.ZodString;
                    locations: z.ZodArray<z.ZodString>;
                    placements: z.ZodArray<z.ZodEnum<{
                        feed: "feed";
                        stories: "stories";
                        reels: "reels";
                        automatic: "automatic";
                    }>>;
                    budgetAmount: z.ZodNumber;
                    budgetType: z.ZodEnum<{
                        daily: "daily";
                        lifetime: "lifetime";
                    }>;
                    ads: z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        primaryText: z.ZodString;
                        headline: z.ZodString;
                        description: z.ZodString;
                        cta: z.ZodString;
                        destinationUrl: z.ZodString;
                        creativeReference: z.ZodNullable<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CampaignWriteSchema: z.ZodObject<{
    name: z.ZodString;
    platform: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    objective: z.ZodEnum<{
        website_traffic: "website_traffic";
        traffic: "traffic";
        lead_generation: "lead_generation";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        app_promotion: "app_promotion";
    }>;
    brief: z.ZodObject<{
        businessName: z.ZodString;
        industry: z.ZodEnum<{
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
        industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        productService: z.ZodString;
        businessDescription: z.ZodDefault<z.ZodString>;
        offer: z.ZodDefault<z.ZodString>;
        landingPageUrl: z.ZodString;
        uniqueSellingPoints: z.ZodDefault<z.ZodArray<z.ZodString>>;
        brandVoice: z.ZodDefault<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        preferredCta: z.ZodString;
        country: z.ZodString;
        regions: z.ZodDefault<z.ZodArray<z.ZodString>>;
        language: z.ZodDefault<z.ZodString>;
        intendedCustomer: z.ZodString;
        audienceDescription: z.ZodDefault<z.ZodString>;
        keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
        interestThemes: z.ZodDefault<z.ZodArray<z.ZodString>>;
        exclusions: z.ZodDefault<z.ZodArray<z.ZodString>>;
        budgetType: z.ZodDefault<z.ZodEnum<{
            daily: "daily";
            lifetime: "lifetime";
        }>>;
        budgetAmount: z.ZodNumber;
        currency: z.ZodString;
        startDate: z.ZodString;
        endDate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        budgetRationale: z.ZodDefault<z.ZodString>;
        biddingPreference: z.ZodDefault<z.ZodEnum<{
            maximize_clicks: "maximize_clicks";
            maximize_conversions: "maximize_conversions";
            manual_review: "manual_review";
        }>>;
        tone: z.ZodDefault<z.ZodEnum<{
            clear: "clear";
            warm: "warm";
            confident: "confident";
            playful: "playful";
            premium: "premium";
            expert: "expert";
        }>>;
        mainMessage: z.ZodDefault<z.ZodString>;
        promotionalHook: z.ZodDefault<z.ZodString>;
        brandAttributes: z.ZodDefault<z.ZodArray<z.ZodString>>;
        copyStyle: z.ZodDefault<z.ZodEnum<{
            concise: "concise";
            story: "story";
            benefit_led: "benefit_led";
        }>>;
    }, z.core.$strip>;
    plan: z.ZodNullable<z.ZodObject<{
        platform: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        objective: z.ZodEnum<{
            website_traffic: "website_traffic";
            traffic: "traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>;
        strategy: z.ZodString;
        audienceSuggestions: z.ZodArray<z.ZodString>;
        creativeSuggestions: z.ZodArray<z.ZodString>;
        warnings: z.ZodArray<z.ZodString>;
        generation: z.ZodObject<{
            mode: z.ZodEnum<{
                simulation: "simulation";
                openai: "openai";
            }>;
            label: z.ZodEnum<{
                "AI Simulation": "AI Simulation";
                "AI Generated Draft": "AI Generated Draft";
            }>;
            version: z.ZodString;
            seed: z.ZodNumber;
            generatedAt: z.ZodString;
            inputSnapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            selectedVariations: z.ZodArray<z.ZodNumber>;
            userModifications: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        google: z.ZodOptional<z.ZodObject<{
            adGroups: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                keywords: z.ZodArray<z.ZodObject<{
                    text: z.ZodString;
                    matchType: z.ZodEnum<{
                        exact: "exact";
                        broad: "broad";
                        phrase: "phrase";
                    }>;
                }, z.core.$strip>>;
                ads: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    headlines: z.ZodArray<z.ZodString>;
                    descriptions: z.ZodArray<z.ZodString>;
                    finalUrl: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        meta: z.ZodOptional<z.ZodObject<{
            adSets: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                audience: z.ZodString;
                locations: z.ZodArray<z.ZodString>;
                placements: z.ZodArray<z.ZodEnum<{
                    feed: "feed";
                    stories: "stories";
                    reels: "reels";
                    automatic: "automatic";
                }>>;
                budgetAmount: z.ZodNumber;
                budgetType: z.ZodEnum<{
                    daily: "daily";
                    lifetime: "lifetime";
                }>;
                ads: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    primaryText: z.ZodString;
                    headline: z.ZodString;
                    description: z.ZodString;
                    cta: z.ZodString;
                    destinationUrl: z.ZodString;
                    creativeReference: z.ZodNullable<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const CampaignListQuerySchema: z.ZodObject<{
    search: z.ZodDefault<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        generated_simulation: "generated_simulation";
        needs_review: "needs_review";
        changes_requested: "changes_requested";
        approved_for_demo: "approved_for_demo";
        demo_published: "demo_published";
        archived: "archived";
    }>>;
    platform: z.ZodOptional<z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>>;
    sort: z.ZodDefault<z.ZodEnum<{
        name: "name";
        updated: "updated";
        created: "created";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const CampaignActionResponseSchema: z.ZodObject<{
    status: z.ZodString;
    message: z.ZodString;
    campaign: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        platform: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        objective: z.ZodEnum<{
            website_traffic: "website_traffic";
            traffic: "traffic";
            lead_generation: "lead_generation";
            sales: "sales";
            awareness: "awareness";
            engagement: "engagement";
            app_promotion: "app_promotion";
        }>;
        status: z.ZodEnum<{
            draft: "draft";
            generated_simulation: "generated_simulation";
            needs_review: "needs_review";
            changes_requested: "changes_requested";
            approved_for_demo: "approved_for_demo";
            demo_published: "demo_published";
            archived: "archived";
        }>;
        revision: z.ZodNumber;
        approvedRevision: z.ZodNullable<z.ZodNumber>;
        generatedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        generationMode: z.ZodDefault<z.ZodEnum<{
            simulation: "simulation";
            openai: "openai";
            none: "none";
        }>>;
        executionMode: z.ZodLiteral<"demo">;
        publishedExternally: z.ZodLiteral<false>;
        brief: z.ZodObject<{
            businessName: z.ZodString;
            industry: z.ZodEnum<{
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
            industryLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            productService: z.ZodString;
            businessDescription: z.ZodDefault<z.ZodString>;
            offer: z.ZodDefault<z.ZodString>;
            landingPageUrl: z.ZodString;
            uniqueSellingPoints: z.ZodDefault<z.ZodArray<z.ZodString>>;
            brandVoice: z.ZodDefault<z.ZodEnum<{
                clear: "clear";
                warm: "warm";
                confident: "confident";
                playful: "playful";
                premium: "premium";
                expert: "expert";
            }>>;
            preferredCta: z.ZodString;
            country: z.ZodString;
            regions: z.ZodDefault<z.ZodArray<z.ZodString>>;
            language: z.ZodDefault<z.ZodString>;
            intendedCustomer: z.ZodString;
            audienceDescription: z.ZodDefault<z.ZodString>;
            keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
            interestThemes: z.ZodDefault<z.ZodArray<z.ZodString>>;
            exclusions: z.ZodDefault<z.ZodArray<z.ZodString>>;
            budgetType: z.ZodDefault<z.ZodEnum<{
                daily: "daily";
                lifetime: "lifetime";
            }>>;
            budgetAmount: z.ZodNumber;
            currency: z.ZodString;
            startDate: z.ZodString;
            endDate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            budgetRationale: z.ZodDefault<z.ZodString>;
            biddingPreference: z.ZodDefault<z.ZodEnum<{
                maximize_clicks: "maximize_clicks";
                maximize_conversions: "maximize_conversions";
                manual_review: "manual_review";
            }>>;
            tone: z.ZodDefault<z.ZodEnum<{
                clear: "clear";
                warm: "warm";
                confident: "confident";
                playful: "playful";
                premium: "premium";
                expert: "expert";
            }>>;
            mainMessage: z.ZodDefault<z.ZodString>;
            promotionalHook: z.ZodDefault<z.ZodString>;
            brandAttributes: z.ZodDefault<z.ZodArray<z.ZodString>>;
            copyStyle: z.ZodDefault<z.ZodEnum<{
                concise: "concise";
                story: "story";
                benefit_led: "benefit_led";
            }>>;
        }, z.core.$strip>;
        plan: z.ZodNullable<z.ZodObject<{
            platform: z.ZodEnum<{
                google_ads: "google_ads";
                meta_ads: "meta_ads";
            }>;
            objective: z.ZodEnum<{
                website_traffic: "website_traffic";
                traffic: "traffic";
                lead_generation: "lead_generation";
                sales: "sales";
                awareness: "awareness";
                engagement: "engagement";
                app_promotion: "app_promotion";
            }>;
            strategy: z.ZodString;
            audienceSuggestions: z.ZodArray<z.ZodString>;
            creativeSuggestions: z.ZodArray<z.ZodString>;
            warnings: z.ZodArray<z.ZodString>;
            generation: z.ZodObject<{
                mode: z.ZodEnum<{
                    simulation: "simulation";
                    openai: "openai";
                }>;
                label: z.ZodEnum<{
                    "AI Simulation": "AI Simulation";
                    "AI Generated Draft": "AI Generated Draft";
                }>;
                version: z.ZodString;
                seed: z.ZodNumber;
                generatedAt: z.ZodString;
                inputSnapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                selectedVariations: z.ZodArray<z.ZodNumber>;
                userModifications: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            google: z.ZodOptional<z.ZodObject<{
                adGroups: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                    keywords: z.ZodArray<z.ZodObject<{
                        text: z.ZodString;
                        matchType: z.ZodEnum<{
                            exact: "exact";
                            broad: "broad";
                            phrase: "phrase";
                        }>;
                    }, z.core.$strip>>;
                    ads: z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        headlines: z.ZodArray<z.ZodString>;
                        descriptions: z.ZodArray<z.ZodString>;
                        finalUrl: z.ZodString;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            meta: z.ZodOptional<z.ZodObject<{
                adSets: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                    audience: z.ZodString;
                    locations: z.ZodArray<z.ZodString>;
                    placements: z.ZodArray<z.ZodEnum<{
                        feed: "feed";
                        stories: "stories";
                        reels: "reels";
                        automatic: "automatic";
                    }>>;
                    budgetAmount: z.ZodNumber;
                    budgetType: z.ZodEnum<{
                        daily: "daily";
                        lifetime: "lifetime";
                    }>;
                    ads: z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        primaryText: z.ZodString;
                        headline: z.ZodString;
                        description: z.ZodString;
                        cta: z.ZodString;
                        destinationUrl: z.ZodString;
                        creativeReference: z.ZodNullable<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    attempt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const CampaignIssueSchema: z.ZodObject<{
    severity: z.ZodEnum<{
        error: "error";
        warning: "warning";
        information: "information";
    }>;
    code: z.ZodString;
    message: z.ZodString;
    field: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const CampaignValidationResponseSchema: z.ZodObject<{
    valid: z.ZodBoolean;
    label: z.ZodLiteral<"Passes local draft validation">;
    providerVerified: z.ZodLiteral<false>;
    issues: z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<{
            error: "error";
            warning: "warning";
            information: "information";
        }>;
        code: z.ZodString;
        message: z.ZodString;
        field: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CampaignRoleSchema: z.ZodEnum<{
    owner: "owner";
    admin: "admin";
    editor: "editor";
    viewer: "viewer";
}>;
export type CampaignPlatform = z.infer<typeof CampaignPlatformSchema>;
export type CampaignObjective = z.infer<typeof CampaignObjectiveSchema>;
export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;
export type CampaignPlan = z.infer<typeof CampaignPlanSchema>;
export type CampaignRecord = z.infer<typeof CampaignRecordSchema>;
export type CampaignSummary = z.infer<typeof CampaignSummarySchema>;
export type CampaignIssue = z.infer<typeof CampaignIssueSchema>;
//# sourceMappingURL=campaigns.d.ts.map