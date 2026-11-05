import type { AnalyticsFilter, AnalyticsMetric, IndustryKey, ReportType } from "@ai-ads/shared";

export type ReportTemplate = { id: string; name: string; description: string; reportType: ReportType; metrics: AnalyticsMetric[]; dimensions: Array<"campaign" | "platform" | "objective" | "industry" | "currency" | "scenario" | "date"> };

export const REPORT_TEMPLATES: ReportTemplate[] = [
  { id: "executive-performance-summary", name: "Executive Performance Summary", description: "A concise, currency-aware view of simulated reach, traffic, conversions and trends.", reportType: "executive_overview", metrics: ["spend", "impressions", "clicks", "ctr", "conversions"], dimensions: ["platform", "currency"] },
  { id: "cross-platform-comparison", name: "Cross-Platform Comparison", description: "Compare Google Ads and Meta demo formats while keeping spend grouped by currency.", reportType: "platform_comparison", metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "conversions"], dimensions: ["platform", "currency"] },
  { id: "google-search-campaign-report", name: "Google Search Campaign Report", description: "Review Google Search-format campaign plans and stored demo snapshots.", reportType: "google_search", metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "conversions"], dimensions: ["campaign", "objective", "currency", "date"] },
  { id: "meta-campaign-report", name: "Meta Campaign Report", description: "Review Meta draft-format campaigns and their simulated time series.", reportType: "meta_campaign", metrics: ["spend", "impressions", "clicks", "ctr", "conversions", "cpa"], dimensions: ["campaign", "objective", "currency", "date"] },
  { id: "creative-performance-report", name: "Creative Performance Report", description: "List saved creative projects and associated campaigns. Performance stays unavailable unless creative-level demo facts exist.", reportType: "creative_analysis", metrics: ["impressions", "clicks", "ctr"], dimensions: ["campaign", "platform", "industry"] },
  { id: "budget-efficiency-report", name: "Budget Efficiency Report", description: "Summarize simulated spend and cost ratios without combining currencies.", reportType: "budget_efficiency", metrics: ["spend", "cpc", "cpm", "conversions", "cpa"], dimensions: ["campaign", "platform", "currency"] },
  { id: "monthly-marketing-summary", name: "Monthly Marketing Summary", description: "A rolling month summary by platform and industry.", reportType: "performance_trends", metrics: ["spend", "impressions", "clicks", "ctr", "conversions"], dimensions: ["date", "platform", "currency"] },
  { id: "campaign-review-report", name: "Campaign Review Report", description: "A review-ready table of campaign status and simulated outcomes.", reportType: "campaign_performance", metrics: ["spend", "impressions", "clicks", "ctr", "conversions", "cpa"], dimensions: ["campaign", "platform", "objective", "currency"] },
  { id: "agency-client-report", name: "Agency Client Report", description: "A workspace-scoped client review with clear source disclosure and platform context.", reportType: "custom", metrics: ["spend", "impressions", "clicks", "ctr", "conversions"], dimensions: ["campaign", "platform", "industry", "currency"] },
];

export function templateDefinition(template: ReportTemplate, workspaceIndustry?: IndustryKey) {
  const sections = [
    { id: crypto.randomUUID(), type: "heading" as const, title: template.name },
    { id: crypto.randomUUID(), type: "kpi_summary" as const, title: "Performance summary" },
    { id: crypto.randomUUID(), type: "chart" as const, title: "Stored daily trend", metric: template.metrics[0] },
    { id: crypto.randomUUID(), type: "table" as const, title: "Campaign detail", dimension: template.dimensions[0] },
    { id: crypto.randomUUID(), type: "methodology" as const, title: "Source and methodology", content: "Rule-based aggregation from stored demo snapshots. No provider or AI API was queried." },
  ];
  const filters: AnalyticsFilter = { preset: "last_30_days", platform: "all", comparePrevious: false, ...(workspaceIndustry ? { industry: workspaceIndustry } : {}) };
  return {
    name: template.name,
    description: template.description,
    reportType: template.reportType,
    filters,
    metrics: [...template.metrics],
    dimensions: [...template.dimensions],
    sections,
    dateRangePolicy: { kind: "rolling" as const, preset: "last_30_days" as const, schedulePreference: null },
  };
}
