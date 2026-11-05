import type { AnalyticsDimension, AnalyticsFilter, AnalyticsMetric } from "@ai-ads/shared";
import type { CampaignRecord } from "@ai-ads/shared";

export const SIMULATED_LABEL = "Simulated Data — Not Actual Ad Performance";
export type DemoFact = {
  date: string;
  workspaceId: string;
  campaignId: string;
  campaignName: string;
  platform: "google_ads" | "meta_ads";
  objective: string;
  status: string;
  industry: string;
  scenario: string;
  simulationId: string;
  seed: number;
  currency: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number | null;
};
export type DateRange = { from: string; to: string; timezone: "UTC"; preset: AnalyticsFilter["preset"] };
export type RatioMetrics = { ctr: number | null; cpc: number | null; cpm: number | null; conversionRate: number | null; cpa: number | null; roas: number | null };
export type MetricTotals = RatioMetrics & {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number | null;
  spendByCurrency: Array<{ currency: string; spend: number; cpc: number | null; cpm: number | null; cpa: number | null; roas: number | null }>;
};

const finiteNonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const integerNonNegative = (value: unknown): value is number => finiteNonNegative(value) && Number.isInteger(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const dateShift = (date: string, days: number) => { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const ratio = (numerator: number, denominator: number, multiplier = 1) => denominator > 0 ? round(numerator / denominator * multiplier) : null;

export function resolveDateRange(filter: AnalyticsFilter, today = new Date().toISOString().slice(0, 10)): DateRange {
  let from = filter.from ?? today;
  let to = filter.to ?? today;
  switch (filter.preset) {
    case "today": from = today; to = today; break;
    case "yesterday": from = dateShift(today, -1); to = from; break;
    case "last_7_days": from = dateShift(today, -6); to = today; break;
    case "last_14_days": from = dateShift(today, -13); to = today; break;
    case "last_30_days": from = dateShift(today, -29); to = today; break;
    case "last_90_days": from = dateShift(today, -89); to = today; break;
    case "this_month": from = `${today.slice(0, 7)}-01`; to = today; break;
    case "last_month": {
      const firstThisMonth = `${today.slice(0, 7)}-01`;
      to = dateShift(firstThisMonth, -1);
      from = `${to.slice(0, 7)}-01`;
      break;
    }
    case "custom": from = filter.from ?? today; to = filter.to ?? today; break;
  }
  // The simulator never yields observed data from after today's UTC date.
  if (to > today) to = today;
  return { from, to, timezone: "UTC", preset: filter.preset };
}

export function buildDemoFacts(campaigns: CampaignRecord[], analytics: Record<string, unknown>[], today = new Date().toISOString().slice(0, 10)): DemoFact[] {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of analytics) {
    if (row.data_source !== "demo_simulation" || typeof row.campaign_id !== "string") continue;
    const previous = latest.get(row.campaign_id);
    const timestamp = typeof row.simulated_at === "string" ? Date.parse(row.simulated_at) : 0;
    const priorTimestamp = typeof previous?.simulated_at === "string" ? Date.parse(previous.simulated_at) : 0;
    if (!previous || timestamp > priorTimestamp) latest.set(row.campaign_id, row);
  }
  const result: DemoFact[] = [];
  for (const [campaignId, row] of latest) {
    const campaign = campaignById.get(campaignId);
    if (!campaign || campaign.publishedExternally || campaign.executionMode !== "demo") continue;
    const metrics = typeof row.metrics === "object" && row.metrics !== null ? row.metrics as Record<string, unknown> : null;
    if (!metrics || metrics.label !== SIMULATED_LABEL || !Array.isArray(metrics.days)) continue;
    const scenario = typeof row.scenario === "string" ? row.scenario : typeof metrics.scenario === "string" ? metrics.scenario : "unknown";
    const seedValue = typeof row.seed === "number" ? row.seed : Number(row.seed);
    const seed = Number.isSafeInteger(seedValue) ? seedValue : 0;
    for (const item of metrics.days) {
      if (!item || typeof item !== "object") continue;
      const day = item as Record<string, unknown>;
      if (!validDate(day.date) || day.date > today
        || !integerNonNegative(day.impressions) || !integerNonNegative(day.clicks) || day.clicks > day.impressions
        || !finiteNonNegative(day.spend) || !finiteNonNegative(day.conversions)) continue;
      const revenue = finiteNonNegative(day.revenue) ? day.revenue : null;
      result.push({
        date: day.date, workspaceId: campaign.workspaceId, campaignId, campaignName: campaign.name,
        platform: campaign.platform, objective: campaign.objective, status: campaign.status,
        industry: campaign.brief.industry, scenario, simulationId: String(row.id ?? ""), seed,
        currency: campaign.brief.currency, impressions: day.impressions, clicks: day.clicks,
        spend: round(day.spend, 4), conversions: day.conversions, revenue: revenue === null ? null : round(revenue, 4),
      });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.campaignId.localeCompare(b.campaignId));
}

export function filterFacts(facts: DemoFact[], filters: AnalyticsFilter, range = resolveDateRange(filters)): DemoFact[] {
  if (range.to < range.from) return [];
  return facts.filter((fact) => fact.date >= range.from && fact.date <= range.to
    && (filters.platform === "all" || fact.platform === filters.platform)
    && (!filters.campaignId || fact.campaignId === filters.campaignId)
    && (!filters.objective || fact.objective === filters.objective)
    && (!filters.status || fact.status === filters.status)
    && (!filters.industry || fact.industry === filters.industry)
    && (!filters.scenario || fact.scenario === filters.scenario)
    && (!filters.currency || fact.currency === filters.currency));
}

export function aggregateMetrics(facts: DemoFact[]): MetricTotals {
  const impressions = facts.reduce((sum, fact) => sum + fact.impressions, 0);
  const clicks = facts.reduce((sum, fact) => sum + fact.clicks, 0);
  const conversions = facts.reduce((sum, fact) => sum + fact.conversions, 0);
  const currencyGroups = new Map<string, DemoFact[]>();
  for (const fact of facts) currencyGroups.set(fact.currency, [...(currencyGroups.get(fact.currency) ?? []), fact]);
  const spendByCurrency = [...currencyGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, items]) => {
    const rawSpend = items.reduce((sum, fact) => sum + fact.spend, 0);
    const spend = round(rawSpend);
    const groupClicks = items.reduce((sum, fact) => sum + fact.clicks, 0);
    const groupImpressions = items.reduce((sum, fact) => sum + fact.impressions, 0);
    const groupConversions = items.reduce((sum, fact) => sum + fact.conversions, 0);
    const validRevenue = items.filter((fact) => fact.revenue !== null);
    const revenue = validRevenue.length === items.length && items.length > 0 ? validRevenue.reduce((sum, fact) => sum + (fact.revenue ?? 0), 0) : null;
    return { currency, spend, cpc: ratio(rawSpend, groupClicks), cpm: ratio(rawSpend, groupImpressions, 1000), cpa: ratio(rawSpend, groupConversions), roas: revenue === null ? null : ratio(revenue, rawSpend) };
  });
  const validRevenue = facts.filter((fact) => fact.revenue !== null);
  const revenue = validRevenue.length === facts.length && facts.length > 0 ? round(validRevenue.reduce((sum, fact) => sum + (fact.revenue ?? 0), 0)) : null;
  return {
    impressions, clicks, conversions, revenue,
    ctr: ratio(clicks, impressions, 100),
    conversionRate: ratio(conversions, clicks, 100),
    cpc: spendByCurrency.length === 1 ? spendByCurrency[0]?.cpc ?? null : null,
    cpm: spendByCurrency.length === 1 ? spendByCurrency[0]?.cpm ?? null : null,
    cpa: spendByCurrency.length === 1 ? spendByCurrency[0]?.cpa ?? null : null,
    roas: spendByCurrency.length === 1 ? spendByCurrency[0]?.roas ?? null : null,
    spendByCurrency,
  };
}

