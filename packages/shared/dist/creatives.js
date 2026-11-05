import { z } from "zod";
import { IndustryKeySchema } from "./workspace.js";
export const CREATIVE_BUCKET = "workspace-creative-assets";
export const CREATIVE_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const CREATIVE_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const CREATIVE_FONT_FAMILIES = ["Inter", "Arial", "Georgia", "DM Sans", "Space Grotesk", "Playfair Display", "Roboto", "Lato"];
const uuid = z.string().uuid();
const color = z.string().regex(/^#[\da-fA-F]{6}$/);
export const CreativeBackgroundSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("solid"), color }),
    z.object({ kind: z.literal("gradient"), from: color, to: color, angle: z.number().int().min(0).max(360) }),
]);
const elementBase = z.object({
    id: uuid,
    x: z.number().finite().min(-8192).max(16384),
    y: z.number().finite().min(-8192).max(16384),
    width: z.number().finite().min(8).max(16384),
    height: z.number().finite().min(8).max(16384),
    rotation: z.number().finite().min(-180).max(180).default(0),
    opacity: z.number().finite().min(0).max(1).default(1),
    locked: z.boolean().default(false),
});
export const CreativeTextElementSchema = elementBase.extend({
    type: z.literal("text"),
    text: z.string().max(1600),
    fontFamily: z.enum(CREATIVE_FONT_FAMILIES).default("Inter"),
    fontSize: z.number().int().min(8).max(320).default(42),
    fontWeight: z.enum(["400", "500", "600", "700", "800"]).default("600"),
    letterSpacing: z.number().finite().min(-4).max(24).default(0),
    color,
    align: z.enum(["left", "center", "right"]).default("left"),
});
export const CreativeShapeElementSchema = elementBase.extend({
    type: z.literal("shape"),
    shape: z.enum(["rectangle", "circle"]),
    fill: color,
    borderColor: color.nullable().default(null),
    borderWidth: z.number().int().min(0).max(40).default(0),
    radius: z.number().int().min(0).max(400).default(20),
});
export const CreativeImageElementSchema = elementBase.extend({
    type: z.literal("image"),
    assetId: uuid,
    fit: z.enum(["cover", "contain"]).default("cover"),
});
export const CreativeElementSchema = z.discriminatedUnion("type", [
    CreativeTextElementSchema,
    CreativeShapeElementSchema,
    CreativeImageElementSchema,
]);
export const CreativeDocumentSchema = z.object({
    version: z.literal(1),
    width: z.number().int().min(120).max(4096),
    height: z.number().int().min(120).max(4096),
    background: CreativeBackgroundSchema,
    elements: z.array(CreativeElementSchema).max(100),
    generation: z.object({ mode: z.literal("offline"), label: z.literal("Offline Creative Variations"), seed: z.number().int(), style: z.string().trim().min(1).max(80) }).optional(),
}).superRefine((document, ctx) => {
    if (document.width * document.height > 16_000_000) {
        ctx.addIssue({ code: "custom", path: ["width"], message: "Canvas dimensions exceed the safe pixel limit." });
    }
    const ids = new Set();
    document.elements.forEach((element, index) => {
        if (ids.has(element.id))
            ctx.addIssue({ code: "custom", path: ["elements", index, "id"], message: "Layer IDs must be unique." });
        ids.add(element.id);
    });
});
export const CreativeToneSchema = z.enum(["clear", "warm", "confident", "playful", "premium", "expert"]);
export const BrandKitInputSchema = z.object({
    displayName: z.string().trim().min(1).max(120),
    tagline: z.string().trim().max(180).default(""),
    mainMessage: z.string().trim().max(600).default(""),
    description: z.string().trim().max(2000).default(""),
    primaryColor: color,
    secondaryColor: color,
    accentColors: z.array(color).max(6).default([]),
    backgroundPreferences: z.array(color).max(6).default([]),
    savedPalettes: z.array(z.object({ name: z.string().trim().min(1).max(60), colors: z.array(color).min(2).max(8) })).max(12).default([]),
    headingFont: z.enum(CREATIVE_FONT_FAMILIES),
    bodyFont: z.enum(CREATIVE_FONT_FAMILIES),
    tone: CreativeToneSchema,
    ctaStyle: z.enum(["direct", "warm", "minimal", "confident", "custom"]),
    website: z.string().trim().max(2048).url().nullable(),
    socialHandles: z.record(z.string().max(40), z.string().trim().max(120)).default({}),
    industry: IndustryKeySchema,
    industryLabel: z.string().trim().max(100).nullable().default(null),
    logoAssetId: uuid.nullable().default(null),
    alternateLogoAssetId: uuid.nullable().default(null),
}).strict().superRefine((value, ctx) => {
    if (value.industry === "other" && !value.industryLabel?.trim()) {
        ctx.addIssue({ code: "custom", path: ["industryLabel"], message: "Describe this custom industry." });
    }
    for (const [key, handle] of Object.entries(value.socialHandles)) {
        if (!/^[a-zA-Z0-9_.-]+$/.test(key))
            ctx.addIssue({ code: "custom", path: ["socialHandles", key], message: "Use a simple platform name." });
        if (handle.startsWith("http://") || handle.startsWith("https://")) {
            try {
                const parsed = new URL(handle);
                if (!parsed.hostname || parsed.username || parsed.password)
                    throw new Error("invalid");
            }
            catch {
                ctx.addIssue({ code: "custom", path: ["socialHandles", key], message: "Enter a valid public social profile URL." });
            }
        }
    }
});
export const BrandKitSchema = BrandKitInputSchema.extend({
    workspaceId: uuid,
    revision: z.number().int().positive(),
    updatedAt: z.string().datetime({ offset: true }).nullable(),
});
export const CreativeAssetSchema = z.object({
    id: uuid,
    workspaceId: uuid,
    type: z.enum(["logo", "image"]),
    originalFilename: z.string().min(1).max(255),
    mimeType: z.enum(CREATIVE_ASSET_MIME_TYPES),
    sizeBytes: z.number().int().positive().max(CREATIVE_ASSET_MAX_BYTES),
    width: z.number().int().positive().max(8192),
    height: z.number().int().positive().max(8192),
    uploaderId: uuid,
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    archivedAt: z.string().datetime({ offset: true }).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    signedUrl: z.string().url().nullable().optional(),
});
const queryBoolean = z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean());
export const CreativeAssetListQuerySchema = z.object({ search: z.string().trim().max(120).default(""), type: z.enum(["logo", "image"]).optional(), archived: queryBoolean.default(false), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20) });
export const CreativeProjectStatusSchema = z.enum(["draft", "needs_review", "changes_requested", "approved", "archived"]);
export const CreativePlatformSchema = z.enum(["google_ads", "meta_ads"]).nullable();
export const CreativeProjectSchema = z.object({
    id: uuid,
    workspaceId: uuid,
    name: z.string().min(1).max(160),
    document: CreativeDocumentSchema,
    status: CreativeProjectStatusSchema,
    revision: z.number().int().positive(),
    approvedRevision: z.number().int().positive().nullable(),
    industry: IndustryKeySchema,
    platform: CreativePlatformSchema,
    templateKey: z.string().max(80).nullable(),
    campaignIds: z.array(uuid),
    createdBy: uuid,
    updatedAt: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
});
export const CreativeProjectWriteSchema = z.object({
    name: z.string().trim().min(1).max(160),
    document: CreativeDocumentSchema,
    industry: IndustryKeySchema,
    platform: CreativePlatformSchema.default(null),
    templateKey: z.string().trim().max(80).nullable().default(null),
    expectedRevision: z.number().int().positive().optional(),
}).strict();
export const CreativeListQuerySchema = z.object({ search: z.string().trim().max(120).default(""), campaignId: uuid.optional(), platform: z.enum(["google_ads", "meta_ads"]).optional(), status: CreativeProjectStatusSchema.optional(), aspect: z.enum(["square", "portrait", "vertical", "landscape", "custom"]).optional(), sort: z.enum(["updated", "created", "name"]).default("updated"), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(12) });
export const CreativeVariationInputSchema = z.object({
    idempotencyKey: uuid.optional(),
    seed: z.number().int().min(0).max(2_147_483_647).default(1),
    aspectRatio: z.enum(["square", "portrait", "vertical", "landscape"]).default("square"),
    imageAssetId: uuid.nullable().default(null),
    hook: z.string().trim().max(240).default(""),
    industry: IndustryKeySchema.optional(),
    businessName: z.string().trim().max(120).default(""),
    productService: z.string().trim().max(240).default(""),
    offer: z.string().trim().max(300).default(""),
    cta: z.string().trim().max(80).default("Learn more"),
    mainMessage: z.string().trim().max(600).default(""),
    objective: z.string().trim().max(80).default(""),
}).strict();
export const CreativeVariationSchema = z.object({ name: z.string(), style: z.string(), seed: z.number().int(), document: CreativeDocumentSchema, label: z.literal("Offline Creative Variations") });
export const CreativeTemplateSchema = z.object({ key: z.string(), name: z.string(), category: z.string(), description: z.string(), industries: z.array(IndustryKeySchema), document: CreativeDocumentSchema });
export const CreativeReviewInputSchema = z.object({ decision: z.enum(["submitted", "approved", "changes_requested", "reopened"]), comments: z.string().trim().max(4000).default(""), expectedRevision: z.number().int().positive() }).strict();
export const CreativeReviewSchema = z.object({ id: uuid, workspaceId: uuid, creativeId: uuid, revision: z.number().int().positive(), decision: z.enum(["submitted", "approved", "changes_requested", "reopened"]), reviewerId: uuid, comments: z.string(), createdAt: z.string().datetime({ offset: true }) });
export const CreativeRevisionSchema = z.object({ id: uuid, workspaceId: uuid, creativeId: uuid, revision: z.number().int().positive(), name: z.string(), document: CreativeDocumentSchema, status: CreativeProjectStatusSchema, authorId: uuid, createdAt: z.string().datetime({ offset: true }) });
export const BrandKitResponseSchema = z.object({ brandKit: BrandKitSchema });
export const CreativeAssetResponseSchema = z.object({ asset: CreativeAssetSchema });
export const CreativeAssetsResponseSchema = z.object({ assets: z.array(CreativeAssetSchema), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() });
export const CreativeProjectResponseSchema = z.object({ project: CreativeProjectSchema });
export const CreativeProjectsResponseSchema = z.object({ projects: z.array(CreativeProjectSchema), total: z.number().int().nonnegative() });
export const CreativeTemplatesResponseSchema = z.object({ templates: z.array(CreativeTemplateSchema.extend({ placeholder: z.boolean() })), industries: z.array(IndustryKeySchema) });
export const CreativeVariationsResponseSchema = z.object({ mode: z.literal("offline"), label: z.literal("Offline Creative Variations"), variations: z.array(CreativeVariationSchema) });
//# sourceMappingURL=creatives.js.map