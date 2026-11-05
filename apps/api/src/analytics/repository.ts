import { createClient } from "@supabase/supabase-js";
import { CampaignRecordSchema, CampaignSummarySchema, type CampaignRecord } from "@ai-ads/shared";
import { config, type ApiConfig } from "../config.js";
import { HttpError } from "../errors.js";

export type AnalyticsRepository = {
  getRole(workspaceId: string, userId: string): Promise<string | null>;
  workspace(workspaceId: string): Promise<{ id: string; name: string } | null>;
  campaigns(workspaceId: string): Promise<{ rows: CampaignRecord[]; truncated: boolean }>;
  analytics(workspaceId: string): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }>;
  creatives(workspaceId: string): Promise<{ rows: Record<string, unknown>[]; links: Record<string, unknown>[] }>;
  savedViews(workspaceId: string): Promise<Record<string, unknown>[]>;
  saveView(workspaceId: string, id: string | null, version: number | null, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  reports(workspaceId: string): Promise<Record<string, unknown>[]>;
  report(workspaceId: string, reportId: string): Promise<Record<string, unknown> | null>;
  createReport(workspaceId: string, definition: unknown): Promise<Record<string, unknown>>;
  saveReport(workspaceId: string, reportId: string, version: number, definition: unknown): Promise<Record<string, unknown>>;
  duplicateReport(workspaceId: string, reportId: string, name: string | null): Promise<Record<string, unknown>>;
  archiveReport(workspaceId: string, reportId: string, version: number): Promise<Record<string, unknown>>;
  reportHistory(workspaceId: string, reportId: string): Promise<Record<string, unknown>[]>;
  exportHistory(workspaceId: string, reportId: string): Promise<Record<string, unknown>[]>;
  recordExport(workspaceId: string, reportId: string | null, version: number | null, format: string, rowCount: number, bytes: number, sha256: string): Promise<Record<string, unknown>>;
};
export type AnalyticsRepositoryFactory = (accessToken: string) => AnalyticsRepository | null;

function mapError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "42501") throw new HttpError(403, "analytics_forbidden", "Your workspace role cannot perform this reporting action.");
  if (error?.code === "P0002") throw new HttpError(404, "report_not_found", "The requested report was not found.");
  if (error?.code === "40001") throw new HttpError(409, "report_version_conflict", "This report changed. Reload the latest version and try again.");
  if (["22023", "23514", "23503", "23505"].includes(error?.code ?? "")) throw new HttpError(400, "report_request_invalid", "The reporting request could not be saved.");
  throw new HttpError(503, "analytics_service_unavailable", "Analytics storage is temporarily unavailable.");
}
function listRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null) : [];
}
function one(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  if (typeof row !== "object" || row === null) throw new HttpError(503, "analytics_response_invalid", "Reporting storage returned an invalid response.");
  return row as Record<string, unknown>;
}
function campaignFromRow(row: Record<string, unknown>): CampaignRecord {
  const summary = CampaignSummarySchema.parse({
    id: row.id, workspaceId: row.workspace_id, name: row.name, platform: row.platform, objective: row.objective,
    status: row.lifecycle_status, revision: row.revision, approvedRevision: row.approved_revision,
    generatedAt: row.generated_at, createdAt: row.created_at, updatedAt: row.updated_at,
    executionMode: row.execution_mode, publishedExternally: row.published_externally,
  });
  return CampaignRecordSchema.parse({ ...summary, brief: row.brief, plan: row.plan });
}

