import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignRecord, OptimizationMetric } from "@ai-ads/shared";
import { analyzePerformance, compareCampaignMetrics, deriveDailyTrend, detectRecommendations, projectBudgetScenario } from "./engine.js";
import { evaluateRule, validateRule } from "./rule-engine.js";

const campaign = {
  id: "71000000-0000-4000-8000-000000000001", workspaceId: "72000000-0000-4000-8000-000000000001",
  name: "Demo campaign", platform: "meta_ads", objective: "traffic", status: "demo_published",
  revision: 2, approvedRevision: 2, generatedAt: null, createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T00:00:00.000Z", generationMode: "none",
  executionMode: "demo", publishedExternally: false,
  brief: { businessName: "North Goods", industry: "ecommerce_retail", industryLabel: null, productService: "Travel mugs", businessDescription: "", offer: "", landingPageUrl: "https://north.example", uniqueSellingPoints: [], brandVoice: "clear", preferredCta: "Shop now", country: "US", regions: [], language: "English", intendedCustomer: "Commuters", audienceDescription: "", keywords: [], interestThemes: [], exclusions: [], budgetType: "daily", budgetAmount: 100, currency: "USD", startDate: "2026-10-01", endDate: null, budgetRationale: "", biddingPreference: "manual_review", tone: "clear", mainMessage: "Made for daily carry", promotionalHook: "", brandAttributes: [], copyStyle: "concise" }, plan: null,
} as CampaignRecord;

const demo = (roas: number | null = null) => ({ label: "Simulated Data — Not Actual Ad Performance" as const, scenario: "average" as const, seed: 42, simulatedAt: "2026-10-28T00:00:00.000Z", days: [
  { date: "2026-10-22", impressions: 1000, clicks: 8, spend: 16, conversions: 1, ctr: 0.8, cpc: 2, cpa: 16, roas },
  { date: "2026-10-23", impressions: 1000, clicks: 9, spend: 18, conversions: 1, ctr: 0.9, cpc: 2, cpa: 18, roas },
  { date: "2026-10-24", impressions: 1000, clicks: 7, spend: 14, conversions: 0, ctr: 0.7, cpc: 2, cpa: null, roas: null },
  { date: "2026-10-25", impressions: 1000, clicks: 9, spend: 18, conversions: 1, ctr: 0.9, cpc: 2, cpa: 18, roas },
  { date: "2026-10-26", impressions: 1000, clicks: 8, spend: 16, conversions: 1, ctr: 0.8, cpc: 2, cpa: 16, roas },
  { date: "2026-10-27", impressions: 1000, clicks: 7, spend: 14, conversions: 0, ctr: 0.7, cpc: 2, cpa: null, roas: null },
  { date: "2026-10-28", impressions: 1000, clicks: 8, spend: 16, conversions: 1, ctr: 0.8, cpc: 2, cpa: 16, roas },
] });

test("campaign metrics derive ratios from stored demo totals and omit ROAS without revenue", () => {
  const metrics = analyzePerformance(campaign, demo());
  assert.equal(metrics.impressions, 7000);
  assert.equal(metrics.clicks, 56);
  assert.equal(metrics.spend, 112);
  assert.equal(metrics.ctr, 0.8);
  assert.equal(metrics.cpc, 2);
  assert.equal(metrics.cpm, 16);
  assert.equal(metrics.cpa, 22.4);
  assert.equal(metrics.roas, null);
  assert.match(metrics.label, /Simulated Data/);
});

test("ROAS is only reported when revenue assumptions are stored", () => {
  const metrics = analyzePerformance(campaign, demo(3));
  assert.ok(metrics.roas !== null && metrics.roas > 0);
});

test("offline recommendations are reproducible and carry measurable evidence", () => {
  const metrics = analyzePerformance(campaign, demo());
  const first = detectRecommendations(campaign, metrics, demo());
  const second = detectRecommendations(campaign, metrics, demo());
  assert.deepEqual(first, second);
  const lowCtr = first.find((item) => item.type === "review_low_ctr");
  assert.ok(lowCtr);
  assert.equal(lowCtr.evidence.threshold, 1);
  assert.equal(lowCtr.evidence.impressions, 7000);
  assert.ok(lowCtr.evidenceLimitations.length > 0);
});

test("zero metrics are safe and cross-currency campaign comparison is rejected", () => {
  const metrics = analyzePerformance(campaign, { days: [], simulatedAt: "2026-10-28T00:00:00.000Z" });
  assert.equal(metrics.ctr, null);
  assert.equal(metrics.cpa, null);
  assert.equal(metrics.roas, null);
  const other = { ...metrics, currency: "EUR" } as OptimizationMetric;
  assert.throws(() => compareCampaignMetrics([{ campaignId: campaign.id, campaignName: campaign.name, platform: campaign.platform, currency: "USD", metrics }, { campaignId: "73000000-0000-4000-8000-000000000001", campaignName: "Other", platform: "google_ads", currency: "EUR", metrics: other }]), /different currencies/);
});

test("stored trend points are validated, chronological, and limited to the latest fourteen days", () => {
  const days = Array.from({ length: 16 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, impressions: 100 + index, clicks: 5, spend: index + 0.123 }));
  days.push({ date: "2026-10-31", impressions: 2, clicks: 3, spend: 100 });
  const trend = deriveDailyTrend({ days });
  assert.equal(trend.length, 14);
  assert.equal(trend[0]?.date, "2026-10-03");
  assert.equal(trend.at(-1)?.date, "2026-10-16");
  assert.equal(trend[0]?.spend, 2.12);
  assert.deepEqual(deriveDailyTrend({ days: [{ date: "today", impressions: -1, clicks: 0, spend: Number.NaN }] }), []);
});

test("budget scenario math is deterministic and visibly labeled as a non-prediction", () => {
  const current = analyzePerformance(campaign, demo());
  const result = projectBudgetScenario(current, 100, 150, "daily");
  assert.equal(result.projection.spend, 168);
  assert.equal(result.projection.clicks, 84);
  assert.ok(result.assumptions.some((item) => item.includes("Not a prediction")));
  assert.throws(() => projectBudgetScenario(current, 100, -5, "daily"), /positive/);
});

test("typed rules support AND/OR and missing values never match", () => {
  const definition = validateRule({ version: 1, trigger: "manual", conditionLogic: "all", conditions: [{ metric: "ctr", operator: "lt", threshold: 1 }, { metric: "roas", operator: "gte", threshold: 2 }], action: "create_recommendation", approvalRequired: true, industry: "ecommerce_retail" });
  const metrics = analyzePerformance(campaign, demo());
  const result = evaluateRule(definition, metrics);
  assert.equal(result.results[0]?.matched, true);
  assert.equal(result.results[1]?.matched, false);
  assert.equal(result.matched, false);
  assert.throws(() => validateRule({ version: 1, trigger: "scheduled", conditionLogic: "all", conditions: [{ metric: "ctr", operator: "lt", threshold: 1 }], action: "flag_campaign", approvalRequired: true, industry: null }));
  assert.throws(() => validateRule({ version: 1, trigger: "manual", conditionLogic: "all", conditions: [{ metric: "ctr", operator: "lt", threshold: 1 }], action: "fetch_url", approvalRequired: true, industry: null }));
});
