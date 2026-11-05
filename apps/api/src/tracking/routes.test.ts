import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import test from "node:test";
import { createTrackingRouter } from "./routes.js";
import type { TrackingRepository, TrackingTable } from "./repository.js";
import type { TokenVerifier } from "../auth.js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";

const userId = "31000000-0000-4000-8000-000000000001";
const workspaceId = "32000000-0000-4000-8000-000000000001";
const eventId = "33000000-0000-4000-8000-000000000001";

function fixture() {
  let role = "owner";
  const records = new Map<TrackingTable, Record<string, unknown>[]>();
  const repository: TrackingRepository = {
    async getRole() { return role; },
    async billingSummary() { return { features: { "tracking.planning": true }, subscription: { status: "trialing" } }; },
    async list(table) { return records.get(table) ?? []; },
    async upsert(table, payload) {
      const rows = records.get(table) ?? [];
      const found = rows.find((row) => Object.entries(payload).some(([key, value]) => key.endsWith("_id") && row[key] === value));
      const saved = { ...found, ...payload, id: found?.id ?? eventId, created_at: found?.created_at ?? "2026-10-29T00:00:00.000Z" };
      records.set(table, [saved, ...rows.filter((row) => row.id !== saved.id)]);
      return saved;
    },
    async update(table, _workspaceId, id, payload) {
      const rows = records.get(table) ?? [];
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return null;
      const saved = { ...rows[index], ...payload };
      rows[index] = saved;
      records.set(table, rows);
      return saved;
    },
    async audit() { return []; },
  };
  const verifier: TokenVerifier = async (token) => token === "session-fixture"
    ? { status: "verified", user: { id: userId, email: null, emailConfirmedAt: null, createdAt: "2026-01-01T00:00:00.000Z" } }
    : { status: "invalid" };
  const app = express();
  app.use(express.json());
  app.use(createTrackingRouter(config, verifier, { repositoryFactory: () => repository }));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    else response.status(500).json({ error: { code: "internal_error", message: "Unexpected error." } });
  });
  return { app, setRole(value: string) { role = value; }, records };
}

async function withServer<T>(app: express.Express, action: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { return await action(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("tracking API enforces authentication, role and plan before saving a goal", async () => {
  const { app, setRole, records } = fixture();
  await withServer(app, async (base) => {
    const url = `${base}/api/workspaces/${workspaceId}/tracking/goals`;
    const anonymous = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(anonymous.status, 401);
    setRole("viewer");
    const denied = await fetch(url, { method: "POST", headers: { authorization: "Bearer session-fixture", "content-type": "application/json" }, body: JSON.stringify({ name: "Qualified lead", category: "lead", eventName: "QualifiedLead" }) });
    assert.equal(denied.status, 403, JSON.stringify(await denied.clone().json()));
    assert.equal(records.size, 0);
    setRole("owner");
    const saved = await fetch(url, { method: "POST", headers: { authorization: "Bearer session-fixture", "content-type": "application/json" }, body: JSON.stringify({ name: "Qualified lead", category: "lead", eventName: "QualifiedLead" }) });
    assert.equal(saved.status, 201);
    const payload = await saved.json() as { goal: { name: string }; dataKind: string };
    assert.equal(payload.goal.name, "Qualified lead");
    assert.equal(payload.dataKind, "PLANNED CONVERSION DEFINITION");
  });
});

test("synthetic event validation persists only a not-sent simulation result", async () => {
  const { app, records } = fixture();
  const eventRow = { id: eventId, workspace_id: workspaceId, event_key: "LEAD_FORM_SUBMITTED", expected_parameters: { lead_source: { type: "string", required: true } }, consent_required: true };
  records.set("conversion_event_definitions", [eventRow]);
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceId}/tracking/validate`, {
      method: "POST", headers: { authorization: "Bearer session-fixture", "content-type": "application/json" },
      body: JSON.stringify({ eventDefinitionId: eventId, parameters: {} }),
    });
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const payload = await response.json() as { result: string; delivery: string; externalCalls: number };
    assert.equal(payload.result, "fail");
    assert.equal(payload.delivery, "SIMULATED EVENT — NOT SENT TO PROVIDER");
    assert.equal(payload.externalCalls, 0);
    const runs = records.get("tracking_test_runs") ?? [];
    assert.equal(runs[0]?.delivery_status, "not_sent");
    assert.equal((runs[0]?.synthetic_preview as Record<string, unknown>).label, payload.delivery);
  });
});
