import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createPlatformAdminRouter } from "./routes.js";
const operator = { id: "d1000000-0000-4000-8000-000000000001", email: "operator@example.invalid", emailConfirmedAt: null, createdAt: "2026-10-29T00:00:00.000Z" };
const ordinary = { ...operator, id: "d1000000-0000-4000-8000-000000000002", email: "member@example.invalid" };
const supportOnly = { ...operator, id: "d1000000-0000-4000-8000-000000000003", email: "support@example.invalid" };
const identities = { operator, ordinary, supportOnly };
const verifier = async (token) => identities[token] ? { status: "verified", user: identities[token] } : { status: "invalid" };
function createFixture() {
    const writes = [];
    const rows = new Map();
    const repository = {
        async hasCapability(actorId, capability) { return actorId === operator.id && capability === "platform.dashboard.read" || actorId === supportOnly.id && capability === "platform.support.manage"; },
        async rpc() { return null; },
        async getTourProgress(userId) { return rows.get(userId) ?? null; },
        async saveTourProgress(userId, stepIndex, status) {
            writes.push(userId);
            const now = "2026-10-29T12:00:00.000Z";
            const prior = rows.get(userId);
            const row = { tour_id: "platform-operator", step_index: stepIndex, status, started_at: prior?.started_at ?? now, updated_at: now, completed_at: status === "completed" ? now : null };
            rows.set(userId, row);
            return row;
        },
    };
    const dependencies = { repositoryFactory: () => repository };
    const router = createPlatformAdminRouter({ ...config, SUPABASE_URL: "http://127.0.0.1:54321", APP_ENV: "development" }, verifier, dependencies);
    return { router, writes };
}
async function dispatch(router, method, path, token, body) {
    return new Promise((resolve, reject) => {
        const app = express();
        const headers = { authorization: `Bearer ${token}` };
        const req = Object.assign(Object.create(express.request), {
            app, method, url: path, originalUrl: path, baseUrl: "", params: {}, body,
            headers,
            get(name) { return headers[name.toLowerCase()]; },
        });
        const res = Object.assign(Object.create(express.response), {
            app, locals: {}, statusCode: 200,
            setHeader() { return this; },
            status(code) { this.statusCode = code; return this; },
            json(value) { resolve({ status: this.statusCode, body: value }); return this; },
        });
        router.handle(req, res, (error) => {
            if (error instanceof HttpError) {
                resolve({ status: error.statusCode, body: { error: { code: error.code, message: error.message } } });
                return;
            }
            if (error) {
                reject(error);
                return;
            }
            resolve({ status: 404, body: null });
        });
    });
}
test("platform tour API checks dashboard capability and writes only for the verified user", async () => {
    const { router, writes } = createFixture();
    const denied = await dispatch(router, "POST", "/api/platform-admin/tour-progress", "ordinary", { tourId: "platform-operator", stepIndex: 1, status: "running" });
    const supportWithoutConsole = await dispatch(router, "POST", "/api/platform-admin/tour-progress", "supportOnly", { tourId: "platform-operator", stepIndex: 1, status: "running" });
    assert.equal(denied.status, 403);
    assert.equal(supportWithoutConsole.status, 403);
    assert.deepEqual(writes, []);
    const saved = await dispatch(router, "POST", "/api/platform-admin/tour-progress", "operator", { tourId: "platform-operator", stepIndex: 1, status: "running" });
    assert.equal(saved.status, 200);
    assert.deepEqual(writes, [operator.id]);
    assert.deepEqual(saved.body, { progress: { tourId: "platform-operator", stepIndex: 1, status: "running", startedAt: "2026-10-29T12:00:00.000Z", updatedAt: "2026-10-29T12:00:00.000Z", completedAt: null } });
    const resumed = await dispatch(router, "GET", "/api/platform-admin/tour-progress", "operator");
    assert.equal(resumed.status, 200);
    assert.deepEqual(resumed.body, saved.body);
});
test("platform tour API rejects identity fields and invalid progress before persistence", async () => {
    const { router, writes } = createFixture();
    const spoofed = await dispatch(router, "POST", "/api/platform-admin/tour-progress", "operator", { tourId: "platform-operator", stepIndex: 1, status: "completed", userId: ordinary.id });
    const invalidStep = await dispatch(router, "POST", "/api/platform-admin/tour-progress", "operator", { tourId: "platform-operator", stepIndex: 9, status: "running" });
    assert.equal(spoofed.status, 400);
    assert.equal(invalidStep.status, 400);
    assert.deepEqual(writes, []);
});
