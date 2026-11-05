import { createClient } from "@supabase/supabase-js";
import { BrandKitInputSchema, BrandKitSchema, CreativeAssetSchema, CreativeProjectSchema, } from "@ai-ads/shared";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
export function defaultBrandKit(workspaceId, workspace) {
    const industry = typeof workspace?.industry_key === "string" ? workspace.industry_key : "other";
    return BrandKitSchema.parse({
        workspaceId,
        displayName: typeof workspace?.name === "string" ? workspace.name : "Workspace brand",
        tagline: "",
        mainMessage: "",
        description: "",
        primaryColor: "#23304A",
        secondaryColor: "#8297F5",
        accentColors: [],
        backgroundPreferences: ["#101827", "#F6F8FC"],
        savedPalettes: [],
        headingFont: "Inter",
        bodyFont: "Inter",
        tone: "clear",
        ctaStyle: "direct",
        website: typeof workspace?.website_url === "string" ? workspace.website_url : null,
        socialHandles: {},
        industry,
        industryLabel: typeof workspace?.industry_custom_label === "string" ? workspace.industry_custom_label : null,
        logoAssetId: null,
        alternateLogoAssetId: null,
        revision: 1,
        updatedAt: null,
    });
}
function mapError(error) {
    if (error?.code === "42501")
        throw new HttpError(403, "creative_forbidden", "Your workspace role cannot perform this creative action.");
    if (error?.code === "P0002")
        throw new HttpError(404, "creative_not_found", "The requested creative was not found.");
    if (error?.code === "40001")
        throw new HttpError(409, "creative_revision_conflict", "This creative changed while you were editing. Reload the latest revision.");
    if (error?.code === "23503" || error?.code === "23514" || error?.code === "22023")
        throw new HttpError(400, "creative_reference_invalid", "The creative or asset reference is invalid for this workspace.");
    if (error?.code === "23505")
        throw new HttpError(409, "creative_already_linked", "This creative is already attached to the campaign.");
    throw new HttpError(503, "creative_storage_unavailable", "Creative storage is temporarily unavailable.");
}
function rowObject(value) {
    const row = Array.isArray(value) ? value[0] : value;
    if (!row || typeof row !== "object")
        throw new HttpError(503, "creative_response_invalid", "Creative storage returned an invalid response.");
    return row;
}
function listObjects(value) {
    return Array.isArray(value) ? value.filter((row) => Boolean(row) && typeof row === "object") : [];
}
function assetFromRow(row, signedUrl) {
    return CreativeAssetSchema.parse({
        id: row.id, workspaceId: row.workspace_id, type: row.asset_type,
        originalFilename: row.original_filename, mimeType: row.mime_type, sizeBytes: row.size_bytes,
        width: row.width, height: row.height, uploaderId: row.uploader_user_id,
        tags: row.tags ?? [], archivedAt: row.archived_at, createdAt: row.created_at,
        signedUrl: signedUrl ?? null,
    });
}
function projectFromRow(row, campaignIds = []) {
    return CreativeProjectSchema.parse({
        id: row.id, workspaceId: row.workspace_id, name: row.name, document: row.document,
        status: row.lifecycle_status, revision: row.revision, approvedRevision: row.approved_revision,
        industry: row.industry_key, platform: row.platform, templateKey: row.template_key,
        campaignIds, createdBy: row.created_by_user_id, createdAt: row.created_at, updatedAt: row.updated_at,
    });
}
export function createSupabaseCreativeRepository(accessToken, apiConfig = config) {
    if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY)
        return null;
    const client = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: "Bearer " + accessToken } },
    });
    async function sign(path) {
        const { data, error } = await client.storage.from("workspace-creative-assets").createSignedUrl(path, 300);
        if (error || !data?.signedUrl)
            mapError(error);
        return data.signedUrl;
    }
    async function assetsForProjectRows(workspaceId, rows) {
        const ids = rows.map((row) => row.id).filter((id) => typeof id === "string");
        if (!ids.length)
            return new Map();
        const { data, error } = await client.from("creative_campaign_links").select("creative_id,campaign_id").eq("workspace_id", workspaceId).in("creative_id", ids);
        if (error)
            mapError(error);
        const map = new Map();
        for (const item of listObjects(data)) {
            const creativeId = String(item.creative_id);
            map.set(creativeId, [...(map.get(creativeId) ?? []), String(item.campaign_id)]);
        }
        return map;
    }
    return {
        async getRole(workspaceId, userId) {
            const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
            if (error)
                mapError(error);
            return typeof data?.role === "string" ? data.role : null;
        },
        async getWorkspace(workspaceId) {
            const { data, error } = await client.from("workspaces").select("id,name,industry_key,industry_custom_label,website_url").eq("id", workspaceId).maybeSingle();
            if (error)
                mapError(error);
            return data;
        },
        async getBrandKit(workspaceId) {
            const { data, error } = await client.from("workspace_brand_kits").select("*").eq("workspace_id", workspaceId).maybeSingle();
            if (error)
                mapError(error);
            if (!data)
                return null;
            const row = data;
            return BrandKitSchema.parse({
                workspaceId: row.workspace_id, displayName: row.display_name, tagline: row.tagline,
                mainMessage: row.main_message, description: row.description, primaryColor: row.primary_color,
                secondaryColor: row.secondary_color, accentColors: row.accent_colors, backgroundPreferences: row.background_preferences,
                savedPalettes: row.saved_palettes, headingFont: row.heading_font, bodyFont: row.body_font,
                tone: row.tone, ctaStyle: row.cta_style, website: row.website, socialHandles: row.social_handles,
                industry: row.industry_key, industryLabel: row.industry_custom_label,
                logoAssetId: row.logo_asset_id, alternateLogoAssetId: row.alternate_logo_asset_id,
                revision: row.revision, updatedAt: row.updated_at,
            });
        },
        async saveBrandKit(workspaceId, userId, input) {
            const valid = BrandKitInputSchema.parse(input);
            const row = {
                workspace_id: workspaceId, display_name: valid.displayName, tagline: valid.tagline, main_message: valid.mainMessage,
                description: valid.description, primary_color: valid.primaryColor, secondary_color: valid.secondaryColor,
                accent_colors: valid.accentColors, background_preferences: valid.backgroundPreferences, saved_palettes: valid.savedPalettes,
                heading_font: valid.headingFont, body_font: valid.bodyFont, tone: valid.tone, cta_style: valid.ctaStyle,
                website: valid.website, social_handles: valid.socialHandles, industry_key: valid.industry, industry_custom_label: valid.industryLabel,
                logo_asset_id: valid.logoAssetId, alternate_logo_asset_id: valid.alternateLogoAssetId, updated_by_user_id: userId,
            };
            const { data, error } = await client.from("workspace_brand_kits").upsert(row, { onConflict: "workspace_id" }).select("*").single();
            if (error)
                mapError(error);
            const saved = data;
            return BrandKitSchema.parse({
                workspaceId: saved.workspace_id, displayName: saved.display_name, tagline: saved.tagline,
                mainMessage: saved.main_message, description: saved.description, primaryColor: saved.primary_color,
                secondaryColor: saved.secondary_color, accentColors: saved.accent_colors, backgroundPreferences: saved.background_preferences,
                savedPalettes: saved.saved_palettes, headingFont: saved.heading_font, bodyFont: saved.body_font, tone: saved.tone,
                ctaStyle: saved.cta_style, website: saved.website, socialHandles: saved.social_handles,
                industry: saved.industry_key, industryLabel: saved.industry_custom_label, logoAssetId: saved.logo_asset_id,
                alternateLogoAssetId: saved.alternate_logo_asset_id, revision: saved.revision, updatedAt: saved.updated_at,
            });
        },
        async listAssets(workspaceId, options) {
            let query = client.from("creative_assets").select("*", { count: "exact" }).eq("workspace_id", workspaceId).eq("asset_status", options.archived ? "archived" : "active");
            if (options.type)
                query = query.eq("asset_type", options.type);
            if (options.search)
                query = query.ilike("original_filename", "%" + options.search.replace(/[%_]/g, "\\$&") + "%");
            const { data, error, count } = await query.order("created_at", { ascending: false }).range((options.page - 1) * options.pageSize, options.page * options.pageSize - 1);
            if (error)
                mapError(error);
            const rows = listObjects(data);
            const assets = await Promise.all(rows.map(async (row) => {
                const url = await sign(String(row.storage_path));
                return assetFromRow(row, url);
            }));
            return { assets, total: count ?? 0 };
        },
        async getAsset(workspaceId, assetId) {
            const { data, error } = await client.from("creative_assets").select("*").eq("workspace_id", workspaceId).eq("id", assetId).maybeSingle();
            if (error)
                mapError(error);
            return data;
        },
        async assetReferenced(workspaceId, assetId) {
            const [projects, brand] = await Promise.all([
                client.from("creative_project_assets").select("creative_id").eq("workspace_id", workspaceId).eq("asset_id", assetId).limit(1),
                client.from("workspace_brand_kits").select("workspace_id").eq("workspace_id", workspaceId).or("logo_asset_id.eq." + assetId + ",alternate_logo_asset_id.eq." + assetId).limit(1),
            ]);
            if (projects.error)
                mapError(projects.error);
            if (brand.error)
                mapError(brand.error);
            return Boolean(projects.data?.length || brand.data?.length);
        },
        async archiveAsset(workspaceId, assetId) {
            const { error } = await client.from("creative_assets").update({ asset_status: "archived", archived_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", assetId);
            if (error)
                mapError(error);
        },
        signedAssetUrl: sign,
        async listProjects(workspaceId, options) {
            let ids;
            if (options.campaignId) {
                const { data, error } = await client.from("creative_campaign_links").select("creative_id").eq("workspace_id", workspaceId).eq("campaign_id", options.campaignId);
                if (error)
                    mapError(error);
                ids = listObjects(data).map((row) => String(row.creative_id));
                if (!ids.length)
                    return { projects: [], total: 0 };
            }
            let query = client.from("creative_projects").select("*", { count: "exact" }).eq("workspace_id", workspaceId);
            if (options.search)
                query = query.ilike("name", "%" + options.search.replace(/[%_]/g, "\\$&") + "%");
            if (options.platform)
                query = query.eq("platform", options.platform);
            if (options.status)
                query = query.eq("lifecycle_status", options.status);
            if (options.aspect)
                query = query.eq("aspect_bucket", options.aspect);
            if (ids)
                query = query.in("id", ids);
            const sort = options.sort === "name" ? "name" : options.sort === "created" ? "created_at" : "updated_at";
            const { data, error, count } = await query.order(sort, { ascending: options.sort === "name" }).range((options.page - 1) * options.pageSize, options.page * options.pageSize - 1);
            if (error)
                mapError(error);
            const rows = listObjects(data);
            const links = await assetsForProjectRows(workspaceId, rows);
            return { projects: rows.map((row) => projectFromRow(row, links.get(String(row.id)) ?? [])), total: count ?? 0 };
        },
        async getProject(workspaceId, creativeId) {
            const { data, error } = await client.from("creative_projects").select("*").eq("workspace_id", workspaceId).eq("id", creativeId).maybeSingle();
            if (error)
                mapError(error);
            if (!data)
                return null;
            const links = await assetsForProjectRows(workspaceId, [data]);
            return projectFromRow(data, links.get(creativeId) ?? []);
        },
        async createProject(workspaceId, input) {
            const { data, error } = await client.rpc("create_creative_project", { p_workspace_id: workspaceId, p_name: input.name, p_document: input.document, p_industry: input.industry, p_platform: input.platform, p_template_key: input.templateKey });
            if (error)
                mapError(error);
            return projectFromRow(rowObject(data));
        },
        async saveProject(workspaceId, creativeId, expectedRevision, input) {
            const { data, error } = await client.rpc("save_creative_project", { p_workspace_id: workspaceId, p_creative_id: creativeId, p_expected_revision: expectedRevision, p_name: input.name, p_document: input.document, p_industry: input.industry, p_platform: input.platform, p_template_key: input.templateKey });
            if (error)
                mapError(error);
            return projectFromRow(rowObject(data));
        },
        async duplicateProject(workspaceId, creativeId, name) {
            const source = await this.getProject(workspaceId, creativeId);
            if (!source)
                throw new HttpError(404, "creative_not_found", "The requested creative was not found.");
            return this.createProject(workspaceId, { name, document: source.document, industry: source.industry, platform: source.platform, templateKey: source.templateKey });
        },
        async setArchived(workspaceId, creativeId, expectedRevision, archived) {
            const { data, error } = await client.rpc("set_creative_project_archived", { p_workspace_id: workspaceId, p_creative_id: creativeId, p_expected_revision: expectedRevision, p_archived: archived });
            if (error)
                mapError(error);
            return projectFromRow(rowObject(data));
        },
        async reviewProject(workspaceId, creativeId, expectedRevision, decision, comments) {
            const { data, error } = await client.rpc("review_creative_project", { p_workspace_id: workspaceId, p_creative_id: creativeId, p_expected_revision: expectedRevision, p_decision: decision, p_comments: comments });
            if (error)
                mapError(error);
            return projectFromRow(rowObject(data));
        },
        async listRevisions(workspaceId, creativeId) {
            const { data, error } = await client.from("creative_project_revisions").select("*").eq("workspace_id", workspaceId).eq("creative_id", creativeId).order("revision", { ascending: false }).limit(100);
            if (error)
                mapError(error);
            return listObjects(data);
        },
        async listReviews(workspaceId, creativeId) {
            const { data, error } = await client.from("creative_project_reviews").select("*").eq("workspace_id", workspaceId).eq("creative_id", creativeId).order("created_at", { ascending: false }).limit(100);
            if (error)
                mapError(error);
            return listObjects(data);
        },
        async attachCampaign(workspaceId, campaignId, creativeId, _userId) {
            const { error } = await client.from("creative_campaign_links").insert({ workspace_id: workspaceId, campaign_id: campaignId, creative_id: creativeId });
            if (error)
                mapError(error);
        },
        async detachCampaign(workspaceId, campaignId, creativeId) {
            const { error } = await client.from("creative_campaign_links").delete().eq("workspace_id", workspaceId).eq("campaign_id", campaignId).eq("creative_id", creativeId);
            if (error)
                mapError(error);
        },
        async getCampaignCreativeLinks(workspaceId, campaignId) {
            const { data, error } = await client.from("creative_campaign_links").select("creative_id").eq("workspace_id", workspaceId).eq("campaign_id", campaignId);
            if (error)
                mapError(error);
            const ids = listObjects(data).map((row) => String(row.creative_id));
            if (!ids.length)
                return [];
            const { data: projects, error: projectsError } = await client.from("creative_projects").select("*").eq("workspace_id", workspaceId).in("id", ids);
            if (projectsError)
                mapError(projectsError);
            const rows = listObjects(projects);
            const links = await assetsForProjectRows(workspaceId, rows);
            return rows.map((row) => projectFromRow(row, links.get(String(row.id)) ?? []));
        },
    };
}
