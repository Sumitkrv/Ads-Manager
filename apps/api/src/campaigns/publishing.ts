import type { DemoMetrics } from "./metrics.js";
import type { CampaignRepository } from "./repository.js";

export interface CampaignPublishingProvider {
  readonly mode: "demo";
  publish(input: { repository: CampaignRepository; workspaceId: string; campaignId: string; revision: number; scenario: "success" | "provider_unavailable"; seed: number; metrics: DemoMetrics | null }): Promise<Record<string, unknown>>;
}

/** This provider writes Tandem Ads demo records only. It performs no network or provider operation. */
export class DemoCampaignPublishingProvider implements CampaignPublishingProvider {
  readonly mode = "demo" as const;
  publish(input: Parameters<CampaignPublishingProvider["publish"]>[0]) {
    return input.repository.simulatePublish(input.workspaceId, input.campaignId, input.revision, input.scenario, input.seed, input.metrics);
  }
}
