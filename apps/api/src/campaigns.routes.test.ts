import assert from "node:assert/strict";
import { once } from "node:events";
import express, { type ErrorRequestHandler } from "express";
import test from "node:test";
import { CampaignBriefSchema, CampaignRecordSchema, type CampaignPlan, type CampaignRecord } from "@ai-ads/shared";
import type { AuthenticatedApiUser, TokenVerifier } from "./auth.js";
import { config, type ApiConfig } from "./config.js";
import { HttpError } from "./errors.js";
import { createCampaignsRouter, type CampaignRouteDependencies } from "./campaigns/routes.js";
import { SimulationCampaignProvider } from "./campaigns/engine.js";
import { OpenAICampaignGenerationProvider } from "./campaigns/openai-provider.js";
import type { CampaignRepository } from "./campaigns/repository.js";

const workspaceOne = "62000000-0000-4000-8000-000000000001";
const workspaceTwo = "62000000-0000-4000-8000-000000000002";
const campaignId = "63000000-0000-4000-8000-000000000001";
const ownerId = "61000000-0000-4000-8000-000000000001";
const viewerId = "61000000-0000-4000-8000-000000000004";
const timestamp = "2026-10-28T00:00:00.000Z";
const brief = CampaignBriefSchema.parse({
  businessName: "Northstar Studio", industry: "professional_services", industryLabel: null,
  productService: "Brand strategy", businessDescription: "Independent brand consulting.", offer: "Introductory consultation",
  landingPageUrl: "https://northstar.example/services", uniqueSellingPoints: ["Senior-led delivery"], brandVoice: "confident",
  preferredCta: "Book a consultation", country: "India", regions: ["Pune"], language: "English",
  intendedCustomer: "Growing service businesses", audienceDescription: "Teams evaluating brand strategy.",
  keywords: ["brand strategy consultant"], interestThemes: ["business strategy"], exclusions: [],
  budgetType: "daily", budgetAmount: 100, currency: "INR", startDate: "2026-11-01", endDate: "2026-11-30",
  budgetRationale: "Demo planning only.", biddingPreference: "manual_review", tone: "confident", mainMessage: "Clear positioning.",
  promotionalHook: "Plan the next move", brandAttributes: ["thoughtful"], copyStyle: "benefit_led",
});

const users: Record<string, AuthenticatedApiUser> = {
  "owner-token": { id: ownerId, email: "owner@example.invalid", emailConfirmedAt: timestamp, createdAt: timestamp },
  "viewer-token": { id: viewerId, email: "viewer@example.invalid", emailConfirmedAt: timestamp, createdAt: timestamp },
};
const verifier: TokenVerifier = async (token) => users[token]
  ? { status: "verified", user: users[token]! }
  : { status: "invalid" };

function fixtureRecord(input: { workspaceId?: string; plan?: CampaignRecord["plan"]; status?: CampaignRecord["status"] } = {}): CampaignRecord {
  return CampaignRecordSchema.parse({
    id: campaignId, workspaceId: input.workspaceId ?? workspaceOne, name: "Northstar search draft", platform: "google_ads",
    objective: "website_traffic", status: input.status ?? (input.plan ? "generated_simulation" : "draft"), revision: 1,
    approvedRevision: input.status === "approved_for_demo" ? 1 : null, generatedAt: input.plan ? timestamp : null,
    createdAt: timestamp, updatedAt: timestamp, generationMode: input.plan?.generation.mode ?? "none",
    executionMode: "demo", publishedExternally: false, brief, plan: input.plan ?? null,
  });
}

function fixtureRepository(initial: CampaignRecord | null = null) {
  let stored = initial;
  let createCalls = 0;
  let publishCalls = 0;
  const repository = {
    async getRole(workspace: string, userId: string) {
      if (workspace === workspaceOne && userId === ownerId) return "owner";
      if (workspace === workspaceOne && userId === viewerId) return "viewer";
      return null;
    },
    async list() { return { campaigns: [], counts: {}, total: 0 }; },
    async get(workspace: string, id: string) { return stored?.workspaceId === workspace && stored.id === id ? stored : null; },
    async create(workspace: string, _userId: string, input: Record<string, unknown>) {
      createCalls += 1;
      stored = fixtureRecord({ workspaceId: workspace, plan: (input.plan as CampaignRecord["plan"]) ?? null });
      return stored;
    },
    async save(workspace: string, id: string, _revision: number, input: Record<string, unknown>) {
      assert.equal(stored?.workspaceId, workspace);
      assert.equal(stored?.id, id);
      const plan = (input.plan as CampaignRecord["plan"] | undefined) ?? null;
      stored = CampaignRecordSchema.parse({ ...stored, ...input, generationMode: plan?.generation.mode ?? "none", revision: (stored?.revision ?? 0) + 1, updatedAt: "2026-10-28T00:01:00.000Z", status: plan ? "generated_simulation" : "draft" });
      return stored;
    },
    async duplicate() { throw new Error("not used in this fixture"); },
    async archive() { throw new Error("not used in this fixture"); },
    async submitReview() { throw new Error("not used in this fixture"); },
    async decideReview() { throw new Error("not used in this fixture"); },
    async simulatePublish(_workspace: string, id: string, revision: number, scenario: string) {
      publishCalls += 1;
      return { status: scenario === "success" ? "succeeded" : "failed", campaign_id: id, revision, local_demo_reference: "demo_fixture", published_externally: false };
    },
    async activity() { return []; }, async reviews() { return []; }, async analytics() { return []; },
  } as unknown as CampaignRepository;
  return { repository, get stored() { return stored; }, get createCalls() { return createCalls; }, get publishCalls() { return publishCalls; } };
}

