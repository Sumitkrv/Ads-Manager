import { createHash } from "node:crypto";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
  AnalyticsFilterSchema, AnalyticsMetricSchema, AnalyticsSavedViewInputSchema, ReportArchiveInputSchema,
  ReportDefinitionInputSchema, ReportDuplicateInputSchema, ReportExportInputSchema,
  WorkspaceRoleSchema, hasWorkspacePermission,
  type AnalyticsDimension, type AnalyticsFilter, type AnalyticsMetric, type WorkspacePermission,
} from "@ai-ads/shared";
import type { ApiConfig } from "../config.js";
import { createRequireAuthenticatedUser, type AuthenticatedApiUser, type TokenVerifier } from "../auth.js";
import { HttpError } from "../errors.js";
import { campaignRowsCsv, createCsv, createReportPdf, type ExportCampaignRow } from "./exports.js";
import { aggregateMetrics, buildBreakdown, buildDemoFacts, buildInsights, buildTimeSeries, filterFacts, previousRange, resolveDateRange, type DemoFact } from "./engine.js";
import { createSupabaseAnalyticsRepository, type AnalyticsRepository, type AnalyticsRepositoryFactory } from "./repository.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type AnalyticsRouteDependencies = { repositoryFactory?: AnalyticsRepositoryFactory | null };
const SavedViewRouteSchema = AnalyticsSavedViewInputSchema.extend({ id: z.string().uuid().optional() });

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): express.RequestHandler {
  return (request, response, next) => { void handler(request, response).catch(next); };
}
function actor(response: Response): AuthenticatedApiUser {
  const user = response.locals.authenticatedUser as AuthenticatedApiUser | undefined;
  if (!user) throw new HttpError(401, "authentication_required", "A valid authenticated user is required.");
  return user;
}
function parseId(value: unknown, field: string) {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, `invalid_${field}`, `The ${field.replaceAll("_", " ")} is invalid.`);
  return value;
}
function repoFor(response: Response, factory: AnalyticsRepositoryFactory | null | undefined): AnalyticsRepository {
  const token = response.locals.authenticatedAccessToken;
  const selected = factory === undefined ? createSupabaseAnalyticsRepository : factory;
  if (typeof token !== "string" || !selected) throw new HttpError(503, "analytics_service_unavailable", "Analytics storage is not available.");
  const repo = selected(token);
  if (!repo) throw new HttpError(503, "analytics_service_unavailable", "Analytics storage is not available.");
  return repo;
}
async function authorize(repo: AnalyticsRepository, workspaceId: string, user: AuthenticatedApiUser, permission: WorkspacePermission) {
  const parsed = WorkspaceRoleSchema.safeParse(await repo.getRole(workspaceId, user.id));
  if (!parsed.success) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
  if (!hasWorkspacePermission(parsed.data, permission)) throw new HttpError(403, "analytics_forbidden", "Your workspace role cannot perform this reporting action.");
  return parsed.data;
}
function body<T extends z.ZodTypeAny>(schema: T, value: unknown, code: string, message: string): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, code, message);
  return parsed.data as z.infer<T>;
}
function singleQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function parseFilters(query: Request["query"]): AnalyticsFilter {
  const compare = singleQuery(query.comparePrevious);
  if (compare !== undefined && compare !== "true" && compare !== "false") throw new HttpError(400, "analytics_filter_invalid", "The comparison filter is invalid.");
  const raw = AnalyticsFilterSchema.safeParse({
    ...(singleQuery(query.preset) ? { preset: singleQuery(query.preset) } : {}),
    ...(singleQuery(query.from) ? { from: singleQuery(query.from) } : {}),
    ...(singleQuery(query.to) ? { to: singleQuery(query.to) } : {}),
    ...(singleQuery(query.platform) ? { platform: singleQuery(query.platform) } : {}),
    ...(singleQuery(query.campaignId) ? { campaignId: singleQuery(query.campaignId) } : {}),
    ...(singleQuery(query.objective) ? { objective: singleQuery(query.objective) } : {}),
    ...(singleQuery(query.status) ? { status: singleQuery(query.status) } : {}),
    ...(singleQuery(query.industry) ? { industry: singleQuery(query.industry) } : {}),
    ...(singleQuery(query.scenario) ? { scenario: singleQuery(query.scenario) } : {}),
    ...(singleQuery(query.currency) ? { currency: singleQuery(query.currency) } : {}),
    comparePrevious: compare === "true",
  });
  if (!raw.success) throw new HttpError(400, "analytics_filter_invalid", "Review the analytics date range and filters.");
  const { from, to } = raw.data;
  if (from && to && (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > 365) {
    throw new HttpError(400, "analytics_range_too_wide", "Choose a date range of 366 days or fewer.");
  }
  return raw.data;
}
function reportView(row: Record<string, unknown>) {
  return { id: row.id, workspaceId: row.workspace_id, name: row.name, description: row.description, reportType: row.report_type, definition: row.definition, version: row.version, status: row.status, createdBy: row.created_by_user_id, updatedBy: row.updated_by_user_id, createdAt: row.created_at, updatedAt: row.updated_at };
}
function savedView(row: Record<string, unknown>) {
  return { id: row.id, workspaceId: row.workspace_id, name: row.name, filters: row.filters, visibleColumns: row.visible_columns, sort: row.sort_key, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}

type Model = Awaited<ReturnType<typeof loadModel>>;
async function loadModel(repo: AnalyticsRepository, workspaceId: string, filters: AnalyticsFilter) {
  const [workspace, campaignResult, analyticsResult] = await Promise.all([repo.workspace(workspaceId), repo.campaigns(workspaceId), repo.analytics(workspaceId)]);
  if (!workspace) throw new HttpError(404, "workspace_not_found", "The requested workspace was not found.");
  const allCampaigns = campaignResult.rows;
  const facts = buildDemoFacts(allCampaigns, analyticsResult.rows);
  const range = resolveDateRange(filters);
  const currentFacts = filterFacts(facts, filters, range);
  const campaignsMeta = allCampaigns.filter((campaign) =>
    (filters.platform === "all" || campaign.platform === filters.platform)
    && (!filters.campaignId || campaign.id === filters.campaignId)
    && (!filters.objective || campaign.objective === filters.objective)
    && (!filters.status || campaign.status === filters.status)
    && (!filters.industry || campaign.brief.industry === filters.industry));
  const grouped = new Map<string, DemoFact[]>();
  for (const fact of currentFacts) grouped.set(fact.campaignId, [...(grouped.get(fact.campaignId) ?? []), fact]);
  const tableRows: ExportCampaignRow[] = campaignsMeta.filter((campaign) => !filters.scenario || grouped.get(campaign.id)?.some((item) => item.scenario === filters.scenario)).map((campaign) => {
    const factsForCampaign = (grouped.get(campaign.id) ?? []).filter((item) => !filters.currency || item.currency === filters.currency);
    const metrics = aggregateMetrics(factsForCampaign);
    const spend = metrics.spendByCurrency.find((item) => item.currency === campaign.brief.currency);
    return {
      id: campaign.id, updated: campaign.updatedAt, name: campaign.name, platform: campaign.platform, objective: campaign.objective, status: campaign.status, currency: campaign.brief.currency,
      spend: factsForCampaign.length ? spend?.spend ?? 0 : null,
      impressions: factsForCampaign.length ? metrics.impressions : null,
      clicks: factsForCampaign.length ? metrics.clicks : null,
      ctr: factsForCampaign.length ? metrics.ctr : null,
      cpc: factsForCampaign.length ? spend?.cpc ?? null : null,
      cpm: factsForCampaign.length ? spend?.cpm ?? null : null,
      conversions: factsForCampaign.length ? metrics.conversions : null,
      cpa: factsForCampaign.length ? spend?.cpa ?? null : null,
      roas: factsForCampaign.length ? spend?.roas ?? null : null,
    };
  });
  const rangeCampaignCounts = campaignsMeta.filter((campaign) => !filters.scenario || grouped.get(campaign.id)?.some((item) => item.scenario === filters.scenario)).reduce<Record<string, number>>((all, campaign) => {
    all[campaign.status] = (all[campaign.status] ?? 0) + 1;
    return all;
  }, {});
  const currencies = [...new Set(currentFacts.map((fact) => fact.currency))].sort();
  return {
    workspace, campaigns: allCampaigns, facts, range, currentFacts, tableRows, rangeCampaignCounts,
    label: "Simulated Data — Not Actual Ad Performance", source: "DEMO_SIMULATION" as const,
    datasetTruncated: campaignResult.truncated || analyticsResult.truncated,
    filters, currencies,
  };
}

function periodMetrics(model: Model) {
  if (!model.filters.comparePrevious) return null;
  const prior = filterFacts(model.facts, { ...model.filters, preset: "custom", from: undefined, to: undefined, comparePrevious: false }, previousRange(model.range));
  const currentTotals = aggregateMetrics(model.currentFacts);
  const previousTotals = aggregateMetrics(prior);
  const change = (current: number | null, previous: number | null) => current === null || previous === null || previous === 0 ? null : Number(((current / previous - 1) * 100).toFixed(1));
  return {
    current: currentTotals, previous: previousTotals,
    changes: { impressions: change(currentTotals.impressions, previousTotals.impressions), clicks: change(currentTotals.clicks, previousTotals.clicks), conversions: change(currentTotals.conversions, previousTotals.conversions), ctr: change(currentTotals.ctr, previousTotals.ctr) },
    previousRange: previousRange(model.range), source: "DEMO_SIMULATION" as const,
  };
}

function parseMetric(value: unknown): AnalyticsMetric {
  const parsed = typeof value === "string" ? value : "spend";
  const result = AnalyticsMetricSchema.safeParse(parsed);
  if (!result.success) throw new HttpError(400, "analytics_metric_invalid", "Choose a supported analytics metric.");
  return result.data;
}

function exportReportCsv(model: Model, metrics: AnalyticsMetric[], dimensions: AnalyticsDimension[]) {
  const includeCurrency = dimensions.includes("currency") || model.currencies.length > 1;
  const dateDimension = dimensions.includes("date");
  const chosenDimensions = dimensions.length ? dimensions : ["campaign"];
  const dimensionHeaders = chosenDimensions.filter((dimension) => dimension !== "date" || dateDimension).map((dimension) => dimension === "campaign" ? "Campaign" : dimension === "platform" ? "Platform" : dimension === "objective" ? "Objective" : dimension === "industry" ? "Industry" : dimension === "currency" ? "Currency" : dimension === "scenario" ? "Scenario" : "Date (UTC)");
  const headers = [...dimensionHeaders, ...(!chosenDimensions.includes("currency") && includeCurrency ? ["Currency"] : []), ...metrics.map((metric) => metric.toUpperCase().replaceAll("_", " "))];
  const dimensionsForGroup = chosenDimensions.filter((dimension) => dimension !== "date");
  if (dateDimension) {
    const facts = model.currentFacts;
    return createCsv(headers, facts.map((fact) => {
      const dims = dimensionsForGroup.map((dimension) => dimension === "campaign" ? fact.campaignName : dimension === "platform" ? fact.platform : dimension === "objective" ? fact.objective : dimension === "industry" ? fact.industry : dimension === "currency" ? fact.currency : fact.scenario);
      if (!dimensionsForGroup.includes("currency") && includeCurrency) dims.push(fact.currency);
      const ratios = aggregateMetrics([fact]); const currencyGroup = ratios.spendByCurrency[0];
      const values = metrics.map((metric) => metric === "spend" ? fact.spend : metric === "impressions" ? fact.impressions : metric === "clicks" ? fact.clicks : metric === "ctr" ? ratios.ctr : metric === "cpc" ? currencyGroup?.cpc ?? null : metric === "cpm" ? currencyGroup?.cpm ?? null : metric === "conversions" ? fact.conversions : metric === "conversion_rate" ? ratios.conversionRate : metric === "cpa" ? currencyGroup?.cpa ?? null : currencyGroup?.roas ?? null);
      const dateIndex = chosenDimensions.indexOf("date");
      dims.splice(dateIndex < 0 ? dims.length : dateIndex, 0, fact.date);
      return [...dims, ...values];
    }));
  }
  const groups = new Map<string, DemoFact[]>();
  for (const fact of model.currentFacts) {
    const key = JSON.stringify([...dimensionsForGroup.map((dimension) => dimension === "campaign" ? fact.campaignId : dimension === "platform" ? fact.platform : dimension === "objective" ? fact.objective : dimension === "industry" ? fact.industry : dimension === "currency" ? fact.currency : fact.scenario), ...(!dimensionsForGroup.includes("currency") && includeCurrency ? [fact.currency] : [])]);
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  return createCsv(headers, [...groups.values()].map((facts) => {
    const first = facts[0]!; const dims = dimensionsForGroup.map((dimension) => dimension === "campaign" ? first.campaignName : dimension === "platform" ? first.platform : dimension === "objective" ? first.objective : dimension === "industry" ? first.industry : dimension === "currency" ? first.currency : first.scenario);
    if (!dimensionsForGroup.includes("currency") && includeCurrency) dims.push(first.currency);
    const totals = aggregateMetrics(facts); const group = totals.spendByCurrency.length === 1 ? totals.spendByCurrency[0] : undefined;
    const values = metrics.map((metric) => metric === "spend" ? group?.spend ?? null : metric === "impressions" ? totals.impressions : metric === "clicks" ? totals.clicks : metric === "ctr" ? totals.ctr : metric === "cpc" ? group?.cpc ?? null : metric === "cpm" ? group?.cpm ?? null : metric === "conversions" ? totals.conversions : metric === "conversion_rate" ? totals.conversionRate : metric === "cpa" ? group?.cpa ?? null : group?.roas ?? null);
    return [...dims, ...values];
  }));
}

function reportFilters(definition: ReturnType<typeof ReportDefinitionInputSchema.parse>) {
  const policy = definition.dateRangePolicy;
  if (policy.kind === "fixed") return { ...definition.filters, preset: "custom" as const, from: policy.from, to: policy.to, comparePrevious: false };
  return { ...definition.filters, preset: policy.preset, comparePrevious: definition.filters.comparePrevious };
}

export function createAnalyticsRouter(apiConfig: ApiConfig, verifyToken: TokenVerifier | null, dependencies: AnalyticsRouteDependencies = {}): express.Router {
  const router = express.Router();
  const authenticate = createRequireAuthenticatedUser(verifyToken);
  const factory = dependencies.repositoryFactory === undefined ? createSupabaseAnalyticsRepository : dependencies.repositoryFactory;
  const read = async (request: Request, response: Response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id");
    const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "analytics.read");
    return { workspaceId, user, repo, filters: parseFilters(request.query) };
  };

  router.get("/api/workspaces/:workspaceId/analytics/overview", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters } = await read(request, response);
    const model = await loadModel(repo, workspaceId, filters);
    const metric = parseMetric(request.query.metric);
    const current = aggregateMetrics(model.currentFacts);
    const trend = buildTimeSeries(model.currentFacts, metric);
    const platforms = buildBreakdown(model.currentFacts, "platform");
    const previous = periodMetrics(model);
    const demoCampaigns = model.campaigns.filter((campaign) => campaign.status === "demo_published" && !campaign.publishedExternally).length;
    response.status(200).json({
      source: model.source, label: model.label, workspace: model.workspace, timezone: "UTC", filters, dateRange: model.range,
      summary: current, comparison: previous,
      trend, platforms, campaigns: model.tableRows, campaignCounts: model.rangeCampaignCounts,
      operationalCampaignCount: model.campaigns.filter((campaign) => campaign.status !== "archived").length,
      demoPublishedCampaignCount: demoCampaigns, currencies: model.currencies,
      funnel: { source: "DEMO_SIMULATION", label: model.label, stages: [{ name: "Impressions", value: current.impressions }, { name: "Clicks", value: current.clicks }, { name: "Conversions", value: current.conversions }], clickRate: current.ctr, conversionRate: current.conversionRate },
      insights: buildInsights(model.currentFacts), datasetTruncated: model.datasetTruncated,
      campaignListTruncated: model.campaigns.length >= 5000,
      availableFilters: {
        objectives: [...new Set(model.campaigns.map((campaign) => campaign.objective))].sort(),
        statuses: [...new Set(model.campaigns.map((campaign) => campaign.status))].sort(),
        industries: [...new Set(model.campaigns.map((campaign) => campaign.brief.industry))].sort(),
        campaigns: model.campaigns.filter((campaign) => campaign.status !== "archived").map((campaign) => ({ id: campaign.id, name: campaign.name, platform: campaign.platform })),
        currencies: [...new Set(model.facts.map((fact) => fact.currency))].sort(),
      },
    });
  }));

  router.get("/api/workspaces/:workspaceId/analytics/timeseries", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters } = await read(request, response);
    const model = await loadModel(repo, workspaceId, filters);
    const metric = parseMetric(request.query.metric);
    response.status(200).json({ source: model.source, label: model.label, dateRange: model.range, series: buildTimeSeries(model.currentFacts, metric) });
  }));

  router.get("/api/workspaces/:workspaceId/analytics/platforms", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters } = await read(request, response);
    const model = await loadModel(repo, workspaceId, filters);
    response.status(200).json({ source: model.source, label: model.label, platforms: buildBreakdown(model.currentFacts, "platform"), currencies: model.currencies, dateRange: model.range });
  }));

  router.get("/api/workspaces/:workspaceId/analytics/campaigns", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters } = await read(request, response);
    const model = await loadModel(repo, workspaceId, filters);
    const pageValue = Number(singleQuery(request.query.page) ?? 1); const pageSizeValue = Number(singleQuery(request.query.pageSize) ?? 25);
    if (!Number.isInteger(pageValue) || pageValue < 1 || pageValue > 10000 || !Number.isInteger(pageSizeValue) || pageSizeValue < 1 || pageSizeValue > 100) throw new HttpError(400, "analytics_pagination_invalid", "Choose a valid campaign page.");
    const search = (singleQuery(request.query.search) ?? "").trim().slice(0, 120).toLowerCase();
    const rows = model.tableRows.filter((item) => !search || `${item.name} ${item.platform} ${item.objective}`.toLowerCase().includes(search));
    const sort = singleQuery(request.query.sort) ?? "spend";
    const sortKey: keyof ExportCampaignRow = sort === "campaign" ? "name" : sort === "updated" ? "updated" : sort === "impressions" || sort === "clicks" || sort === "ctr" || sort === "cpc" || sort === "cpm" || sort === "conversions" || sort === "cpa" || sort === "roas" ? sort : "spend";
    rows.sort((a, b) => sortKey === "updated" ? String(b.updated).localeCompare(String(a.updated)) : typeof a[sortKey] === "number" && typeof b[sortKey] === "number" ? (b[sortKey] as number) - (a[sortKey] as number) : String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")));
    response.status(200).json({ source: model.source, label: model.label, rows: rows.slice((pageValue - 1) * pageSizeValue, pageValue * pageSizeValue), total: rows.length, page: pageValue, pageSize: pageSizeValue, dateRange: model.range, datasetTruncated: model.datasetTruncated });
  }));

  router.get("/api/workspaces/:workspaceId/analytics/comparison", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters } = await read(request, response);
    const idsValue = singleQuery(request.query.campaignIds) ?? "";
    const ids = [...new Set(idsValue.split(",").filter(Boolean))];
    if (ids.length > 20 || ids.some((id) => !UUID.test(id))) throw new HttpError(400, "analytics_campaign_ids_invalid", "Choose up to 20 campaign IDs from this workspace.");
    const model = await loadModel(repo, workspaceId, filters);
    const known = new Set(model.campaigns.map((campaign) => campaign.id));
    if (ids.some((id) => !known.has(id))) throw new HttpError(404, "analytics_campaign_not_found", "One or more selected campaigns are unavailable in this workspace.");
    const selected = model.currentFacts.filter((fact) => !ids.length || ids.includes(fact.campaignId));
    response.status(200).json({ source: model.source, label: model.label, campaigns: buildBreakdown(selected, "campaign"), dateRange: model.range, currencies: [...new Set(selected.map((fact) => fact.currency))].sort() });
  }));

  router.get("/api/workspaces/:workspaceId/analytics/creatives", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters } = await read(request, response);
    const [data, model] = await Promise.all([repo.creatives(workspaceId), loadModel(repo, workspaceId, filters)]);
    const campaignNames = new Map(model.campaigns.map((campaign) => [campaign.id, { name: campaign.name, platform: campaign.platform }]));
    const linksByCreative = new Map<string, Array<{ campaignId: string; campaignName: string; platform: string }>>();
    for (const link of data.links) {
      const creativeId = String(link.creative_id ?? ""); const campaignId = String(link.campaign_id ?? ""); const campaign = campaignNames.get(campaignId);
      if (campaign) linksByCreative.set(creativeId, [...(linksByCreative.get(creativeId) ?? []), { campaignId, campaignName: campaign.name, platform: campaign.platform }]);
    }
    const creatives = data.rows.map((item) => ({ id: item.id, name: item.name, industry: item.industry_key, platform: item.platform, aspect: item.aspect_bucket, status: item.lifecycle_status, revision: item.revision, updatedAt: item.updated_at, campaigns: linksByCreative.get(String(item.id)) ?? [], performance: null, performanceStatus: "insufficient_data" }));
    response.status(200).json({ source: "DEMO_SIMULATION", label: "Simulated Data — Not Actual Ad Performance", creatives, message: "Creative-level results are not stored. Campaign metrics are not attributed to individual creatives.", workspace: model.workspace });
  }));

  router.get("/api/workspaces/:workspaceId/analytics/insights", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters } = await read(request, response);
    const model = await loadModel(repo, workspaceId, filters);
    response.status(200).json(buildInsights(model.currentFacts));
  }));

  router.get("/api/workspaces/:workspaceId/analytics/saved-views", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo } = await read(request, response);
    response.status(200).json({ views: (await repo.savedViews(workspaceId)).map(savedView) });
  }));
  router.post("/api/workspaces/:workspaceId/analytics/saved-views", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "reports.manage");
    const payload = body(SavedViewRouteSchema, request.body, "analytics_view_invalid", "Review the saved view filters and columns.");
    const row = await repo.saveView(workspaceId, payload.id ?? null, payload.expectedVersion ?? null, payload);
    response.status(payload.id ? 200 : 201).json({ view: savedView(row) });
  }));

  router.get("/api/workspaces/:workspaceId/reports", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo } = await read(request, response);
    response.status(200).json({ reports: (await repo.reports(workspaceId)).map(reportView) });
  }));
  router.post("/api/workspaces/:workspaceId/reports", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "reports.manage");
    const input = body(ReportDefinitionInputSchema, request.body, "report_definition_invalid", "Review the report name, filters, metrics and sections.");
    const { expectedVersion: _version, ...definition } = input;
    const row = await repo.createReport(workspaceId, definition);
    response.status(201).json({ report: reportView(row) });
  }));
  router.get("/api/workspaces/:workspaceId/reports/:reportId", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const reportId = parseId(request.params.reportId, "report_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "analytics.read");
    const row = await repo.report(workspaceId, reportId);
    if (!row) throw new HttpError(404, "report_not_found", "The requested report was not found.");
    const definition = ReportDefinitionInputSchema.parse(row.definition);
    const model = await loadModel(repo, workspaceId, reportFilters(definition));
    const metric = definition.metrics[0] ?? "spend";
    response.status(200).json({ report: reportView(row), preview: { workspace: model.workspace, source: model.source, label: model.label, dateRange: model.range, summary: aggregateMetrics(model.currentFacts), trend: buildTimeSeries(model.currentFacts, metric), campaigns: model.tableRows, insights: buildInsights(model.currentFacts), datasetTruncated: model.datasetTruncated } });
  }));
  router.patch("/api/workspaces/:workspaceId/reports/:reportId", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const reportId = parseId(request.params.reportId, "report_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "reports.manage");
    const input = body(ReportDefinitionInputSchema, request.body, "report_definition_invalid", "Review the report name, filters, metrics and sections.");
    if (input.expectedVersion === undefined) throw new HttpError(400, "report_version_required", "The current report version is required to save changes.");
    const { expectedVersion, ...definition } = input;
    const row = await repo.saveReport(workspaceId, reportId, expectedVersion, definition);
    if (row.workspace_id !== workspaceId) throw new HttpError(404, "report_not_found", "The requested report was not found.");
    response.status(200).json({ report: reportView(row) });
  }));
  router.post("/api/workspaces/:workspaceId/reports/:reportId/duplicate", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const reportId = parseId(request.params.reportId, "report_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "reports.manage");
    const input = body(ReportDuplicateInputSchema, request.body ?? {}, "report_duplicate_invalid", "The report name is invalid.");
    const row = await repo.duplicateReport(workspaceId, reportId, input.name ?? null);
    response.status(201).json({ report: reportView(row) });
  }));
  router.post("/api/workspaces/:workspaceId/reports/:reportId/archive", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const reportId = parseId(request.params.reportId, "report_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "reports.archive");
    const input = body(ReportArchiveInputSchema, request.body, "report_archive_invalid", "The report archive version is invalid.");
    const row = await repo.archiveReport(workspaceId, reportId, input.expectedVersion);
    response.status(200).json({ report: reportView(row) });
  }));
  router.get("/api/workspaces/:workspaceId/reports/:reportId/history", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const reportId = parseId(request.params.reportId, "report_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "analytics.read");
    if (!await repo.report(workspaceId, reportId)) throw new HttpError(404, "report_not_found", "The requested report was not found.");
    const [revisions, exports] = await Promise.all([repo.reportHistory(workspaceId, reportId), repo.exportHistory(workspaceId, reportId)]);
    response.status(200).json({ revisions, exports });
  }));
  router.post("/api/workspaces/:workspaceId/reports/:reportId/export", authenticate, asyncRoute(async (request, response) => {
    const workspaceId = parseId(request.params.workspaceId, "workspace_id"); const reportId = parseId(request.params.reportId, "report_id"); const user = actor(response); const repo = repoFor(response, factory);
    await authorize(repo, workspaceId, user, "reports.export");
    const input = body(ReportExportInputSchema, request.body, "report_export_invalid", "Choose CSV or PDF export.");
    const row = await repo.report(workspaceId, reportId);
    if (!row) throw new HttpError(404, "report_not_found", "The requested report was not found.");
    const definition = ReportDefinitionInputSchema.parse(row.definition);
    const model = await loadModel(repo, workspaceId, reportFilters(definition));
    const trendData = buildTimeSeries(model.currentFacts, definition.metrics[0] ?? "spend");
    const singleSeries = trendData.series.length === 1 ? trendData.series[0]?.points ?? [] : [];
    const exportRows = model.tableRows;
    const data = input.format === "csv"
      ? exportReportCsv(model, definition.metrics, definition.dimensions)
      : createReportPdf({ title: definition.name, workspaceName: model.workspace.name, from: model.range.from, to: model.range.to, metric: definition.metrics[0] ?? "spend", metrics: aggregateMetrics(model.currentFacts), trend: singleSeries, campaigns: exportRows, notes: definition.sections.filter((section) => section.type === "notes" && section.content).map((section) => section.content ?? "") });
    const digest = createHash("sha256").update(data).digest("hex");
    const exportRecord = await repo.recordExport(workspaceId, reportId, Number(row.version), input.format, input.format === "csv" ? model.currentFacts.length : exportRows.length, data.byteLength, digest);
    response.setHeader("Content-Type", input.format === "csv" ? "text/csv; charset=utf-8" : "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${safeFilename(definition.name)}.${input.format}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Analytics-Source", "DEMO_SIMULATION");
    response.setHeader("X-Report-Export-Id", String(exportRecord.id ?? ""));
    response.status(200).send(data);
  }));

  router.get("/api/workspaces/:workspaceId/analytics/export.csv", authenticate, asyncRoute(async (request, response) => {
    const { workspaceId, repo, filters, user } = await read(request, response);
    await authorize(repo, workspaceId, user, "reports.export");
    const model = await loadModel(repo, workspaceId, filters);
    const data = campaignRowsCsv(model.tableRows);
    const digest = createHash("sha256").update(data).digest("hex");
    const exportRecord = await repo.recordExport(workspaceId, null, null, "csv", model.tableRows.length, data.byteLength, digest);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", "attachment; filename=campaign-analytics.csv");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Analytics-Source", "DEMO_SIMULATION");
    response.setHeader("X-Report-Export-Id", String(exportRecord.id ?? ""));
    response.status(200).send(data);
  }));

  return router;
}

function safeFilename(value: string) {
  const name = value.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return name || "tandem-report";
}
