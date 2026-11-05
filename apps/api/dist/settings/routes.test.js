import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import test from "node:test";
import { DEFAULT_USER_PREFERENCES, DEFAULT_WORKSPACE_PREFERENCES } from "@ai-ads/shared";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createSettingsRouter } from "./routes.js";
const workspaceA = "82000000-0000-4000-8000-000000000001";
const workspaceB = "82000000-0000-4000-8000-000000000002";
const ownerId = "81000000-0000-4000-8000-000000000001";
const viewerId = "81000000-0000-4000-8000-000000000002";
const stamp = "2026-10-29T00:00:00.000Z";
const users = {
    owner: { id: ownerId, email: "owner@example.invalid", emailConfirmedAt: stamp, createdAt: stamp },
    viewer: { id: viewerId, email: "viewer@example.invalid", emailConfirmedAt: stamp, createdAt: stamp },
};
const verifier = async (token) => users[token] ? { status: "verified", user: users[token] } : { status: "invalid" };
function fixture() {
    const calls = { saves: 0, invites: 0, roleChanges: 0, removals: 0, closureRequests: 0, lastInviteHash: "" };
    const repository = {
        async getUserPreferences() { return DEFAULT_USER_PREFERENCES; },
        async saveUserPreferences(_userId, value) { calls.saves += 1; return value; },
        async getWorkspaceRole(workspaceId, userId) { return workspaceId === workspaceA && userId === ownerId ? "owner" : workspaceId === workspaceA && userId === viewerId ? "viewer" : null; },
        async getWorkspacePreferences() { return DEFAULT_WORKSPACE_PREFERENCES; },
        async saveWorkspacePreferences(_workspaceId, value) { calls.saves += 1; return value; },
        async getTeam() { return { members: [], invitations: [], role: "owner", emailDelivery: "not_emailed" }; },
        async createInvitation(input) { calls.invites += 1; calls.lastInviteHash = input.tokenHash; return { id: "83000000-0000-4000-8000-000000000001", invited_email: input.email, invited_role: input.role, status: "pending", expires_at: input.expiresAt }; },
        async revokeInvitation(_workspaceId, invitationId) { return { id: invitationId, status: "revoked" }; },
        async updateMemberRole(_workspaceId, userId, role) { calls.roleChanges += 1; return { user_id: userId, role }; },
        async removeMember(_workspaceId, userId) { calls.removals += 1; return { user_id: userId, status: "removed" }; },
        async activity() { return []; },
        async requestClosure(scope, workspaceId) { calls.closureRequests += 1; return { id: "84000000-0000-4000-8000-000000000001", scope, status: "pending_review", created_at: stamp, workspace_id: workspaceId }; },
        async closureRequests() { return []; },
        async accountExport(userId) { return { profile: { userId }, preferences: DEFAULT_USER_PREFERENCES }; },
        async workspaceExport() { return { workspace: { id: workspaceA }, preferences: DEFAULT_WORKSPACE_PREFERENCES }; },
    };
    return { repository, calls };
}
async function withApi(repository, run) {
    const app = express();
    const testConfig = { ...config, corsAllowedOrigins: ["http://test.local"] };
    app.use(express.json());
    app.use(createSettingsRouter(testConfig, verifier, { repositoryFactory: () => repository }));
    const errors = (error, _request, response, _next) => {
        if (error instanceof HttpError)
            response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        else
            response.status(500).json({ error: { code: "internal_error" } });
    };
    app.use(errors);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
        await run(`http://127.0.0.1:${address.port}`);
    }
    finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}
test("settings endpoints require a verified account session", async () => {
    const { repository, calls } = fixture();
    await withApi(repository, async (base) => {
        const response = await fetch(`${base}/api/me/preferences`);
        assert.equal(response.status, 401);
        assert.equal(calls.saves, 0);
    });
});
test("personal preference patches validate fields and persist only allowed values", async () => {
    const { repository, calls } = fixture();
    await withApi(repository, async (base) => {
        const invalid = await fetch(`${base}/api/me/preferences`, { method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ isPlatformAdmin: true }) });
        assert.equal(invalid.status, 400);
        const saved = await fetch(`${base}/api/me/preferences`, { method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ themePreference: "dark" }) });
        assert.equal(saved.status, 200);
        assert.equal((await saved.json()).preferences.themePreference, "dark");
        assert.equal(calls.saves, 1);
    });
});
test("a viewer cannot change shared defaults or membership roles", async () => {
    const { repository, calls } = fixture();
    await withApi(repository, async (base) => {
        const defaults = await fetch(`${base}/api/workspaces/${workspaceA}/preferences`, { method: "PATCH", headers: { authorization: "Bearer viewer", "content-type": "application/json" }, body: JSON.stringify({ displayDensity: "compact" }) });
        assert.equal(defaults.status, 403);
        const role = await fetch(`${base}/api/workspaces/${workspaceA}/team/${ownerId}`, { method: "PATCH", headers: { authorization: "Bearer viewer", "content-type": "application/json" }, body: JSON.stringify({ role: "admin" }) });
        assert.equal(role.status, 403);
        assert.equal(calls.saves, 0);
        assert.equal(calls.roleChanges, 0);
    });
});
test("team invitations return a manually shareable link and persist only a token hash", async () => {
    const { repository, calls } = fixture();
    await withApi(repository, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${workspaceA}/team/invitations`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json", origin: "http://test.local" }, body: JSON.stringify({ email: "new@example.invalid", role: "viewer" }) });
        assert.equal(response.status, 201);
        const body = await response.json();
        assert.match(body.invitationLink, /#token=/);
        assert.equal(body.delivery, "not_emailed");
        assert.match(body.copyInstruction, /not emailed/i);
        assert.match(calls.lastInviteHash, /^[a-f0-9]{64}$/);
        assert.equal(body.invitationLink.includes(calls.lastInviteHash), false);
        assert.equal(calls.invites, 1);
    });
});
test("an account closure request records pending review without reporting deletion", async () => {
    const { repository, calls } = fixture();
    await withApi(repository, async (base) => {
        const response = await fetch(`${base}/api/me/closure-requests`, { method: "POST", headers: { authorization: "Bearer owner" } });
        assert.equal(response.status, 201);
        const body = await response.json();
        assert.equal(body.request.status, "pending_review");
        assert.match(body.message, /No data was deleted/);
        assert.equal(calls.closureRequests, 1);
    });
});
test("workspace closure requests are owner-only", async () => {
    const { repository, calls } = fixture();
    await withApi(repository, async (base) => {
        const denied = await fetch(`${base}/api/workspaces/${workspaceA}/closure-requests`, { method: "POST", headers: { authorization: "Bearer viewer" } });
        assert.equal(denied.status, 403);
        const allowed = await fetch(`${base}/api/workspaces/${workspaceA}/closure-requests`, { method: "POST", headers: { authorization: "Bearer owner" } });
        assert.equal(allowed.status, 201);
        assert.equal(calls.closureRequests, 1);
    });
});
test("workspace exports and team role changes remain scoped to the requested tenant", async () => {
    const { repository, calls } = fixture();
    await withApi(repository, async (base) => {
        const hidden = await fetch(`${base}/api/workspaces/${workspaceB}/export`, { headers: { authorization: "Bearer owner" } });
        assert.equal(hidden.status, 404);
        const change = await fetch(`${base}/api/workspaces/${workspaceA}/team/${viewerId}`, { method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ role: "editor" }) });
        assert.equal(change.status, 200);
        assert.equal(calls.roleChanges, 1);
    });
});
