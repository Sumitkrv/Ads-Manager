import { z } from "zod";
export declare const AdvertisingProviderSchema: z.ZodEnum<{
    google_ads: "google_ads";
    meta_ads: "meta_ads";
}>;
export type AdvertisingProvider = z.infer<typeof AdvertisingProviderSchema>;
export declare const AdvertisingConnectionStatusSchema: z.ZodEnum<{
    accounts_available: "accounts_available";
    connected: "connected";
    no_accounts: "no_accounts";
    reauthorization_required: "reauthorization_required";
    connection_error: "connection_error";
}>;
export type AdvertisingConnectionStatus = z.infer<typeof AdvertisingConnectionStatusSchema>;
export declare const AdvertisingAccountSchema: z.ZodObject<{
    id: z.ZodString;
    connectionId: z.ZodString;
    provider: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    externalAccountId: z.ZodString;
    name: z.ZodString;
    accountStatus: z.ZodNullable<z.ZodString>;
    currency: z.ZodNullable<z.ZodString>;
    timezone: z.ZodNullable<z.ZodString>;
    isManager: z.ZodNullable<z.ZodBoolean>;
    managerReference: z.ZodNullable<z.ZodString>;
    businessContext: z.ZodNullable<z.ZodString>;
    selected: z.ZodBoolean;
    lastSyncedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type AdvertisingAccount = z.infer<typeof AdvertisingAccountSchema>;
export declare const AdvertisingConnectionSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    provider: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    status: z.ZodEnum<{
        accounts_available: "accounts_available";
        connected: "connected";
        no_accounts: "no_accounts";
        reauthorization_required: "reauthorization_required";
        connection_error: "connection_error";
    }>;
    connectedByUserId: z.ZodString;
    providerIdentityReference: z.ZodNullable<z.ZodString>;
    grantedScopes: z.ZodArray<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    lastErrorCode: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type AdvertisingConnection = z.infer<typeof AdvertisingConnectionSchema>;
export declare const AdvertisingProviderStateSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        google_ads: "google_ads";
        meta_ads: "meta_ads";
    }>;
    displayName: z.ZodString;
    configured: z.ZodBoolean;
    setupRequirements: z.ZodArray<z.ZodString>;
    connection: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        provider: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        status: z.ZodEnum<{
            accounts_available: "accounts_available";
            connected: "connected";
            no_accounts: "no_accounts";
            reauthorization_required: "reauthorization_required";
            connection_error: "connection_error";
        }>;
        connectedByUserId: z.ZodString;
        providerIdentityReference: z.ZodNullable<z.ZodString>;
        grantedScopes: z.ZodArray<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        lastErrorCode: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    accounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        connectionId: z.ZodString;
        provider: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        externalAccountId: z.ZodString;
        name: z.ZodString;
        accountStatus: z.ZodNullable<z.ZodString>;
        currency: z.ZodNullable<z.ZodString>;
        timezone: z.ZodNullable<z.ZodString>;
        isManager: z.ZodNullable<z.ZodBoolean>;
        managerReference: z.ZodNullable<z.ZodString>;
        businessContext: z.ZodNullable<z.ZodString>;
        selected: z.ZodBoolean;
        lastSyncedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdvertisingProviderState = z.infer<typeof AdvertisingProviderStateSchema>;
export declare const AdvertisingIntegrationsResponseSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
    canManage: z.ZodBoolean;
    providers: z.ZodArray<z.ZodObject<{
        provider: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        displayName: z.ZodString;
        configured: z.ZodBoolean;
        setupRequirements: z.ZodArray<z.ZodString>;
        connection: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            workspaceId: z.ZodString;
            provider: z.ZodEnum<{
                google_ads: "google_ads";
                meta_ads: "meta_ads";
            }>;
            status: z.ZodEnum<{
                accounts_available: "accounts_available";
                connected: "connected";
                no_accounts: "no_accounts";
                reauthorization_required: "reauthorization_required";
                connection_error: "connection_error";
            }>;
            connectedByUserId: z.ZodString;
            providerIdentityReference: z.ZodNullable<z.ZodString>;
            grantedScopes: z.ZodArray<z.ZodString>;
            verifiedAt: z.ZodNullable<z.ZodString>;
            lastErrorCode: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>>;
        accounts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            connectionId: z.ZodString;
            provider: z.ZodEnum<{
                google_ads: "google_ads";
                meta_ads: "meta_ads";
            }>;
            externalAccountId: z.ZodString;
            name: z.ZodString;
            accountStatus: z.ZodNullable<z.ZodString>;
            currency: z.ZodNullable<z.ZodString>;
            timezone: z.ZodNullable<z.ZodString>;
            isManager: z.ZodNullable<z.ZodBoolean>;
            managerReference: z.ZodNullable<z.ZodString>;
            businessContext: z.ZodNullable<z.ZodString>;
            selected: z.ZodBoolean;
            lastSyncedAt: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdvertisingIntegrationsResponse = z.infer<typeof AdvertisingIntegrationsResponseSchema>;
export declare const AdvertisingAccountsResponseSchema: z.ZodObject<{
    connection: z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        provider: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        status: z.ZodEnum<{
            accounts_available: "accounts_available";
            connected: "connected";
            no_accounts: "no_accounts";
            reauthorization_required: "reauthorization_required";
            connection_error: "connection_error";
        }>;
        connectedByUserId: z.ZodString;
        providerIdentityReference: z.ZodNullable<z.ZodString>;
        grantedScopes: z.ZodArray<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        lastErrorCode: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    accounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        connectionId: z.ZodString;
        provider: z.ZodEnum<{
            google_ads: "google_ads";
            meta_ads: "meta_ads";
        }>;
        externalAccountId: z.ZodString;
        name: z.ZodString;
        accountStatus: z.ZodNullable<z.ZodString>;
        currency: z.ZodNullable<z.ZodString>;
        timezone: z.ZodNullable<z.ZodString>;
        isManager: z.ZodNullable<z.ZodBoolean>;
        managerReference: z.ZodNullable<z.ZodString>;
        businessContext: z.ZodNullable<z.ZodString>;
        selected: z.ZodBoolean;
        lastSyncedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdvertisingAccountsResponse = z.infer<typeof AdvertisingAccountsResponseSchema>;
export declare const SelectAdvertisingAccountsInputSchema: z.ZodObject<{
    accountIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type SelectAdvertisingAccountsInput = z.infer<typeof SelectAdvertisingAccountsInputSchema>;
export declare const AdvertisingMutationResponseSchema: z.ZodObject<{
    status: z.ZodEnum<{
        ok: "ok";
        pending: "pending";
    }>;
    message: z.ZodString;
}, z.core.$strip>;
export type AdvertisingMutationResponse = z.infer<typeof AdvertisingMutationResponseSchema>;
export declare const AdvertisingAuthorizationStartResponseSchema: z.ZodObject<{
    authorizationUrl: z.ZodString;
}, z.core.$strip>;
export type AdvertisingAuthorizationStartResponse = z.infer<typeof AdvertisingAuthorizationStartResponseSchema>;
//# sourceMappingURL=advertising-integrations.d.ts.map