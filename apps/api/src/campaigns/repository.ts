import { createClient } from "@supabase/supabase-js";
import { CampaignRecordSchema, CampaignSummarySchema, type CampaignPlatform, type CampaignRecord, type CampaignSummary } from "@ai-ads/shared";
import { config, type ApiConfig } from "../config.js";
import { HttpError } from "../errors.js";
import type { DemoMetrics } from "./metrics.js";

export interface CampaignRepository {
  getRole(workspaceId: string, userId: string): Promise<string | null>;
  list(workspaceId: string, options: { search: string; status?: string | undefined; platform?: CampaignPlatform | undefined; sort: string; page: number; pageSize: number }): Promise<{ campaigns: CampaignSummary[]; counts: Record<string, number>; total: number }>;
  get(workspaceId: string, campaignId: string): Promise<CampaignRecord | null>;
  create(workspaceId: string, userId: string, input: Record<string, unknown>): Promise<CampaignRecord>;
  save(workspaceId: string, campaignId: string, expectedRevision: number, input: Record<string, unknown>): Promise<CampaignRecord>;
  duplicate(workspaceId: string, campaignId: string, newName: string): Promise<CampaignRecord>;
  archive(workspaceId: string, campaignId: string): Promise<CampaignRecord>;
  submitReview(workspaceId: string, campaignId: string, revision: number, comments: string): Promise<CampaignRecord>;
  decideReview(workspaceId: string, campaignId: string, decision: string, comments: string): Promise<CampaignRecord>;
  simulatePublish(workspaceId: string, campaignId: string, revision: number, scenario: "success" | "provider_unavailable", seed: number, metrics: DemoMetrics | null): Promise<Record<string, unknown>>;
  activity(workspaceId: string, campaignId: string): Promise<Record<string, unknown>[]>;
  revisions(workspaceId: string, campaignId: string): Promise<Record<string, unknown>[]>;
  reviews(workspaceId: string, campaignId: string): Promise<Record<string, unknown>[]>;
  analytics(workspaceId: string, campaignId: string): Promise<Record<string, unknown>[]>;
  publishingAttempts(workspaceId: string, campaignId: string): Promise<Record<string, unknown>[]>;
}

export type CampaignRepositoryFactory = (accessToken: string) => CampaignRepository | null;

function mapError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "42501") throw new HttpError(403, "campaign_forbidden", "Your workspace role cannot perform this campaign action.");
  if (error?.code === "P0002") throw new HttpError(404, "campaign_not_found", "The requested campaign was not found.");
  if (error?.code === "40001") throw new HttpError(409, "campaign_revision_conflict", "This campaign changed while you were editing. Reload the latest draft and try again.");
  if (error?.code === "22023" || error?.code === "23514" || error?.code === "23503") throw new HttpError(400, "campaign_request_invalid", "The campaign request could not be applied.");
  throw new HttpError(503, "campaign_service_unavailable", "Campaign storage is temporarily unavailable.");
}

function recordFromRow(row: Record<string, unknown>): CampaignRecord {
  const summary = CampaignSummarySchema.parse({
    id: row.id, workspaceId: row.workspace_id, name: row.name, platform: row.platform, objective: row.objective,
    status: row.lifecycle_status, revision: row.revision, approvedRevision: row.approved_revision,
    generatedAt: row.generated_at, createdAt: row.created_at, updatedAt: row.updated_at,
    generationMode: row.generation_mode,
    executionMode: row.execution_mode, publishedExternally: row.published_externally,
  });
  return CampaignRecordSchema.parse({ ...summary, brief: row.brief, plan: row.plan });
}

function summaryFromRow(row: Record<string, unknown>): CampaignSummary {
  return CampaignSummarySchema.parse({
    id: row.id, workspaceId: row.workspace_id, name: row.name, platform: row.platform, objective: row.objective,
    status: row.lifecycle_status, revision: row.revision, approvedRevision: row.approved_revision,
    generatedAt: row.generated_at, createdAt: row.created_at, updatedAt: row.updated_at,
    generationMode: row.generation_mode,
    executionMode: row.execution_mode, publishedExternally: row.published_externally,
  });
}

function singleRow(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") throw new HttpError(503, "campaign_response_invalid", "Campaign storage returned an invalid response.");
  return row as Record<string, unknown>;
}

function listRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