export function buildBreakdown(facts: DemoFact[], dimension: Exclude<AnalyticsDimension, "date">) {
  const groups = new Map<string, DemoFact[]>();
  for (const fact of facts) {
    const key = dimension === "campaign" ? fact.campaignId
      : dimension === "platform" ? fact.platform
        : dimension === "objective" ? fact.objective
          : dimension === "industry" ? fact.industry
            : dimension === "currency" ? fact.currency : fact.scenario;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key, campaignId: dimension === "campaign" ? key : null,
    name: dimension === "campaign" ? items[0]?.campaignName ?? key : key,
    currency: dimension === "campaign" || dimension === "platform" ? null : dimension === "currency" ? key : null,
    platform: dimension === "platform" ? key : dimension === "campaign" ? items[0]?.platform ?? null : null,
    metrics: aggregateMetrics(items),
    source: "DEMO_SIMULATION" as const,
  })).sort((a, b) => a.key.localeCompare(b.key));
}

export function buildTimeSeries(facts: DemoFact[], metric: AnalyticsMetric) {
  const grouped = new Map<string, DemoFact[]>();
  for (const fact of facts) {
    const key = metric === "spend" || metric === "cpc" || metric === "cpm" || metric === "cpa" || metric === "roas" ? `${fact.currency}` : "all-currencies";
    const groupKey = `${key}:${fact.date}`;
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), fact]);
  }
  const currencies = new Set(facts.map((fact) => fact.currency));
  const seriesKeys = metric === "spend" || metric === "cpc" || metric === "cpm" || metric === "cpa" || metric === "roas" ? [...currencies] : ["all-currencies"];
  const dates = [...new Set(facts.map((fact) => fact.date))].sort();
  const series = seriesKeys.sort().map((currency) => ({
    key: currency, currency: currency === "all-currencies" ? null : currency,
    points: dates.map((date) => {
      const values = grouped.get(`${currency}:${date}`) ?? [];
      const totals = aggregateMetrics(values);
      const value = metric === "spend" ? totals.spendByCurrency.find((item) => item.currency === currency)?.spend ?? null
        : metric === "impressions" ? totals.impressions
          : metric === "clicks" ? totals.clicks
            : metric === "ctr" ? totals.ctr
              : metric === "conversion_rate" ? totals.conversionRate
                : metric === "conversions" ? totals.conversions
                  : metric === "cpc" ? totals.spendByCurrency.find((item) => item.currency === currency)?.cpc ?? null
                    : metric === "cpm" ? totals.spendByCurrency.find((item) => item.currency === currency)?.cpm ?? null
                      : metric === "cpa" ? totals.spendByCurrency.find((item) => item.currency === currency)?.cpa ?? null
                        : totals.spendByCurrency.find((item) => item.currency === currency)?.roas ?? null;
      return { date, value };
    }),
  }));
  return { metric, source: "DEMO_SIMULATION" as const, series };
}

