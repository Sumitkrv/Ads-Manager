import { z } from "zod";
export declare const OptimizationMetricSchema: z.ZodObject<{
    impressions: z.ZodNumber;
    clicks: z.ZodNumber;
    conversions: z.ZodNumber;
    spend: z.ZodNumber;
    currency: z.ZodString;
    ctr: z.ZodNullable<z.ZodNumber>;
    cpc: z.ZodNullable<z.ZodNumber>;
    cpm: z.ZodNullable<z.ZodNumber>;
    cpa: z.ZodNullable<z.ZodNumber>;
    roas: z.ZodNullable<z.ZodNumber>;
    conversionRate: z.ZodNullable<z.ZodNumber>;
    budgetUtilization: z.ZodNullable<z.ZodNumber>;
    days: z.ZodNumber;
    simulatedAt: z.ZodString;
    label: z.ZodLiteral<"Simulated Data — Not Actual Ad Performance">;
}, z.core.$strip>;
export declare const OptimizationRecommendationStatusSchema: z.ZodEnum<{
    rejected: "rejected";
    approved: "approved";
    new: "new";
    reviewed: "reviewed";
    applied_to_demo: "applied_to_demo";
    dismissed: "dismissed";
    superseded: "superseded";
}>;
export declare const OptimizationRecommendationSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    campaignId: z.ZodString;
    campaignName: z.ZodString;
    campaignRevision: z.ZodNumber;
    platform: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    category: z.ZodEnum<{
        creative: "creative";
        audience: "audience";
        budget: "budget";
        targeting: "targeting";
        schedule: "schedule";
        keyword_structure: "keyword_structure";
        performance_trend: "performance_trend";
        campaign_configuration: "campaign_configuration";
    }>;
    priority: z.ZodEnum<{
        low: "low";
        high: "high";
        medium: "medium";
        critical: "critical";
    }>;
    type: z.ZodString;
    status: z.ZodEnum<{
        rejected: "rejected";
        approved: "approved";
        new: "new";
        reviewed: "reviewed";
        applied_to_demo: "applied_to_demo";
        dismissed: "dismissed";
        superseded: "superseded";
    }>;
    title: z.ZodString;
    detected: z.ZodString;
    evidence: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    proposedAction: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    tradeoffs: z.ZodArray<z.ZodString>;
    evidenceLimitations: z.ZodArray<z.ZodString>;
    confidence: z.ZodEnum<{
        low: "low";
        high: "high";
        medium: "medium";
    }>;
    version: z.ZodNumber;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const OptimizationRecommendationsResponseSchema: z.ZodObject<{
    recommendations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        campaignId: z.ZodString;
        campaignName: z.ZodString;
        campaignRevision: z.ZodNumber;
        platform: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        category: z.ZodEnum<{
            creative: "creative";
            audience: "audience";
            budget: "budget";
            targeting: "targeting";
            schedule: "schedule";
            keyword_structure: "keyword_structure";
            performance_trend: "performance_trend";
            campaign_configuration: "campaign_configuration";
        }>;
        priority: z.ZodEnum<{
            low: "low";
            high: "high";
            medium: "medium";
            critical: "critical";
        }>;
        type: z.ZodString;
        status: z.ZodEnum<{
            rejected: "rejected";
            approved: "approved";
            new: "new";
            reviewed: "reviewed";
            applied_to_demo: "applied_to_demo";
            dismissed: "dismissed";
            superseded: "superseded";
        }>;
        title: z.ZodString;
        detected: z.ZodString;
        evidence: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        proposedAction: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        tradeoffs: z.ZodArray<z.ZodString>;
        evidenceLimitations: z.ZodArray<z.ZodString>;
        confidence: z.ZodEnum<{
            low: "low";
            high: "high";
            medium: "medium";
        }>;
        version: z.ZodNumber;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, z.core.$strip>;
export declare const RecommendationDecisionSchema: z.ZodObject<{
    action: z.ZodEnum<{
        reject: "reject";
        review: "review";
        approve: "approve";
        dismiss: "dismiss";
        apply_demo: "apply_demo";
    }>;
    expectedVersion: z.ZodNumber;
    comments: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const BudgetScenarioInputSchema: z.ZodObject<{
    campaignId: z.ZodString;
    name: z.ZodString;
    adjustment: z.ZodEnum<{
        absolute: "absolute";
        percentage: "percentage";
    }>;
    proposedBudget: z.ZodNumber;
}, z.core.$strict>;
export declare const BudgetScenarioSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    campaignId: z.ZodString;
    campaignName: z.ZodString;
    campaignRevision: z.ZodNumber;
    version: z.ZodNumber;
    name: z.ZodString;
    currency: z.ZodString;
    budgetType: z.ZodEnum<{
        daily: "daily";
        lifetime: "lifetime";
    }>;
    currentBudget: z.ZodNumber;
    proposedBudget: z.ZodNumber;
    adjustment: z.ZodEnum<{
        absolute: "absolute";
        percentage: "percentage";
    }>;
    baseline: z.ZodNullable<z.ZodObject<{
        impressions: z.ZodNumber;
        clicks: z.ZodNumber;
        conversions: z.ZodNumber;
        spend: z.ZodNumber;
        currency: z.ZodString;
        ctr: z.ZodNullable<z.ZodNumber>;
        cpc: z.ZodNullable<z.ZodNumber>;
        cpm: z.ZodNullable<z.ZodNumber>;
        cpa: z.ZodNullable<z.ZodNumber>;
        roas: z.ZodNullable<z.ZodNumber>;
        conversionRate: z.ZodNullable<z.ZodNumber>;
        budgetUtilization: z.ZodNullable<z.ZodNumber>;
        days: z.ZodNumber;
        simulatedAt: z.ZodString;
        label: z.ZodLiteral<"Simulated Data — Not Actual Ad Performance">;
    }, z.core.$strip>>;
    projection: z.ZodNullable<z.ZodObject<{
        impressions: z.ZodNumber;
        clicks: z.ZodNumber;
        conversions: z.ZodNumber;
        spend: z.ZodNumber;
        currency: z.ZodString;
        ctr: z.ZodNullable<z.ZodNumber>;
        cpc: z.ZodNullable<z.ZodNumber>;
        cpm: z.ZodNullable<z.ZodNumber>;
        cpa: z.ZodNullable<z.ZodNumber>;
        roas: z.ZodNullable<z.ZodNumber>;
        conversionRate: z.ZodNullable<z.ZodNumber>;
        budgetUtilization: z.ZodNullable<z.ZodNumber>;
        days: z.ZodNumber;
        simulatedAt: z.ZodString;
        label: z.ZodLiteral<"Simulated Data — Not Actual Ad Performance">;
    }, z.core.$strip>>;
    assumptions: z.ZodArray<z.ZodString>;
    status: z.ZodEnum<{
        draft: "draft";
        rejected: "rejected";
        approved: "approved";
        needs_approval: "needs_approval";
        applied: "applied";
        stale: "stale";
    }>;
    createdAt: z.ZodString;
    approvedAt: z.ZodNullable<z.ZodString>;
    appliedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const BudgetScenariosResponseSchema: z.ZodObject<{
    scenarios: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        campaignId: z.ZodString;
        campaignName: z.ZodString;
        campaignRevision: z.ZodNumber;
        version: z.ZodNumber;
        name: z.ZodString;
        currency: z.ZodString;
        budgetType: z.ZodEnum<{
            daily: "daily";
            lifetime: "lifetime";
        }>;
        currentBudget: z.ZodNumber;
        proposedBudget: z.ZodNumber;
        adjustment: z.ZodEnum<{
            absolute: "absolute";
            percentage: "percentage";
        }>;
        baseline: z.ZodNullable<z.ZodObject<{
            impressions: z.ZodNumber;
            clicks: z.ZodNumber;
            conversions: z.ZodNumber;
            spend: z.ZodNumber;
            currency: z.ZodString;
            ctr: z.ZodNullable<z.ZodNumber>;
            cpc: z.ZodNullable<z.ZodNumber>;
            cpm: z.ZodNullable<z.ZodNumber>;
            cpa: z.ZodNullable<z.ZodNumber>;
            roas: z.ZodNullable<z.ZodNumber>;
            conversionRate: z.ZodNullable<z.ZodNumber>;
            budgetUtilization: z.ZodNullable<z.ZodNumber>;
            days: z.ZodNumber;
            simulatedAt: z.ZodString;
            label: z.ZodLiteral<"Simulated Data — Not Actual Ad Performance">;
        }, z.core.$strip>>;
        projection: z.ZodNullable<z.ZodObject<{
            impressions: z.ZodNumber;
            clicks: z.ZodNumber;
            conversions: z.ZodNumber;
            spend: z.ZodNumber;
            currency: z.ZodString;
            ctr: z.ZodNullable<z.ZodNumber>;
            cpc: z.ZodNullable<z.ZodNumber>;
            cpm: z.ZodNullable<z.ZodNumber>;
            cpa: z.ZodNullable<z.ZodNumber>;
            roas: z.ZodNullable<z.ZodNumber>;
            conversionRate: z.ZodNullable<z.ZodNumber>;
            budgetUtilization: z.ZodNullable<z.ZodNumber>;
            days: z.ZodNumber;
            simulatedAt: z.ZodString;
            label: z.ZodLiteral<"Simulated Data — Not Actual Ad Performance">;
        }, z.core.$strip>>;
        assumptions: z.ZodArray<z.ZodString>;
        status: z.ZodEnum<{
            draft: "draft";
            rejected: "rejected";
            approved: "approved";
            needs_approval: "needs_approval";
            applied: "applied";
            stale: "stale";
        }>;
        createdAt: z.ZodString;
        approvedAt: z.ZodNullable<z.ZodString>;
        appliedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const AutomationConditionSchema: z.ZodObject<{
    metric: z.ZodEnum<{
        spend: "spend";
        impressions: "impressions";
        clicks: "clicks";
        ctr: "ctr";
        cpc: "cpc";
        cpm: "cpm";
        conversions: "conversions";
        cpa: "cpa";
        roas: "roas";
        budget_utilization: "budget_utilization";
    }>;
    operator: z.ZodEnum<{
        lt: "lt";
        lte: "lte";
        eq: "eq";
        gte: "gte";
        gt: "gt";
    }>;
    threshold: z.ZodNumber;
}, z.core.$strip>;
export declare const AutomationRuleDefinitionSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    trigger: z.ZodLiteral<"manual">;
    conditionLogic: z.ZodEnum<{
        any: "any";
        all: "all";
    }>;
    conditions: z.ZodArray<z.ZodObject<{
        metric: z.ZodEnum<{
            spend: "spend";
            impressions: "impressions";
            clicks: "clicks";
            ctr: "ctr";
            cpc: "cpc";
            cpm: "cpm";
            conversions: "conversions";
            cpa: "cpa";
            roas: "roas";
            budget_utilization: "budget_utilization";
        }>;
        operator: z.ZodEnum<{
            lt: "lt";
            lte: "lte";
            eq: "eq";
            gte: "gte";
            gt: "gt";
        }>;
        threshold: z.ZodNumber;
    }, z.core.$strip>>;
    action: z.ZodEnum<{
        create_recommendation: "create_recommendation";
        create_review_task: "create_review_task";
        flag_campaign: "flag_campaign";
        propose_demo_budget: "propose_demo_budget";
        suggest_creative_variation: "suggest_creative_variation";
        append_activity: "append_activity";
    }>;
    approvalRequired: z.ZodBoolean;
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
    budgetAdjustmentPercent: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const AutomationRuleInputSchema: z.ZodObject<{
    name: z.ZodString;
    definition: z.ZodObject<{
        version: z.ZodLiteral<1>;
        trigger: z.ZodLiteral<"manual">;
        conditionLogic: z.ZodEnum<{
            any: "any";
            all: "all";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            metric: z.ZodEnum<{
                spend: "spend";
                impressions: "impressions";
                clicks: "clicks";
                ctr: "ctr";
                cpc: "cpc";
                cpm: "cpm";
                conversions: "conversions";
                cpa: "cpa";
                roas: "roas";
                budget_utilization: "budget_utilization";
            }>;
            operator: z.ZodEnum<{
                lt: "lt";
                lte: "lte";
                eq: "eq";
                gte: "gte";
                gt: "gt";
            }>;
            threshold: z.ZodNumber;
        }, z.core.$strip>>;
        action: z.ZodEnum<{
            create_recommendation: "create_recommendation";
            create_review_task: "create_review_task";
            flag_campaign: "flag_campaign";
            propose_demo_budget: "propose_demo_budget";
            suggest_creative_variation: "suggest_creative_variation";
            append_activity: "append_activity";
        }>;
        approvalRequired: z.ZodBoolean;
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
        budgetAdjustmentPercent: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    expectedVersion: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const AutomationRuleSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    definition: z.ZodObject<{
        version: z.ZodLiteral<1>;
        trigger: z.ZodLiteral<"manual">;
        conditionLogic: z.ZodEnum<{
            any: "any";
            all: "all";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            metric: z.ZodEnum<{
                spend: "spend";
                impressions: "impressions";
                clicks: "clicks";
                ctr: "ctr";
                cpc: "cpc";
                cpm: "cpm";
                conversions: "conversions";
                cpa: "cpa";
                roas: "roas";
                budget_utilization: "budget_utilization";
            }>;
            operator: z.ZodEnum<{
                lt: "lt";
                lte: "lte";
                eq: "eq";
                gte: "gte";
                gt: "gt";
            }>;
            threshold: z.ZodNumber;
        }, z.core.$strip>>;
        action: z.ZodEnum<{
            create_recommendation: "create_recommendation";
            create_review_task: "create_review_task";
            flag_campaign: "flag_campaign";
            propose_demo_budget: "propose_demo_budget";
            suggest_creative_variation: "suggest_creative_variation";
            append_activity: "append_activity";
        }>;
        approvalRequired: z.ZodBoolean;
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
        budgetAdjustmentPercent: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
    version: z.ZodNumber;
    enabled: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const AutomationRulesResponseSchema: z.ZodObject<{
    rules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        definition: z.ZodObject<{
            version: z.ZodLiteral<1>;
            trigger: z.ZodLiteral<"manual">;
            conditionLogic: z.ZodEnum<{
                any: "any";
                all: "all";
            }>;
            conditions: z.ZodArray<z.ZodObject<{
                metric: z.ZodEnum<{
                    spend: "spend";
                    impressions: "impressions";
                    clicks: "clicks";
                    ctr: "ctr";
                    cpc: "cpc";
                    cpm: "cpm";
                    conversions: "conversions";
                    cpa: "cpa";
                    roas: "roas";
                    budget_utilization: "budget_utilization";
                }>;
                operator: z.ZodEnum<{
                    lt: "lt";
                    lte: "lte";
                    eq: "eq";
                    gte: "gte";
                    gt: "gt";
                }>;
                threshold: z.ZodNumber;
            }, z.core.$strip>>;
            action: z.ZodEnum<{
                create_recommendation: "create_recommendation";
                create_review_task: "create_review_task";
                flag_campaign: "flag_campaign";
                propose_demo_budget: "propose_demo_budget";
                suggest_creative_variation: "suggest_creative_variation";
                append_activity: "append_activity";
            }>;
            approvalRequired: z.ZodBoolean;
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
            budgetAdjustmentPercent: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
        version: z.ZodNumber;
        enabled: z.ZodBoolean;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const AutomationRunInputSchema: z.ZodObject<{
    campaignId: z.ZodString;
    idempotencyKey: z.ZodString;
    previewOnly: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const AutomationExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    ruleId: z.ZodString;
    campaignId: z.ZodString;
    ruleVersion: z.ZodNumber;
    trigger: z.ZodString;
    matched: z.ZodBoolean;
    result: z.ZodEnum<{
        rejected: "rejected";
        approved: "approved";
        applied: "applied";
        evaluated: "evaluated";
        awaiting_approval: "awaiting_approval";
        failed: "failed";
        skipped: "skipped";
    }>;
    inputSnapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    actionProposal: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    errorCode: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const AutomationExecutionsResponseSchema: z.ZodObject<{
    executions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        ruleId: z.ZodString;
        campaignId: z.ZodString;
        ruleVersion: z.ZodNumber;
        trigger: z.ZodString;
        matched: z.ZodBoolean;
        result: z.ZodEnum<{
            rejected: "rejected";
            approved: "approved";
            applied: "applied";
            evaluated: "evaluated";
            awaiting_approval: "awaiting_approval";
            failed: "failed";
            skipped: "skipped";
        }>;
        inputSnapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        actionProposal: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        errorCode: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, z.core.$strip>;
export declare const AutomationExecutionDecisionSchema: z.ZodObject<{
    decision: z.ZodEnum<{
        reject: "reject";
        approve: "approve";
        apply: "apply";
    }>;
    expectedVersion: z.ZodNumber;
    expectedRuleVersion: z.ZodNumber;
    comments: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export declare const WorkspaceNotificationSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    campaignId: z.ZodNullable<z.ZodString>;
    notificationType: z.ZodEnum<{
        optimization_opportunity: "optimization_opportunity";
        rule_execution: "rule_execution";
        rule_failed: "rule_failed";
        approval_required: "approval_required";
        recommendation_decision: "recommendation_decision";
        campaign_review: "campaign_review";
        demo_threshold: "demo_threshold";
    }>;
    title: z.ZodString;
    body: z.ZodString;
    href: z.ZodNullable<z.ZodString>;
    readAt: z.ZodNullable<z.ZodString>;
    dismissedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const NotificationsResponseSchema: z.ZodObject<{
    notifications: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        campaignId: z.ZodNullable<z.ZodString>;
        notificationType: z.ZodEnum<{
            optimization_opportunity: "optimization_opportunity";
            rule_execution: "rule_execution";
            rule_failed: "rule_failed";
            approval_required: "approval_required";
            recommendation_decision: "recommendation_decision";
            campaign_review: "campaign_review";
            demo_threshold: "demo_threshold";
        }>;
        title: z.ZodString;
        body: z.ZodString;
        href: z.ZodNullable<z.ZodString>;
        readAt: z.ZodNullable<z.ZodString>;
        dismissedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    unread: z.ZodNumber;
}, z.core.$strip>;
export declare const NotificationUpdateSchema: z.ZodObject<{
    action: z.ZodEnum<{
        dismiss: "dismiss";
        unread: "unread";
        read: "read";
    }>;
}, z.core.$strict>;
export type OptimizationMetric = z.infer<typeof OptimizationMetricSchema>;
export type OptimizationRecommendation = z.infer<typeof OptimizationRecommendationSchema>;
export type BudgetScenario = z.infer<typeof BudgetScenarioSchema>;
export type AutomationRuleDefinition = z.infer<typeof AutomationRuleDefinitionSchema>;
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
export type AutomationExecution = z.infer<typeof AutomationExecutionSchema>;
//# sourceMappingURL=optimization.d.ts.map