export function createSupabaseCampaignRepository(accessToken: string, apiConfig: ApiConfig = config): CampaignRepository | null {
  if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY) return null;
  const client = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  return {
    async getRole(workspaceId, userId) {
      const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
      if (error) mapError(error);
      return typeof data?.role === "string" ? data.role : null;
    },
    async list(workspaceId, options) {
      const countQuery = (status?: string) => {
        let q = client.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
        if (status) q = q.eq("lifecycle_status", status);
        return q;
      };
      const statusNames = ["draft", "generated_simulation", "needs_review", "changes_requested", "approved_for_demo", "demo_published", "archived"];
      const [countsResults, pageResult] = await Promise.all([
        Promise.all(statusNames.map((status) => countQuery(status))),
        (async () => {
          let query = client.from("campaigns").select("*", { count: "exact" }).eq("workspace_id", workspaceId);
          if (options.search) query = query.ilike("name", `%${options.search.replace(/[%_]/g, "\\$&")}%`);
          if (options.status) query = query.eq("lifecycle_status", options.status);
          if (options.platform) query = query.eq("platform", options.platform);
          const sort = options.sort === "name" ? "name" : options.sort === "created" ? "created_at" : "updated_at";
          query = query.order(sort, { ascending: options.sort === "name" }).range((options.page - 1) * options.pageSize, options.page * options.pageSize - 1);
          return query;
        })(),
      ]);
      const failed = countsResults.find((result) => result.error);
      if (failed?.error) mapError(failed.error);
      if (pageResult.error) mapError(pageResult.error);
      const counts: Record<string, number> = {};
      statusNames.forEach((status, index) => { counts[status] = countsResults[index]?.count ?? 0; });
      return { campaigns: (pageResult.data ?? []).map((row) => summaryFromRow(row)), counts, total: pageResult.count ?? 0 };
    },
    async get(workspaceId, campaignId) {
      const { data, error } = await client.from("campaigns").select("*").eq("workspace_id", workspaceId).eq("id", campaignId).maybeSingle();
      if (error) mapError(error);
      return data ? recordFromRow(data) : null;
    },
    async create(workspaceId, userId, input) {
      void userId;
      const { data, error } = await client.rpc("create_campaign", { p_campaign: { ...input, workspace_id: workspaceId } });
      if (error) mapError(error);
      return recordFromRow(singleRow(data));
    },
    async save(workspaceId, campaignId, expectedRevision, input) {
      const { data, error } = await client.rpc("save_campaign", { p_campaign_id: campaignId, p_workspace_id: workspaceId, p_expected_revision: expectedRevision, p_campaign: input });
      if (error) mapError(error);
      return recordFromRow(singleRow(data));
    },
    async duplicate(workspaceId, campaignId, newName) {
      const { data, error } = await client.rpc("duplicate_campaign", { p_campaign_id: campaignId, p_workspace_id: workspaceId, p_new_name: newName });
      if (error) mapError(error);
      return recordFromRow(singleRow(data));
    },
    async archive(workspaceId, campaignId) {
      const { data, error } = await client.rpc("archive_campaign", { p_campaign_id: campaignId, p_workspace_id: workspaceId });
      if (error) mapError(error);
      return recordFromRow(singleRow(data));
    },
    async submitReview(workspaceId, campaignId, revision, comments) {
      const { data, error } = await client.rpc("submit_campaign_review", { p_campaign_id: campaignId, p_workspace_id: workspaceId, p_expected_revision: revision, p_comments: comments });
      if (error) mapError(error);
      return recordFromRow(singleRow(data));
    },
    async decideReview(workspaceId, campaignId, decision, comments) {
      const { data, error } = await client.rpc("decide_campaign_review", { p_campaign_id: campaignId, p_workspace_id: workspaceId, p_decision: decision, p_comments: comments });
      if (error) mapError(error);
      return recordFromRow(singleRow(data));
    },
    async simulatePublish(workspaceId, campaignId, revision, scenario, seed, metrics) {
      const { data, error } = await client.rpc("simulate_campaign_publish", { p_campaign_id: campaignId, p_workspace_id: workspaceId, p_expected_revision: revision, p_scenario: scenario, p_seed: seed, p_metrics: metrics });
      if (error) mapError(error);
      return singleRow(data);
    },
    async activity(workspaceId, campaignId) {
      const { data, error } = await client.from("campaign_activity").select("id,event_type,actor_user_id,details,created_at").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(100);
      if (error) mapError(error); return listRows(data);
    },
    async revisions(workspaceId, campaignId) {
      const { data, error } = await client.from("campaign_revisions").select("id,revision,name,objective,changed_by_user_id,created_at").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).order("revision", { ascending: false }).limit(100);
      if (error) mapError(error); return listRows(data);
    },
    async reviews(workspaceId, campaignId) {
      const { data, error } = await client.from("campaign_reviews").select("id,draft_revision,decision,reviewer_user_id,comments,created_at").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(100);
      if (error) mapError(error); return listRows(data);
    },
    async analytics(workspaceId, campaignId) {
      const { data, error } = await client.from("demo_campaign_analytics").select("id,publish_attempt_id,scenario,seed,metrics,data_source,simulated_at").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).order("simulated_at", { ascending: false });
      if (error) mapError(error); return listRows(data);
    },
    async publishingAttempts(workspaceId, campaignId) {
      const { data, error } = await client.from("demo_publish_attempts").select("id,status,scenario,failure_code,local_demo_reference,draft_revision,published_externally,created_at,completed_at").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(50);
      if (error) mapError(error); return listRows(data);
    },
  };
}