export function previousRange(range: DateRange): DateRange {
  const length = Math.max(1, Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1);
  const to = dateShift(range.from, -1);
  return { ...range, from: dateShift(to, -(length - 1)), to, preset: "custom" };
}

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return round((current / previous - 1) * 100, 1);
}

export function buildInsights(facts: DemoFact[]) {
  const campaigns = buildBreakdown(facts, "campaign").filter((item) => item.metrics.impressions > 0);
  const byCurrencyCampaign = new Map<string, { name: string; value: number; campaignId: string }>();
  for (const fact of facts) {
    const key = `${fact.currency}:${fact.campaignId}`;
    const previous = byCurrencyCampaign.get(key);
    byCurrencyCampaign.set(key, { name: fact.campaignName, campaignId: fact.campaignId, value: (previous?.value ?? 0) + fact.spend });
  }
  const spendLeaders = new Map<string, { name: string; value: number; campaignId: string }>();
  for (const [key, item] of byCurrencyCampaign) {
    const currency = key.slice(0, 3);
    if (item.value > (spendLeaders.get(currency)?.value ?? -1)) spendLeaders.set(currency, item);
  }
  const enoughObservations = campaigns.filter((item) => item.metrics.impressions >= 100);
  const topCtr = enoughObservations.sort((a, b) => (b.metrics.ctr ?? -1) - (a.metrics.ctr ?? -1))[0] ?? null;
  return {
    label: "Rule-Based Insights",
    source: "DEMO_SIMULATION" as const,
    observations: [
      ...[...spendLeaders.entries()].map(([currency, leader]) => ({ type: "largest_spend_contributor", title: `Largest simulated spend contributor · ${currency}`, campaignId: leader.campaignId, evidence: { campaign: leader.name, spend: round(leader.value), currency, calculation: "Sum of stored daily simulated spend by campaign and currency." }, limitation: "This is demo spend only and is not a provider charge." })),
      ...(topCtr ? [{ type: "highest_ctr", title: "Highest simulated CTR with at least 100 impressions", campaignId: topCtr.campaignId, evidence: { campaign: topCtr.name, ctr: topCtr.metrics.ctr, impressions: topCtr.metrics.impressions, clicks: topCtr.metrics.clicks, calculation: "Total clicks divided by total impressions, multiplied by 100." }, limitation: "A small simulated sample is not evidence of actual advertising performance." }] : []),
      ...(!facts.length ? [{ type: "insufficient_data", title: "Insufficient data", campaignId: null, evidence: {}, limitation: "Publish a campaign in Demo Mode to create a clearly labeled simulation." }] : []),
    ],
  };
}

export function metricValue(metrics: MetricTotals, metric: AnalyticsMetric, currency?: string): number | null {
  if (metric === "impressions") return metrics.impressions;
  if (metric === "clicks") return metrics.clicks;
  if (metric === "conversions") return metrics.conversions;
  if (metric === "ctr") return metrics.ctr;
  if (metric === "conversion_rate") return metrics.conversionRate;
  const group = metrics.spendByCurrency.find((item) => item.currency === currency) ?? (metrics.spendByCurrency.length === 1 ? metrics.spendByCurrency[0] : null);
  if (!group) return null;
  if (metric === "spend") return group.spend;
  return group[metric];
}