async function withApi<T>(
  repository: CampaignRepository,
  run: (base: string) => Promise<T>,
  options: { apiConfig?: ApiConfig; dependencies?: Omit<CampaignRouteDependencies, "repositoryFactory"> } = {},
): Promise<T> {
  const app = express(); app.use(express.json());
  app.use(createCampaignsRouter(options.apiConfig ?? config, verifier, { repositoryFactory: () => repository, ...options.dependencies }));
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    else response.status(500).json({ error: { code: "internal_error" } });
  };
  app.use(errors);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try { return await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("campaign API requires authentication before workspace access", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns`);
    assert.equal(response.status, 401);
    assert.equal(fixture.createCalls, 0);
  });
});

test("owner draft creation persists a real campaign record through the repository", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns`, {
      method: "POST", headers: { authorization: "Bearer owner-token", "content-type": "application/json" },
      body: JSON.stringify({ name: "Northstar Search", platform: "google_ads", objective: "website_traffic", brief, plan: null }),
    });
    assert.equal(response.status, 201);
    assert.equal(fixture.createCalls, 1);
    assert.equal(fixture.stored?.workspaceId, workspaceOne);
    assert.equal(fixture.stored?.publishedExternally, false);
  });
});

test("viewer campaign writes and guessed cross-workspace campaign reads are denied", async () => {
  const fixture = fixtureRepository(fixtureRecord({ workspaceId: workspaceTwo }));
  await withApi(fixture.repository, async (base) => {
    const write = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns`, {
      method: "POST", headers: { authorization: "Bearer viewer-token", "content-type": "application/json" },
      body: JSON.stringify({ name: "Viewer attempt", platform: "google_ads", objective: "website_traffic", brief, plan: null }),
    });
    assert.equal(write.status, 403);
    assert.equal(fixture.createCalls, 0);
    const read = await fetch(`${base}/api/workspaces/${workspaceTwo}/campaigns/${campaignId}`, { headers: { authorization: "Bearer owner-token" } });
    assert.equal(read.status, 404);
  });
});

test("generate-demo persists a structured plan and marks the returned source as simulation", async () => {
  const generator = new SimulationCampaignProvider();
  const initial = fixtureRecord();
  const fixture = fixtureRepository(initial);
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns/${campaignId}/generate-demo`, {
      method: "POST", headers: { authorization: "Bearer owner-token", "content-type": "application/json" }, body: JSON.stringify({ seed: 77 }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { campaign: CampaignRecord; generation: { mode: string; label: string } };
    assert.equal(body.campaign.plan?.generation.seed, 77);
    assert.equal(body.generation.mode, "simulation");
    assert.equal(body.generation.label, "AI Simulation");
    assert.equal(fixture.stored?.plan?.platform, "google_ads");
    assert.equal(generator.mode, "simulation");
  });
});

test("external AI generation remains disabled even when credentials and an adapter are supplied", async () => {
  const fixture = fixtureRepository(fixtureRecord());
  const calls: string[] = [];
  const localPlan = new SimulationCampaignProvider().generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 17 });
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns/${campaignId}/generate-openai`, {
      method: "POST", headers: { authorization: "Bearer owner-token", "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "71000000-0000-4000-8000-000000000001", consentToExternalProcessing: true }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(calls, []);
  }, {
    apiConfig: { ...config, CAMPAIGN_GENERATION_MODE: "openai", OPENAI_API_KEY: "test-key", OPENAI_CAMPAIGN_MODEL: "test-model" },
    dependencies: {
      usageMeterFactory: () => ({ async consume() { calls.push("meter"); } }),
      liveGenerationProvider: { async generateCampaign() { calls.push("provider"); return localPlan; } },
    },
  });
});

test("configured OpenAI credentials do not activate external generation in this milestone", async () => {
  const fixture = fixtureRepository(fixtureRecord());
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns/${campaignId}/generate-openai`, {
      method: "POST", headers: { authorization: "Bearer owner-token", "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "71000000-0000-4000-8000-000000000002", consentToExternalProcessing: true }),
    });
    assert.equal(response.status, 503);
    assert.equal(fixture.stored?.revision, 1);
  }, { apiConfig: { ...config, CAMPAIGN_GENERATION_MODE: "openai", OPENAI_API_KEY: "test-key", OPENAI_CAMPAIGN_MODEL: "test-model" } });
});

