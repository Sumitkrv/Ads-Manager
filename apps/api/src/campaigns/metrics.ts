import { createHash } from "node:crypto";

export type DemoScenario = "low" | "average" | "high" | "gradual_improvement" | "decline";
export type DemoMetrics = { label: "Simulated Data — Not Actual Ad Performance"; scenario: DemoScenario; seed: number; simulatedAt: string; days: Array<{ date: string; impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number; cpa: number | null; roas: number | null }> };

export interface CampaignMetricsProvider { readonly source: "demo"; generate(seed: number, scenario: DemoScenario, dailyBudget: number, days: number, startDate: string, revenueAssumption?: number | null): DemoMetrics }
export interface FutureRealMetricsProvider extends Omit<CampaignMetricsProvider, "source"> { readonly source: "provider"; }
export class DemoMetricsProvider implements CampaignMetricsProvider {
  readonly source = "demo" as const;
  generate(seed: number, scenario: DemoScenario, dailyBudget: number, days: number, startDate: string, revenueAssumption: number | null = null): DemoMetrics {
    const rate = scenario === "low" ? 0.012 : scenario === "high" ? 0.045 : 0.027;
    const factor = (index: number) => scenario === "gradual_improvement" ? 0.7 + index / Math.max(days - 1, 1) * 0.6 : scenario === "decline" ? 1.3 - index / Math.max(days - 1, 1) * 0.6 : 1;
    const start = new Date(`${startDate}T12:00:00.000Z`);
    const values = Array.from({ length: Math.max(1, Math.min(days, 90)) }, (_, index) => {
      const jitterHash = createHash("sha256").update(`${seed}:${scenario}:${index}`).digest("hex").slice(0, 8);
      const jitter = 0.92 + (parseInt(jitterHash, 16) / 0xffffffff) * 0.16;
      const spend = Math.round(dailyBudget * Math.min(1, (0.68 + ((seed + index) % 17) / 100) * factor(index)) * 100) / 100;
      const cpc = Math.max(0.25, Math.round((1.3 + ((seed >>> (index % 24)) % 11) / 10) * 100) / 100);
      const clicks = Math.max(0, Math.round((spend / cpc) * jitter));
      const impressions = Math.max(clicks, Math.round(clicks / (0.018 + ((seed + index) % 12) / 1000)));
      const conversions = Math.max(0, Math.round(clicks * rate * factor(index) * jitter));
      const date = new Date(start); date.setUTCDate(start.getUTCDate() + index);
      const ctr = impressions ? clicks / impressions * 100 : 0;
      const cpa = conversions ? spend / conversions : null;
      const revenue = revenueAssumption === null ? null : conversions * revenueAssumption;
      return { date: date.toISOString().slice(0, 10), impressions, clicks, spend, conversions, ctr: Math.round(ctr * 100) / 100, cpc: clicks ? Math.round(spend / clicks * 100) / 100 : 0, cpa: cpa === null ? null : Math.round(cpa * 100) / 100, roas: revenue === null || spend === 0 ? null : Math.round(revenue / spend * 100) / 100 };
    });
    return { label: "Simulated Data — Not Actual Ad Performance", scenario, seed, simulatedAt: new Date().toISOString(), days: values };
  }
}