export function createSupabaseAnalyticsRepository(accessToken: string, apiConfig: ApiConfig = config): AnalyticsRepository | null {
  if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY) return null;
  const client = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const fetchPages = async (makeQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>) => {
    const collected: Record<string, unknown>[] = [];
    let truncated = false;
    for (let page = 0; page < 5; page += 1) {
      const result = await makeQuery(page * 1000, page * 1000 + 999);
      if (result.error) mapError(result.error);
      const pageRows = listRows(result.data);
      collected.push(...pageRows);
      if (pageRows.length < 1000) break;
      if (page === 4) truncated = true;
    }
    return { rows: collected, truncated };
  };
  return {
    async getRole(workspaceId, userId) {
      const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
      if (error) mapError(error);
      return typeof data?.role === "string" ? data.role : null;
    },
    async workspace(workspaceId) {
      const { data, error } = await client.from("workspaces").select("id,name").eq("id", workspaceId).maybeSingle();
      if (error) mapError(error);
      return data && typeof data.id === "string" && typeof data.name === "string" ? { id: data.id, name: data.name } : null;
    },
    async campaigns(workspaceId) {
      const value = await fetchPages((from, to) => client.from("campaigns").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).range(from, to));
      return { rows: value.rows.map((row) => campaignFromRow(row)), truncated: value.truncated };
    },
    async analytics(workspaceId) {
      return fetchPages((from, to) => client.from("demo_campaign_analytics").select("id,workspace_id,campaign_id,scenario,seed,metrics,data_source,simulated_at").eq("workspace_id", workspaceId).eq("data_source", "demo_simulation").order("simulated_at", { ascending: false }).range(from, to));
    },
    async creatives(workspaceId) {
      const [projects, links] = await Promise.all([
        client.from("creative_projects").select("id,name,industry_key,platform,aspect_bucket,lifecycle_status,revision,updated_at,created_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(1000),
        client.from("creative_campaign_links").select("creative_id,campaign_id").eq("workspace_id", workspaceId).limit(2000),
      ]);
      if (projects.error) mapError(projects.error);
      if (links.error) mapError(links.error);
      return { rows: listRows(projects.data), links: listRows(links.data) };
    },
    async savedViews(workspaceId) {
      const { data, error } = await client.from("analytics_saved_views").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("updated_at", { ascending: false }).limit(200);
      if (error) mapError(error);
      return listRows(data);
    },
    async saveView(workspaceId, id, version, input) {
      const { data, error } = await client.rpc("save_analytics_view", {
        p_workspace_id: workspaceId, p_view_id: id, p_expected_version: version,
        p_name: input.name, p_filters: input.filters, p_visible_columns: input.visibleColumns, p_sort_key: input.sort,
      });
      if (error) mapError(error);
      return one(data);
    },
    async reports(workspaceId) {
      const { data, error } = await client.from("report_definitions").select("*").eq("workspace_id", workspaceId).eq("status", "active").order("updated_at", { ascending: false }).limit(200);
      if (error) mapError(error);
      return listRows(data);
    },
    async report(workspaceId, reportId) {
      const { data, error } = await client.from("report_definitions").select("*").eq("workspace_id", workspaceId).eq("id", reportId).eq("status", "active").maybeSingle();
      if (error) mapError(error);
      return data ? data as Record<string, unknown> : null;
    },
    async createReport(workspaceId, definition) {
      const { data, error } = await client.rpc("create_report_definition", { p_workspace_id: workspaceId, p_definition: definition });
      if (error) mapError(error);
      return one(data);
    },
    async saveReport(workspaceId, reportId, version, definition) {
      const { data, error } = await client.rpc("save_report_definition", { p_workspace_id: workspaceId, p_report_id: reportId, p_expected_version: version, p_definition: definition });
      if (error) mapError(error);
      return one(data);
    },
    async duplicateReport(workspaceId, reportId, name) {
      const { data, error } = await client.rpc("duplicate_report_definition", { p_workspace_id: workspaceId, p_report_id: reportId, p_name: name });
      if (error) mapError(error);
      return one(data);
    },
    async archiveReport(workspaceId, reportId, version) {
      const { data, error } = await client.rpc("archive_report_definition", { p_workspace_id: workspaceId, p_report_id: reportId, p_expected_version: version });
      if (error) mapError(error);
      return one(data);
    },
    async reportHistory(workspaceId, reportId) {
      const { data, error } = await client.from("report_revisions").select("id,report_id,version,name,authored_by_user_id,created_at").eq("workspace_id", workspaceId).eq("report_id", reportId).order("version", { ascending: false }).limit(100);
      if (error) mapError(error);
      return listRows(data);
    },
    async exportHistory(workspaceId, reportId) {
      const { data, error } = await client.from("report_exports").select("id,report_id,report_version,export_format,row_count,file_bytes,sha256,data_source,generated_by_user_id,created_at").eq("workspace_id", workspaceId).eq("report_id", reportId).order("created_at", { ascending: false }).limit(100);
      if (error) mapError(error);
      return listRows(data);
    },
    async recordExport(workspaceId, reportId, version, format, rowCount, bytes, sha256) {
      const { data, error } = await client.rpc("record_report_export", { p_workspace_id: workspaceId, p_report_id: reportId, p_report_version: version, p_format: format, p_row_count: rowCount, p_file_bytes: bytes, p_sha256: sha256 });
      if (error) mapError(error);
      return one(data);
    },
  };
}
