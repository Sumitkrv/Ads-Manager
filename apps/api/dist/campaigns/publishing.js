/** This provider writes Tandem Ads demo records only. It performs no network or provider operation. */
export class DemoCampaignPublishingProvider {
    mode = "demo";
    publish(input) {
        return input.repository.simulatePublish(input.workspaceId, input.campaignId, input.revision, input.scenario, input.seed, input.metrics);
    }
}
