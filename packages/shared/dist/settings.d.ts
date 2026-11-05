import { z } from "zod";
export declare const ThemePreferenceSchema: z.ZodEnum<{
    light: "light";
    dark: "dark";
    system: "system";
}>;
export declare const UserNotificationPreferencesSchema: z.ZodObject<{
    campaign_reviews: z.ZodBoolean;
    creative_reviews: z.ZodBoolean;
    automation_activity: z.ZodBoolean;
    usage_limit_alerts: z.ZodBoolean;
    subscription_events: z.ZodBoolean;
    agency_collaboration: z.ZodBoolean;
    client_approvals: z.ZodBoolean;
    team_invitations: z.ZodBoolean;
    support_cases: z.ZodBoolean;
}, z.core.$strict>;
export declare const UserPreferencesSchema: z.ZodObject<{
    themePreference: z.ZodEnum<{
        light: "light";
        dark: "dark";
        system: "system";
    }>;
    preferredLanguage: z.ZodLiteral<"en">;
    timezone: z.ZodString;
    dateFormat: z.ZodEnum<{
        local: "local";
        iso: "iso";
        mdy: "mdy";
        dmy: "dmy";
    }>;
    timeFormat: z.ZodEnum<{
        "12h": "12h";
        "24h": "24h";
    }>;
    displayCurrency: z.ZodString;
    notifications: z.ZodObject<{
        campaign_reviews: z.ZodBoolean;
        creative_reviews: z.ZodBoolean;
        automation_activity: z.ZodBoolean;
        usage_limit_alerts: z.ZodBoolean;
        subscription_events: z.ZodBoolean;
        agency_collaboration: z.ZodBoolean;
        client_approvals: z.ZodBoolean;
        team_invitations: z.ZodBoolean;
        support_cases: z.ZodBoolean;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const DEFAULT_USER_PREFERENCES: UserPreferences;
export declare const UserPreferencesPatchSchema: z.ZodObject<{
    themePreference: z.ZodOptional<z.ZodEnum<{
        light: "light";
        dark: "dark";
        system: "system";
    }>>;
    preferredLanguage: z.ZodOptional<z.ZodLiteral<"en">>;
    timezone: z.ZodOptional<z.ZodString>;
    dateFormat: z.ZodOptional<z.ZodEnum<{
        local: "local";
        iso: "iso";
        mdy: "mdy";
        dmy: "dmy";
    }>>;
    timeFormat: z.ZodOptional<z.ZodEnum<{
        "12h": "12h";
        "24h": "24h";
    }>>;
    displayCurrency: z.ZodOptional<z.ZodString>;
    notifications: z.ZodOptional<z.ZodObject<{
        campaign_reviews: z.ZodBoolean;
        creative_reviews: z.ZodBoolean;
        automation_activity: z.ZodBoolean;
        usage_limit_alerts: z.ZodBoolean;
        subscription_events: z.ZodBoolean;
        agency_collaboration: z.ZodBoolean;
        client_approvals: z.ZodBoolean;
        team_invitations: z.ZodBoolean;
        support_cases: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const WorkspacePreferencesSchema: z.ZodObject<{
    businessDescription: z.ZodString;
    businessCategory: z.ZodString;
    operatingRegion: z.ZodString;
    defaultCurrency: z.ZodString;
    defaultLandingPage: z.ZodEnum<{
        campaigns: "campaigns";
        overview: "overview";
        analytics: "analytics";
        reports: "reports";
    }>;
    defaultCampaignFormat: z.ZodEnum<{
        google_search: "google_search";
        meta_social: "meta_social";
        mixed: "mixed";
    }>;
    defaultReportDateRange: z.ZodEnum<{
        "7d": "7d";
        "30d": "30d";
        "90d": "90d";
    }>;
    defaultMarketingObjective: z.ZodEnum<{
        traffic: "traffic";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        leads: "leads";
    }>;
    displayDensity: z.ZodEnum<{
        comfortable: "comfortable";
        compact: "compact";
    }>;
}, z.core.$strict>;
export declare const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences;
export declare const WorkspacePreferencesPatchSchema: z.ZodObject<{
    businessDescription: z.ZodOptional<z.ZodString>;
    businessCategory: z.ZodOptional<z.ZodString>;
    operatingRegion: z.ZodOptional<z.ZodString>;
    defaultCurrency: z.ZodOptional<z.ZodString>;
    defaultLandingPage: z.ZodOptional<z.ZodEnum<{
        campaigns: "campaigns";
        overview: "overview";
        analytics: "analytics";
        reports: "reports";
    }>>;
    defaultCampaignFormat: z.ZodOptional<z.ZodEnum<{
        google_search: "google_search";
        meta_social: "meta_social";
        mixed: "mixed";
    }>>;
    defaultReportDateRange: z.ZodOptional<z.ZodEnum<{
        "7d": "7d";
        "30d": "30d";
        "90d": "90d";
    }>>;
    defaultMarketingObjective: z.ZodOptional<z.ZodEnum<{
        traffic: "traffic";
        sales: "sales";
        awareness: "awareness";
        engagement: "engagement";
        leads: "leads";
    }>>;
    displayDensity: z.ZodOptional<z.ZodEnum<{
        comfortable: "comfortable";
        compact: "compact";
    }>>;
}, z.core.$strict>;
export declare const WorkspaceTeamMemberSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    fullName: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    emailVerified: z.ZodBoolean;
    avatarUrl: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
    joinedAt: z.ZodString;
}, z.core.$strict>;
export declare const WorkspaceInvitationSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    relationshipId: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
    status: z.ZodEnum<{
        pending: "pending";
        revoked: "revoked";
        expired: "expired";
        accepted: "accepted";
        declined: "declined";
    }>;
    createdBy: z.ZodString;
    expiresAt: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strict>;
export declare const WorkspaceTeamResponseSchema: z.ZodObject<{
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        fullName: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        emailVerified: z.ZodBoolean;
        avatarUrl: z.ZodNullable<z.ZodString>;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            editor: "editor";
            viewer: "viewer";
        }>;
        joinedAt: z.ZodString;
    }, z.core.$strict>>;
    invitations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        relationshipId: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        role: z.ZodEnum<{
            admin: "admin";
            editor: "editor";
            viewer: "viewer";
        }>;
        status: z.ZodEnum<{
            pending: "pending";
            revoked: "revoked";
            expired: "expired";
            accepted: "accepted";
            declined: "declined";
        }>;
        createdBy: z.ZodString;
        expiresAt: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strict>>;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
    emailDelivery: z.ZodLiteral<"not_emailed">;
}, z.core.$strict>;
export declare const WorkspaceInvitationCreateSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
}, z.core.$strict>;
export declare const WorkspaceMemberRolePatchSchema: z.ZodObject<{
    role: z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
}, z.core.$strict>;
export declare const WorkspaceSettingsAuditSchema: z.ZodObject<{
    id: z.ZodString;
    action: z.ZodString;
    targetUserId: z.ZodNullable<z.ZodString>;
    changedFields: z.ZodArray<z.ZodString>;
    actorUserId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strict>;
export declare const ClosureRequestResponseSchema: z.ZodObject<{
    request: z.ZodObject<{
        id: z.ZodString;
        scope: z.ZodEnum<{
            workspace: "workspace";
            account: "account";
        }>;
        status: z.ZodLiteral<"pending_review">;
        createdAt: z.ZodString;
    }, z.core.$strict>;
    message: z.ZodLiteral<"Request recorded for administrative review. No data was deleted.">;
}, z.core.$strict>;
export type ThemePreferenceValue = z.infer<typeof ThemePreferenceSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserPreferencesPatch = z.infer<typeof UserPreferencesPatchSchema>;
export type WorkspacePreferences = z.infer<typeof WorkspacePreferencesSchema>;
export type WorkspacePreferencesPatch = z.infer<typeof WorkspacePreferencesPatchSchema>;
export type WorkspaceTeamResponse = z.infer<typeof WorkspaceTeamResponseSchema>;
export type WorkspaceInvitationCreateInput = z.infer<typeof WorkspaceInvitationCreateSchema>;
//# sourceMappingURL=settings.d.ts.map