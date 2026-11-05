import { randomUUID } from "node:crypto";
import express from "express";
import sharp from "sharp";
import { z } from "zod";
import { BrandKitInputSchema, CreativeAssetListQuerySchema, CreativeListQuerySchema, CreativeProjectWriteSchema, CreativeReviewInputSchema, CreativeVariationInputSchema, IndustryKeySchema, WorkspaceRoleSchema, hasWorkspacePermission, } from "@ai-ads/shared";
import { config } from "../config.js";
import { createRequireAuthenticatedUser } from "../auth.js";
import { HttpError } from "../errors.js";
import { createSupabaseCreativeRepository, defaultBrandKit } from "./repository.js";
import { INDUSTRY_TEMPLATE_KEYS, OfflineCreativeVariationProvider } from "./generator.js";
import { createCreativeAssetUploadService } from "./asset-upload-service.js";
import { createSupabaseBillingUsageMeter } from "../billing/usage.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const generator = new OfflineCreativeVariationProvider();
const uploadLimit = 5 * 1024 * 1024;
const CreativeNameSchema = z.object({ name: z.string().trim().min(1).max(160) }).strict();
function asyncRoute(handler) {
    return (request, response, next) => { void handler(request, response).catch(next); };
}
function user(response) {
    const result = response.locals.authenticatedUser;
    if (!result)
        throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
    return result;
}
function id(value, field) {
    if (typeof value !== "string" || !UUID.test(value))
        throw new HttpError(400, "creative_id_invalid", field + " is invalid.");
    return value;
}
function repoFor(response, factory) {
    const accessToken = response.locals.authenticatedAccessToken;
    const selected = factory === undefined ? createSupabaseCreativeRepository : factory;
    if (typeof accessToken !== "string" || !selected)
        throw new HttpError(503, "creative_storage_unavailable", "Creative storage is not available.");
    const repo = selected(accessToken);
    if (!repo)
        throw new HttpError(503, "creative_storage_unavailable", "Creative storage is not available.");
    return repo;
}
async function requirePermission(repo, workspaceId, actor, permission) {
    const role = WorkspaceRoleSchema.safeParse(await repo.getRole(workspaceId, actor.id));
    if (!role.success)
        throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
    if (!hasWorkspacePermission(role.data, permission))
        throw new HttpError(403, "creative_forbidden", "Your workspace role cannot perform this creative action.");
    return role.data;
}
function bodyOrError(schema, value, code, message) {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new HttpError(400, code, message);
    return parsed.data;
}
function header(request, name) {
    const value = request.get(name);
    if (!value)
        return "";
    try {
        return decodeURIComponent(value);
    }
    catch {
        throw new HttpError(400, "asset_filename_invalid", "Asset filename is invalid.");
    }
}
function safeFilename(value) {
    if (!value || value.includes("/") || value.includes("\\") || value === "." || value === "..") {
        throw new HttpError(400, "asset_filename_invalid", "Use a filename without path separators.");
    }
    const safe = [...value].filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }).join("").trim().slice(0, 255);
    if (!safe || safe.startsWith("."))
        throw new HttpError(400, "asset_filename_invalid", "Asset filename is invalid.");
    return safe;
}
function supportedFormat(mimeType) {
    if (mimeType === "image/png")
        return "png";
    if (mimeType === "image/jpeg")
        return "jpeg";
    if (mimeType === "image/webp")
        return "webp";
    return null;
}
export function createCreativesRouter(apiConfig = config, verifyToken, dependencies = {}) {
    const router = express.Router();
    const authenticate = createRequireAuthenticatedUser(verifyToken);
    const factory = dependencies.repositoryFactory === undefined ? createSupabaseCreativeRepository : dependencies.repositoryFactory;
    const variations = dependencies.variationProvider ?? generator;
    const usageFactory = dependencies.usageMeterFactory === undefined
        ? (dependencies.repositoryFactory === undefined ? createSupabaseBillingUsageMeter : null)
        : dependencies.usageMeterFactory;
    router.use("/api/workspaces/:workspaceId", (_request, _response, next) => {
        if (apiConfig.CREATIVE_EXECUTION_MODE !== "local")
            return next(new HttpError(503, "local_creative_mode_required", "Creative Studio requires local execution mode."));
        return next();
    });
    router.get("/api/workspaces/:workspaceId/brand-kit", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "brand.read");
        const kit = await repo.getBrandKit(workspace) ?? defaultBrandKit(workspace, await repo.getWorkspace(workspace));
        response.status(200).json({ brandKit: kit });
    }));
    router.put("/api/workspaces/:workspaceId/brand-kit", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "brand.manage");
        const input = bodyOrError(BrandKitInputSchema, request.body, "brand_kit_invalid", "Review the brand kit fields and try again.");
        response.status(200).json({ brandKit: await repo.saveBrandKit(workspace, actor.id, input) });
    }));
    router.get("/api/workspaces/:workspaceId/assets", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "assets.read");
        const query = bodyOrError(CreativeAssetListQuerySchema, request.query, "assets_query_invalid", "Asset filters are invalid.");
        const result = await repo.listAssets(workspace, query);
        response.status(200).json({ ...result, page: query.page, pageSize: query.pageSize });
    }));
    router.post("/api/workspaces/:workspaceId/assets", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "assets.manage");
        if (!Buffer.isBuffer(request.body) || request.body.byteLength < 1)
            throw new HttpError(400, "asset_file_required", "Select a PNG, JPEG or WebP image to upload.");
        if (request.body.byteLength > uploadLimit)
            throw new HttpError(413, "asset_file_too_large", "Images must be 5 MB or smaller.");
        const mimeType = (request.headers["content-type"] ?? "").toString().split(";")[0]?.trim().toLowerCase() ?? "";
        const expectedFormat = supportedFormat(mimeType);
        if (!expectedFormat)
            throw new HttpError(415, "asset_type_unsupported", "Only PNG, JPEG and WebP images are supported. SVG and active file formats are not accepted.");
        const typeHeader = request.get("x-asset-type");
        if (typeHeader !== "logo" && typeHeader !== "image")
            throw new HttpError(400, "asset_type_invalid", "Choose logo or image for this asset.");
        const filename = safeFilename(header(request, "x-asset-filename"));
        try {
            const metadata = await sharp(request.body, { limitInputPixels: 16_000_000, failOn: "error", animated: false }).metadata();
            if (metadata.format !== expectedFormat || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
                throw new HttpError(400, "asset_content_invalid", "The file content does not match a supported still image.");
            }
            if (metadata.width > 8192 || metadata.height > 8192 || metadata.width * metadata.height > 16_000_000) {
                throw new HttpError(400, "asset_dimensions_invalid", "Image dimensions exceed the safe 16-megapixel limit.");
            }
            const normalized = await sharp(request.body, { limitInputPixels: 16_000_000, failOn: "error", animated: false })
                .rotate().toFormat(expectedFormat).toBuffer({ resolveWithObject: true });
            if (!normalized.info.width || !normalized.info.height || normalized.data.byteLength > uploadLimit) {
                throw new HttpError(413, "asset_normalized_image_too_large", "The validated image exceeds the 5 MB storage limit.");
            }
            const uploadFactory = dependencies.uploadServiceFactory ?? createCreativeAssetUploadService;
            const uploader = uploadFactory(apiConfig);
            if (!uploader)
                throw new HttpError(503, "creative_upload_not_configured", "Validated private image uploads require server-side storage configuration.");
            const asset = await uploader.upload({
                workspaceId: workspace, userId: actor.id, assetId: randomUUID(), type: typeHeader,
                filename, mimeType, buffer: normalized.data, width: normalized.info.width, height: normalized.info.height,
            });
            response.status(201).json({ asset });
        }
        catch (error) {
            if (error instanceof HttpError)
                throw error;
            throw new HttpError(400, "asset_decode_failed", "The image could not be decoded safely. Try a valid PNG, JPEG or WebP file.");
        }
    }));
    router.get("/api/workspaces/:workspaceId/assets/:assetId/download", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const assetId = id(request.params.assetId, "Asset ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "assets.read");
        const asset = await repo.getAsset(workspace, assetId);
        if (!asset || asset.asset_status !== "active")
            throw new HttpError(404, "asset_not_found", "The requested asset was not found.");
        response.status(200).json({ url: await repo.signedAssetUrl(String(asset.storage_path)), expiresInSeconds: 300 });
    }));
    router.delete("/api/workspaces/:workspaceId/assets/:assetId", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const assetId = id(request.params.assetId, "Asset ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "assets.manage");
        const uploadFactory = dependencies.uploadServiceFactory ?? createCreativeAssetUploadService;
        const uploader = uploadFactory(apiConfig);
        if (!uploader)
            throw new HttpError(503, "creative_upload_not_configured", "Private image removal requires server-side storage configuration.");
        const asset = await repo.getAsset(workspace, assetId);
        if (!asset)
            throw new HttpError(404, "asset_not_found", "The requested asset was not found.");
        if (asset.asset_status === "active") {
            if (await repo.assetReferenced(workspace, assetId))
                throw new HttpError(409, "asset_in_use", "This asset is still used by a Brand Kit or saved creative.");
            await repo.archiveAsset(workspace, assetId);
        }
        try {
            await uploader.removeObject(String(asset.storage_path));
            response.status(200).json({ archived: true, cleanupPending: false });
        }
        catch {
            response.status(202).json({ archived: true, cleanupPending: true, message: "The asset is archived. Storage cleanup can be retried from the asset library." });
        }
    }));
    router.get("/api/workspaces/:workspaceId/creatives/templates", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.read");
        const industryResult = request.query.industry === undefined ? null : IndustryKeySchema.safeParse(request.query.industry);
        if (request.query.industry !== undefined && !industryResult?.success)
            throw new HttpError(400, "creative_industry_invalid", "The template industry is invalid.");
        const kit = await repo.getBrandKit(workspace);
        const industry = industryResult?.success ? industryResult.data : undefined;
        const list = variations.generateTemplates(industry).map((template, index) => ({
            ...template,
            document: variations.templateDocument(template.key, 1000 + index, kit ?? undefined),
            placeholder: true,
        }));
        response.status(200).json({ templates: list, industries: Object.keys(INDUSTRY_TEMPLATE_KEYS) });
    }));
    router.get("/api/workspaces/:workspaceId/creatives", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.read");
        const query = bodyOrError(CreativeListQuerySchema, request.query, "creatives_query_invalid", "Creative filters are invalid.");
        response.status(200).json(await repo.listProjects(workspace, query));
    }));
    router.post("/api/workspaces/:workspaceId/creatives", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.manage");
        const input = bodyOrError(CreativeProjectWriteSchema, request.body, "creative_invalid", "Review the creative project and try again.");
        const project = await repo.createProject(workspace, input);
        response.status(201).json({ project });
    }));
    router.get("/api/workspaces/:workspaceId/creatives/:creativeId", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.read");
        const project = await repo.getProject(workspace, creative);
        if (!project)
            throw new HttpError(404, "creative_not_found", "The requested creative was not found.");
        response.status(200).json({ project });
    }));
    router.patch("/api/workspaces/:workspaceId/creatives/:creativeId", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.manage");
        const input = bodyOrError(CreativeProjectWriteSchema, request.body, "creative_invalid", "Review the creative project and try again.");
        if (!input.expectedRevision)
            throw new HttpError(400, "creative_revision_required", "Reload the creative and retry with its current revision.");
        const project = await repo.saveProject(workspace, creative, input.expectedRevision, input);
        response.status(200).json({ project });
    }));
    router.post("/api/workspaces/:workspaceId/creatives/:creativeId/duplicate", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.manage");
        const input = bodyOrError(CreativeNameSchema, request.body, "creative_name_invalid", "Provide a name for the duplicate.");
        response.status(201).json({ project: await repo.duplicateProject(workspace, creative, input.name) });
    }));
    router.post("/api/workspaces/:workspaceId/creatives/:creativeId/archive", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.approve");
        const expectedRevision = request.body && typeof request.body.expectedRevision === "number" ? request.body.expectedRevision : 0;
        response.status(200).json({ project: await repo.setArchived(workspace, creative, expectedRevision, true) });
    }));
    router.post("/api/workspaces/:workspaceId/creatives/:creativeId/restore", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.approve");
        const expectedRevision = request.body && typeof request.body.expectedRevision === "number" ? request.body.expectedRevision : 0;
        response.status(200).json({ project: await repo.setArchived(workspace, creative, expectedRevision, false) });
    }));
    router.get("/api/workspaces/:workspaceId/creatives/:creativeId/revisions", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.read");
        if (!await repo.getProject(workspace, creative))
            throw new HttpError(404, "creative_not_found", "The requested creative was not found.");
        response.status(200).json({ revisions: await repo.listRevisions(workspace, creative) });
    }));
    router.post("/api/workspaces/:workspaceId/creatives/:creativeId/revisions/restore", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.manage");
        const revisionNumber = request.body && typeof request.body.revision === "number" ? request.body.revision : 0;
        const current = await repo.getProject(workspace, creative);
        if (!current)
            throw new HttpError(404, "creative_not_found", "The requested creative was not found.");
        const selected = (await repo.listRevisions(workspace, creative)).find((row) => row.revision === revisionNumber);
        if (!selected)
            throw new HttpError(404, "creative_revision_not_found", "The requested revision was not found.");
        const project = await repo.saveProject(workspace, creative, current.revision, {
            name: String(selected.name), document: selected.document, industry: current.industry, platform: current.platform, templateKey: current.templateKey,
        });
        response.status(200).json({ project });
    }));
    router.get("/api/workspaces/:workspaceId/creatives/:creativeId/reviews", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.read");
        if (!await repo.getProject(workspace, creative))
            throw new HttpError(404, "creative_not_found", "The requested creative was not found.");
        response.status(200).json({ reviews: await repo.listReviews(workspace, creative) });
    }));
    router.post("/api/workspaces/:workspaceId/creatives/:creativeId/review", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        const input = bodyOrError(CreativeReviewInputSchema, request.body, "creative_review_invalid", "Review details are invalid.");
        await requirePermission(repo, workspace, actor, input.decision === "submitted" ? "creatives.review" : "creatives.approve");
        response.status(200).json({ project: await repo.reviewProject(workspace, creative, input.expectedRevision, input.decision, input.comments) });
    }));
    router.post("/api/workspaces/:workspaceId/creatives/variations", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.manage");
        const input = bodyOrError(CreativeVariationInputSchema, request.body, "creative_variation_invalid", "Creative variation brief is invalid.");
        const accessToken = response.locals.authenticatedAccessToken;
        const meter = typeof accessToken === "string" ? usageFactory?.(accessToken) : null;
        if (meter)
            await meter.consume(workspace, "creative_variations", input.idempotencyKey ?? randomUUID());
        const kit = await repo.getBrandKit(workspace);
        const workspaceData = await repo.getWorkspace(workspace);
        const industryResult = IndustryKeySchema.safeParse(input.industry ?? kit?.industry ?? workspaceData?.industry_key);
        const industry = industryResult.success ? industryResult.data : "other";
        if (input.imageAssetId) {
            const asset = await repo.getAsset(workspace, input.imageAssetId);
            if (!asset || asset.asset_status !== "active" || asset.asset_type !== "image")
                throw new HttpError(404, "asset_not_found", "The selected image asset was not found.");
        }
        const generated = variations.generateVariations({
            industry, businessName: input.businessName || kit?.displayName || String(workspaceData?.name ?? ""),
            productService: input.productService, offer: input.offer, cta: input.cta,
            mainMessage: input.mainMessage || kit?.mainMessage || "", ...(kit ? { brand: kit } : {}),
            objective: input.objective, aspectRatio: input.aspectRatio, imageAssetId: input.imageAssetId, hook: input.hook, seed: input.seed,
        });
        response.status(200).json({ mode: "offline", label: "Offline Creative Variations", variations: generated });
    }));
    router.get("/api/workspaces/:workspaceId/campaigns/:campaignId/creatives", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const campaign = id(request.params.campaignId, "Campaign ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.read");
        response.status(200).json({ projects: await repo.getCampaignCreativeLinks(workspace, campaign) });
    }));
    router.post("/api/workspaces/:workspaceId/campaigns/:campaignId/creatives/attach", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const campaign = id(request.params.campaignId, "Campaign ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.manage");
        const creative = id(request.body?.creativeId, "Creative ID");
        const project = await repo.getProject(workspace, creative);
        if (!project || project.status === "archived")
            throw new HttpError(404, "creative_not_found", "The requested creative was not found.");
        await repo.attachCampaign(workspace, campaign, creative, actor.id);
        response.status(201).json({ attached: true, project });
    }));
    router.delete("/api/workspaces/:workspaceId/campaigns/:campaignId/creatives/:creativeId", authenticate, asyncRoute(async (request, response) => {
        const workspace = id(request.params.workspaceId, "Workspace ID");
        const campaign = id(request.params.campaignId, "Campaign ID");
        const creative = id(request.params.creativeId, "Creative ID");
        const actor = user(response);
        const repo = repoFor(response, factory);
        await requirePermission(repo, workspace, actor, "creatives.manage");
        await repo.detachCampaign(workspace, campaign, creative);
        response.status(200).json({ detached: true });
    }));
    return router;
}
