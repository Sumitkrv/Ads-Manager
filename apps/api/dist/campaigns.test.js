import assert from "node:assert/strict";
import test from "node:test";
import { INDUSTRY_KEYS, CampaignBriefSchema, CampaignPlanSchema, CampaignWriteSchema } from "@ai-ads/shared";
import { SimulationCampaignProvider, validateCampaign } from "./campaigns/engine.js";
import { DemoMetricsProvider } from "./campaigns/metrics.js";
const briefBase = {
    businessName: "Northstar Studio", industry: "professional_services", industryLabel: null,
    productService: "Brand strategy", businessDescription: "Independent brand and growth consulting.", offer: "Introductory consultation",
    landingPageUrl: "https://northstar.example/services", uniqueSellingPoints: ["Senior-led delivery"], brandVoice: "confident",
    preferredCta: "Book a consultation", country: "India", regions: ["Pune"], language: "English",
    intendedCustomer: "Growing service businesses", audienceDescription: "Teams exploring brand strategy and positioning.",
    keywords: ["brand strategy consultant"], interestThemes: ["business strategy"], exclusions: [], budgetType: "daily",
    budgetAmount: 100, currency: "INR", startDate: "2026-11-01", endDate: "2026-11-30", budgetRationale: "Test a local plan.",
    biddingPreference: "manual_review", tone: "confident", mainMessage: "Clearer positioning for the next stage.",
    promotionalHook: "Make the next move with clarity", brandAttributes: ["thoughtful"], copyStyle: "benefit_led",
};
const brief = CampaignBriefSchema.parse(briefBase);
const generator = new SimulationCampaignProvider();
test("an empty landing page is reported as invalid instead of throwing URL construction errors", () => {
    let result;
    assert.doesNotThrow(() => {
        result = CampaignBriefSchema.safeParse({ ...briefBase, landingPageUrl: "" });
    });
    assert.equal(result?.success, false);
    if (result && !result.success) {
        assert.ok(result.error.issues.some((issue) => issue.path[0] === "landingPageUrl"));
    }
});
test("simulation generates a valid, reproducible Google Search draft from the brief", () => {
    const first = generator.generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 771 });
    const second = generator.generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 771 });
    assert.equal(CampaignPlanSchema.safeParse(first).success, true);
    assert.equal(first.generation.label, "AI Simulation");
    assert.equal(first.generation.seed, 771);
    assert.equal(first.strategy, second.strategy);
    assert.deepEqual(first.google?.adGroups[0]?.keywords, second.google?.adGroups[0]?.keywords);
    assert.deepEqual(first.google?.adGroups[0]?.ads[0]?.headlines, second.google?.adGroups[0]?.ads[0]?.headlines);
    assert.ok(first.google?.adGroups[0]?.ads[0]?.headlines.every((line) => line.length <= 30));
    assert.ok(first.google?.adGroups[0]?.ads[0]?.descriptions.every((line) => line.length <= 90));
});
test("Meta simulation returns campaign, ad set and ad structure", () => {
    const generated = generator.generateCampaign({ platform: "meta_ads", objective: "traffic", brief, seed: 42 });
    assert.equal(CampaignPlanSchema.safeParse(generated).success, true);
    assert.equal(generated.meta?.adSets.length, 1);
    assert.equal(generated.meta?.adSets[0]?.ads.length, 1);
    assert.equal(generated.meta?.adSets[0]?.budgetAmount, brief.budgetAmount);
    assert.ok(generated.meta?.adSets[0]?.ads[0]?.destinationUrl.startsWith("https://"));
});
test("all sixteen workspace industries produce distinct contextual campaign guidance", () => {
    const outputs = INDUSTRY_KEYS.map((industry) => {
        const currentBrief = { ...brief, industry, industryLabel: industry === "other" ? "Custom trade" : null };
        const output = generator.generateCampaign({ platform: "google_ads", objective: "lead_generation", brief: currentBrief, seed: 11 });
        return { strategy: output.strategy, keywords: output.google?.adGroups[0]?.keywords.map((item) => item.text) };
    });
    assert.equal(outputs.length, 16);
    assert.equal(new Set(outputs.map((entry) => entry.strategy)).size, 16);
    assert.ok(outputs.every((entry) => (entry.keywords?.length ?? 0) > 0));
});
test("regulated-industry generation includes claim-review warnings", () => {
    const clinic = generator.generateCampaign({ platform: "meta_ads", objective: "lead_generation", brief: { ...brief, industry: "healthcare_clinics" }, seed: 90 });
    const finance = generator.generateCampaign({ platform: "google_ads", objective: "lead_generation", brief: { ...brief, industry: "finance_insurance" }, seed: 90 });
    assert.ok(clinic.warnings.some((warning) => warning.includes("Healthcare")));
    assert.ok(finance.warnings.some((warning) => warning.includes("Financial")));
});
test("validation distinguishes local readiness from provider verification", () => {
    const plan = generator.generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 1 });
    const issues = validateCampaign(brief, plan);
    assert.ok(issues.every((issue) => issue.severity !== "error"));
    assert.ok(issues.some((issue) => issue.code === "provider_unverified"));
    assert.ok(validateCampaign(brief, null).some((issue) => issue.code === "generation_required"));
});
test("local validation rejects a persisted plan whose platform or objective was changed independently", () => {
    const plan = generator.generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 3 });
    const platformIssues = validateCampaign(brief, plan, "meta_ads", "website_traffic");
    const objectiveIssues = validateCampaign(brief, plan, "google_ads", "sales");
    assert.ok(platformIssues.some((issue) => issue.code === "plan_platform_mismatch" && issue.severity === "error"));
    assert.ok(objectiveIssues.some((issue) => issue.code === "plan_objective_mismatch" && issue.severity === "error"));
});
test("campaign write schema rejects a plan from another platform or unsupported objective", () => {
    const google = generator.generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 5 });
    assert.equal(CampaignWriteSchema.safeParse({ name: "Draft", platform: "meta_ads", objective: "website_traffic", brief, plan: google }).success, false);
    assert.equal(CampaignWriteSchema.safeParse({ name: "Draft", platform: "google_ads", objective: "engagement", brief, plan: null }).success, false);
});
test("demo analytics are deterministic and derive their ratios from stored totals", () => {
    const provider = new DemoMetricsProvider();
    const a = provider.generate(123456, "gradual_improvement", 50, 10, "2026-11-01");
    const b = provider.generate(123456, "gradual_improvement", 50, 10, "2026-11-01");
    assert.equal(a.label, "Simulated Data — Not Actual Ad Performance");
    assert.deepEqual(a.days, b.days);
    for (const day of a.days) {
        assert.ok(day.spend <= 50);
        assert.equal(day.ctr, day.impressions ? Math.round(day.clicks / day.impressions * 100 * 100) / 100 : 0);
        assert.equal(day.cpc, day.clicks ? Math.round(day.spend / day.clicks * 100) / 100 : 0);
        assert.equal(day.cpa, day.conversions ? Math.round(day.spend / day.conversions * 100) / 100 : null);
        assert.equal(day.roas, null);
    }
});
