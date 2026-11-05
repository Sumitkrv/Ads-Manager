import assert from "node:assert/strict";
import test from "node:test";
import { ConversionGoalInputSchema, EventDefinitionInputSchema, TrackingTestInputSchema, UTMTemplateInputSchema, buildTrackingUrl, readinessScore, READINESS_REQUIREMENTS, } from "@ai-ads/shared";
const validUtm = {
    name: "Spring search", destinationUrl: "https://example.test/landing?lang=en&x=a%20b#form",
    source: "google ads", medium: "paid search", campaign: "spring launch",
    content: "headline 1", term: "", customParameters: [], replaceExisting: false,
    campaignId: null, goalId: null, status: "active",
};
test("UTM builder preserves unrelated query parameters and URL fragment while encoding once", () => {
    const result = buildTrackingUrl(UTMTemplateInputSchema.parse(validUtm));
    const url = new URL(result.url);
    assert.equal(url.searchParams.get("lang"), "en");
    assert.equal(url.searchParams.get("x"), "a b");
    assert.equal(url.searchParams.get("utm_source"), "google ads");
    assert.equal(url.searchParams.get("utm_campaign"), "spring launch");
    assert.equal(url.hash, "#form");
    assert.equal(result.url.includes("%2520"), false);
});
test("UTM builder requires explicit replacement and rejects unsafe URLs or personal data", () => {
    assert.equal(UTMTemplateInputSchema.safeParse({ ...validUtm, destinationUrl: "javascript:alert(1)" }).success, false);
    assert.equal(UTMTemplateInputSchema.safeParse({ ...validUtm, source: "person@example.test" }).success, false);
    assert.equal(UTMTemplateInputSchema.safeParse({ ...validUtm, destinationUrl: "https://example.test/?utm_source=old" }).success, false);
    const replaced = buildTrackingUrl(UTMTemplateInputSchema.parse({ ...validUtm, destinationUrl: "https://example.test/?utm_source=old&keep=1", replaceExisting: true }));
    assert.equal(new URL(replaced.url).searchParams.get("utm_source"), "google ads");
    assert.equal(new URL(replaced.url).searchParams.get("keep"), "1");
    assert.equal(replaced.warnings.length, 1);
});
test("readiness percentage is derived only from stored required checklist IDs", () => {
    assert.equal(readinessScore(new Set()), 0);
    assert.equal(readinessScore(new Set(READINESS_REQUIREMENTS.slice(0, 4).map((item) => item.id))), 50);
    assert.equal(readinessScore(new Set(READINESS_REQUIREMENTS.map((item) => item.id))), 100);
    assert.equal(readinessScore(new Set(["invented-provider-verification"])), 0);
});
test("conversion goals remain definitions and validate currency/value pairing", () => {
    const goal = ConversionGoalInputSchema.parse({ name: "Lead form", category: "lead", eventName: "LEAD_FORM_SUBMITTED" });
    assert.equal(goal.status, "draft");
    assert.equal(ConversionGoalInputSchema.safeParse({ name: "Purchase", category: "sale", eventName: "purchase", illustrativeValue: 80 }).success, false);
    assert.equal(ConversionGoalInputSchema.safeParse({ name: "Bad goal", category: "lead", eventName: "not valid!" }).success, false);
});
test("event definitions and synthetic test inputs reject malformed or personal payloads", () => {
    const event = EventDefinitionInputSchema.safeParse({ eventKey: "LEAD_FORM_SUBMITTED", displayName: "Lead", sourceType: "website", expectedParameters: { lead_source: { type: "string", required: true } } });
    assert.equal(event.success, true);
    assert.equal(TrackingTestInputSchema.safeParse({ eventDefinitionId: "31000000-0000-4000-8000-000000000001", parameters: { email: "person@example.test" } }).success, false);
    assert.equal(TrackingTestInputSchema.safeParse({ eventDefinitionId: "31000000-0000-4000-8000-000000000001", parameters: { id: "123456789012" } }).success, false);
});
