import { OptimizationMetricSchema } from "@ai-ads/shared";
export function deriveDailyTrend(source) {
    if (typeof source !== "object" || source === null || !("days" in source) || !Array.isArray(source.days))
        return [];
    return source.days.filter((day) => typeof day === "object" && day !== null)
        .filter((day) => typeof day.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.date)
        && isFiniteNumber(day.impressions) && Number.isInteger(day.impressions)
        && isFiniteNumber(day.clicks) && Number.isInteger(day.clicks) && day.clicks <= day.impressions
        && isFiniteNumber(day.spend))
        .slice(-14)
        .map((day) => ({ date: day.date, impressions: day.impressions, clicks: day.clicks, spend: Math.round(day.spend * 100) / 100 }));
}
function isFiniteNumber(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
export function analyzePerformance(campaign, source) {
    const parsed = typeof source === "object" && source !== null ? source : {};
    const days = Array.isArray(parsed.days) ? parsed.days.filter((day) => day && typeof day.date === "string" && isFiniteNumber(day.impressions) && isFiniteNumber(day.clicks) && isFiniteNumber(day.conversions) && isFiniteNumber(day.spend)) : [];
    const lastWindow = days.slice(-7);
    const impressions = lastWindow.reduce((sum, day) => sum + day.impressions, 0);
    const clicks = lastWindow.reduce((sum, day) => sum + day.clicks, 0);
    const conversions = lastWindow.reduce((sum, day) => sum + day.conversions, 0);
    const spend = Math.round(lastWindow.reduce((sum, day) => sum + day.spend, 0) * 100) / 100;
    const revenuePairs = lastWindow.filter((day) => isFiniteNumber(day.roas) && day.spend > 0);
    const revenue = revenuePairs.reduce((sum, day) => sum + day.roas * day.spend, 0);
    const budget = campaign.brief.budgetAmount;
    const denominator = campaign.brief.budgetType === "daily" ? budget * lastWindow.length : budget;
    const value = OptimizationMetricSchema.parse({
        impressions, clicks, conversions, spend, currency: campaign.brief.currency,
        ctr: impressions > 0 ? clicks / impressions * 100 : null,
        cpc: clicks > 0 ? spend / clicks : null,
        cpm: impressions > 0 ? spend / impressions * 1000 : null,
        cpa: conversions > 0 ? spend / conversions : null,
        roas: revenuePairs.length > 0 && spend > 0 ? revenue / spend : null,
        conversionRate: clicks > 0 ? conversions / clicks * 100 : null,
        budgetUtilization: denominator > 0 ? spend / denominator * 100 : null,
        days: lastWindow.length,
        simulatedAt: parsed.simulatedAt && !Number.isNaN(Date.parse(parsed.simulatedAt)) ? new Date(parsed.simulatedAt).toISOString() : new Date(0).toISOString(),
        label: "Simulated Data — Not Actual Ad Performance",
    });
    return value;
}
function sumMetric(days) {
    const impressions = days.reduce((sum, day) => sum + day.impressions, 0);
    const clicks = days.reduce((sum, day) => sum + day.clicks, 0);
    const conversions = days.reduce((sum, day) => sum + day.conversions, 0);
    const spend = days.reduce((sum, day) => sum + day.spend, 0);
    return { impressions, clicks, conversions, spend, ctr: impressions ? clicks / impressions * 100 : null };
}
export function detectRecommendations(campaign, metrics, source) {
    const input = typeof source === "object" && source !== null ? source : {};
    const days = Array.isArray(input.days) ? input.days : [];
    const recommendations = [];
    const sampleLimitations = ["This rule uses deterministic thresholds on simulated data; it is not a provider forecast or a guarantee."];
    if (metrics.impressions >= 1000 && metrics.ctr !== null && metrics.ctr < 1) {
        recommendations.push({
            category: campaign.platform === "google_ads" ? "keyword_structure" : "creative",
            priority: metrics.impressions >= 5000 ? "high" : "medium", type: "review_low_ctr",
            title: "Review the click-through rate",
            detected: `The latest ${metrics.days}-day simulated window has a ${metrics.ctr.toFixed(2)}% CTR across ${metrics.impressions.toLocaleString()} impressions, below the local 1.00% review threshold.`,
            evidence: { metric: "ctr", observed: metrics.ctr, threshold: 1, impressions: metrics.impressions, clicks: metrics.clicks, platform: campaign.platform },
            proposedAction: { action: campaign.platform === "google_ads" ? "review_keywords_and_headlines" : "compare_creative_variations", requiresApproval: true },
            tradeoffs: ["Changing copy or targeting can reduce reach or change audience quality."], evidenceLimitations: [...sampleLimitations, "CTR thresholds are only a review signal; placement and industry context can change interpretation."], confidence: "medium",
        });
    }
    if (metrics.conversions === 0 && metrics.spend > 0) {
        recommendations.push({
            category: "campaign_configuration", priority: metrics.spend > campaign.brief.budgetAmount * 3 ? "high" : "medium", type: "spend_without_conversions",
            title: "Check conversion measurement assumptions",
            detected: `${metrics.currency} ${metrics.spend.toFixed(2)} simulated spend was recorded without a conversion in the latest ${metrics.days}-day window.`,
            evidence: { spend: metrics.spend, conversions: metrics.conversions, currency: metrics.currency, days: metrics.days },
            proposedAction: { action: "review_conversion_definition_and_landing_page", requiresApproval: true },
            tradeoffs: ["The simulator does not verify real conversion tags or provider attribution."], evidenceLimitations: sampleLimitations, confidence: "low",
        });
    }
    if (campaign.brief.budgetType === "daily" && metrics.budgetUtilization !== null && metrics.budgetUtilization < 50 && metrics.days >= 5) {
        recommendations.push({
            category: "budget", priority: "low", type: "low_demo_budget_utilization", title: "Review the demo budget assumption",
            detected: `Observed simulated spend used ${metrics.budgetUtilization.toFixed(1)}% of the configured daily budget over ${metrics.days} days.`,
            evidence: { spend: metrics.spend, dailyBudget: campaign.brief.budgetAmount, currency: metrics.currency, utilizationPercent: metrics.budgetUtilization },
            proposedAction: { action: "create_budget_scenario", requiresApproval: true },
            tradeoffs: ["A smaller demo budget can reduce simulated volume; this projection is not a live spend recommendation."], evidenceLimitations: sampleLimitations, confidence: "low",
        });
    }
    if (days.length >= 14) {
        const previous = sumMetric(days.slice(-14, -7));
        const current = sumMetric(days.slice(-7));
        if (previous.ctr !== null && current.ctr !== null && previous.impressions >= 500 && current.impressions >= 500 && current.ctr < previous.ctr * 0.7) {
            recommendations.push({
                category: "performance_trend", priority: "high", type: "simulated_ctr_decline", title: "Investigate a simulated CTR decline",
                detected: `CTR moved from ${previous.ctr.toFixed(2)}% in the prior 7 days to ${current.ctr.toFixed(2)}% in the latest 7 days.`,
                evidence: { metric: "ctr", prior7Days: previous.ctr, latest7Days: current.ctr, percentChange: (current.ctr / previous.ctr - 1) * 100, priorImpressions: previous.impressions, latestImpressions: current.impressions },
                proposedAction: { action: "compare_creative_or_targeting", requiresApproval: true },
                tradeoffs: ["A seven-day comparison can reflect simulated variation rather than a persistent trend."], evidenceLimitations: sampleLimitations, confidence: "low",
            });
        }
    }
    return recommendations;
}
export function compareCampaignMetrics(items) {
    if (new Set(items.map((item) => item.currency)).size > 1)
        throw new Error("Campaigns with different currencies cannot be combined.");
    return items.map((item) => ({ ...item, label: "Simulated Data — Not Actual Ad Performance" }));
}
export function projectBudgetScenario(current, currentBudget, proposedBudget, budgetType) {
    if (!(currentBudget > 0) || !(proposedBudget > 0))
        throw new Error("Budget values must be positive.");
    const scale = proposedBudget / currentBudget;
    const projectedSpend = current.spend * scale;
    const projection = OptimizationMetricSchema.parse({
        ...current,
        spend: projectedSpend,
        clicks: Math.round(current.clicks * scale),
        impressions: Math.round(current.impressions * scale),
        conversions: current.conversions * scale,
        cpc: current.cpc,
        cpm: current.cpm,
        cpa: current.cpa,
        roas: current.roas,
        budgetUtilization: budgetType === "daily" ? current.budgetUtilization : (projectedSpend / proposedBudget) * 100,
    });
    return { projection, assumptions: ["Linear scaling from the stored demo window is assumed.", "CTR, CPC, CPA and ROAS are held constant; no market response or provider forecast is modeled.", "Simulated scenario — Not a prediction."] };
}
