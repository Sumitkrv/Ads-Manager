import { z } from "zod";
export const AdvertisingProviderSchema = z.enum(["google_ads", "meta_ads"]);
export const AdvertisingConnectionStatusSchema = z.enum([
    "accounts_available",
    "connected",
    "no_accounts",
    "reauthorization_required",
    "connection_error",
]);
export const AdvertisingAccountSchema = z.object({
    id: z.string().uuid(),
    connectionId: z.string().uuid(),
    provider: AdvertisingProviderSchema,
    externalAccountId: z.string().min(1).max(160),
    name: z.string().min(1).max(300),
    accountStatus: z.string().max(120).nullable(),
    currency: z.string().max(12).nullable(),
    timezone: z.string().max(120).nullable(),
    isManager: z.boolean().nullable(),
    managerReference: z.string().max(160).nullable(),
    businessContext: z.string().max(300).nullable(),
    selected: z.boolean(),
    lastSyncedAt: z.string().datetime({ offset: true }).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
});
export const AdvertisingConnectionSchema = z.object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    provider: AdvertisingProviderSchema,
    status: AdvertisingConnectionStatusSchema,
    connectedByUserId: z.string().uuid(),
    providerIdentityReference: z.string().max(300).nullable(),
    grantedScopes: z.array(z.string().max(200)).max(100),
    verifiedAt: z.string().datetime({ offset: true }).nullable(),
    lastErrorCode: z.string().max(100).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
});
export const AdvertisingProviderStateSchema = z.object({
    provider: AdvertisingProviderSchema,
    displayName: z.string(),
    configured: z.boolean(),
    setupRequirements: z.array(z.string()),
    connection: AdvertisingConnectionSchema.nullable(),
    accounts: z.array(AdvertisingAccountSchema),
});
export const AdvertisingIntegrationsResponseSchema = z.object({
    workspaceId: z.string().uuid(),
    role: z.enum(["owner", "admin", "editor", "viewer"]),
    canManage: z.boolean(),
    providers: z.array(AdvertisingProviderStateSchema).length(2),
});
export const AdvertisingAccountsResponseSchema = z.object({
    connection: AdvertisingConnectionSchema,
    accounts: z.array(AdvertisingAccountSchema),
});
export const SelectAdvertisingAccountsInputSchema = z.object({
    accountIds: z.array(z.string().uuid()).max(100),
}).strict().superRefine((value, context) => {
    if (new Set(value.accountIds).size !== value.accountIds.length) {
        context.addIssue({ code: "custom", path: ["accountIds"], message: "Account selection contains duplicates." });
    }
});
export const AdvertisingMutationResponseSchema = z.object({
    status: z.enum(["ok", "pending"]),
    message: z.string().max(300),
});
export const AdvertisingAuthorizationStartResponseSchema = z.object({
    authorizationUrl: z.string().url(),
});
//# sourceMappingURL=advertising-integrations.js.map