test("campaign edits preserve the trusted generation source recorded on the current plan", async () => {
  const plan = new SimulationCampaignProvider().generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 19 });
  const openAiPlan: CampaignPlan = { ...plan, generation: { ...plan.generation, mode: "openai", label: "AI Generated Draft", version: "test-model" } };
  const fixture = fixtureRepository(fixtureRecord({ plan: openAiPlan }));
  const forgedPlan = { ...openAiPlan, generation: { ...openAiPlan.generation, mode: "simulation", label: "AI Simulation", version: "tandem-rule-engine-v1" } } as CampaignPlan;
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns/${campaignId}`, {
      method: "PATCH", headers: { authorization: "Bearer owner-token", "content-type": "application/json" },
      body: JSON.stringify({ name: "Northstar search draft", platform: "google_ads", objective: "website_traffic", brief, plan: forgedPlan, expectedRevision: 1 }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { campaign: CampaignRecord };
    assert.equal(body.campaign.plan?.generation.mode, "openai");
    assert.equal(body.campaign.plan?.generation.label, "AI Generated Draft");
    assert.equal(body.campaign.plan?.generation.version, "test-model");
  });
});

test("OpenAI provider uses strict structured output and validates the returned campaign draft", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody: Record<string, unknown> = {};
  const responseBody = {
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
      strategy: "Focus on clear positioning.", audienceSuggestions: ["Growing service businesses"],
      creativeSuggestions: ["Lead with the planning benefit."], warnings: [],
      headlines: ["Build a clearer brand", "Plan your next growth", "Find your market focus"],
      descriptions: ["Get expert support for your positioning.", "Book a consultation with our team."],
      keywords: ["brand strategy"], audience: "Business owners reviewing their brand positioning.",
      primaryText: "Clarify your brand position with senior-led strategy.", metaHeadline: "A clearer brand strategy", metaDescription: "Book a consultation.",
    }) }] }],
  };
  const provider = new OpenAICampaignGenerationProvider({
    apiKey: "test-key", model: "test-model", timeoutMs: 1000,
    fetchImplementation: async (input, init) => {
      capturedUrl = String(input); capturedHeaders = init?.headers; capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify(responseBody), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await provider.generateCampaign({ platform: "google_ads", objective: "website_traffic", brief });
  assert.equal(capturedUrl, "https://api.openai.com/v1/responses");
  assert.equal(new Headers(capturedHeaders).get("authorization"), "Bearer test-key");
  assert.equal(capturedBody.store, false);
  const text = capturedBody.text as { format: { type: string; strict: boolean; schema: Record<string, unknown> } };
  assert.equal(text.format.type, "json_schema");
  assert.equal(text.format.strict, true);
  assert.equal(result.generation.mode, "openai");
  assert.equal(result.generation.label, "AI Generated Draft");
  assert.equal(result.google?.adGroups[0]?.ads[0]?.finalUrl, brief.landingPageUrl);
  assert.ok(result.warnings.some((warning) => warning.includes("requires human review")));
});

test("simulated publishing requires an approved current revision and records only a demo reference", async () => {
  const plan = new SimulationCampaignProvider().generateCampaign({ platform: "google_ads", objective: "website_traffic", brief, seed: 9 });
  const fixture = fixtureRepository(fixtureRecord({ plan, status: "approved_for_demo" }));
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceOne}/campaigns/${campaignId}/simulate-publish`, {
      method: "POST", headers: { authorization: "Bearer owner-token", "content-type": "application/json" }, body: JSON.stringify({ scenario: "success", scenarioMetrics: "average", seed: 99 }),
    });
    assert.equal(response.status, 201);
    const body = await response.json() as { attempt: { local_demo_reference: string; published_externally: boolean } };
    assert.match(body.attempt.local_demo_reference, /^demo_/);
    assert.equal(body.attempt.published_externally, false);
    assert.equal(fixture.publishCalls, 1);
  });
});
