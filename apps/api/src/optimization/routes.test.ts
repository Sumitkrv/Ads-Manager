import assert from "node:assert/strict";
import { once } from "node:events";
import express, { type ErrorRequestHandler } from "express";
import test from "node:test";
import type { AuthenticatedApiUser, TokenVerifier } from "../auth.js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createOptimizationRouter } from "./routes.js";
import type { OptimizationRepository } from "./repository.js";

const workspaceA = "82000000-0000-4000-8000-000000000001";
const workspaceB = "82000000-0000-4000-8000-000000000002";
const ownerId = "81000000-0000-4000-8000-000000000001";
const viewerId = "81000000-0000-4000-8000-000000000003";
const timestamp = "2026-10-28T00:00:00.000Z";
const users: Record<string, AuthenticatedApiUser> = {
  owner: { id: ownerId, email: "owner@example.invalid", emailConfirmedAt: timestamp, createdAt: timestamp },
  viewer: { id: viewerId, email: "viewer@example.invalid", emailConfirmedAt: timestamp, createdAt: timestamp },
};
const verifier: TokenVerifier = async (token) => users[token] ? { status: "verified", user: users[token]! } : { status: "invalid" };

function fixtureRepository() {
  const calls = { saveRule: 0, execute: 0, decide: 0 };
  const repository: OptimizationRepository = {
    async getRole(workspace, userId) { return workspace === workspaceA && userId === ownerId ? "owner" : workspace === workspaceA && userId === viewerId ? "viewer" : null; },
    async campaigns() { return []; }, async analytics() { return []; }, async recommendations() { return []; },
    async createRecommendation() { throw new Error("not used"); }, async transitionRecommendation() { throw new Error("not used"); },
    async scenarios() { return []; }, async createScenario() { throw new Error("not used"); }, async transitionScenario() { throw new Error("not used"); },
    async rules() { return []; },
    async saveRule(workspaceId, id, version, name, definition, enabled) { calls.saveRule += 1; return { id: id ?? "83000000-0000-4000-8000-000000000001", workspace_id: workspaceId, name, definition, version: (version ?? 0) + 1, enabled, created_at: timestamp, updated_at: timestamp }; },
    async executeRule(workspaceId, ruleId, campaignId, idempotencyKey) { calls.execute += 1; return { id: "84000000-0000-4000-8000-000000000001", workspace_id: workspaceId, rule_id: ruleId, campaign_id: campaignId, idempotency_key: idempotencyKey, lifecycle_status: "evaluated", matched: false, created_at: timestamp }; },
    async executions() { return { rows: [], total: 0 }; },
    async decideExecution() { calls.decide += 1; return { id: "84000000-0000-4000-8000-000000000001", workspace_id: workspaceB }; },
    async notifications() { return []; }, async updateNotification() { throw new Error("not used"); }, async activity() { return { rows: [], total: 0 }; },
  };
  return { repository, calls };
}

async function withApi(repo: OptimizationRepository, run: (base: string) => Promise<void>) {
  const app = express(); app.use(express.json()); app.use(createOptimizationRouter(config, verifier, { repositoryFactory: () => repo }));
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    else response.status(500).json({ error: { code: "internal_error" } });
  };
  app.use(errors);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

const validRule = {
  name: "Low simulated CTR", enabled: false,
  definition: { version: 1, trigger: "manual", conditionLogic: "all", conditions: [{ metric: "ctr", operator: "lt", threshold: 1 }], action: "create_recommendation", approvalRequired: true, industry: "professional_services" },
};

test("optimization endpoints require an authenticated workspace member", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceA}/automation/rules`);
    assert.equal(response.status, 401);
    assert.equal(fixture.calls.saveRule, 0);
  });
});

test("viewer cannot create rules and arbitrary action payloads are rejected before persistence", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, async (base) => {
    const viewer = await fetch(`${base}/api/workspaces/${workspaceA}/automation/rules`, { method: "POST", headers: { authorization: "Bearer viewer", "content-type": "application/json" }, body: JSON.stringify(validRule) });
    assert.equal(viewer.status, 403);
    const unsafe = await fetch(`${base}/api/workspaces/${workspaceA}/automation/rules`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ ...validRule, definition: { ...validRule.definition, action: "run_javascript" } }) });
    assert.equal(unsafe.status, 400);
    assert.equal(fixture.calls.saveRule, 0);
  });
});

test("owner can persist a disabled manual rule through the guarded repository", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceA}/automation/rules`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify(validRule) });
    assert.equal(response.status, 201);
    const body = await response.json() as { rule: { enabled: boolean; definition: { trigger: string } } };
    assert.equal(body.rule.enabled, false);
    assert.equal(body.rule.definition.trigger, "manual");
    assert.equal(fixture.calls.saveRule, 1);
  });
});

test("a guessed execution belonging to another tenant is hidden", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceA}/automation/executions/84000000-0000-4000-8000-000000000001/decision`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ decision: "approve", expectedVersion: 1, expectedRuleVersion: 1 }) });
    assert.equal(response.status, 404);
    assert.equal(fixture.calls.decide, 1);
  });
});
