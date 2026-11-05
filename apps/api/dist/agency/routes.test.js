import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import test from "node:test";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createAgencyRouter } from "./routes.js";
import { createHash } from "node:crypto";
const agencyId = "92000000-0000-4000-8000-000000000001";
const clientId = "92000000-0000-4000-8000-000000000002";
const relationId = "92000000-0000-4000-8000-000000000003";
const ownerId = "91000000-0000-4000-8000-000000000001";
const editorId = "91000000-0000-4000-8000-000000000002";
const user = { id: ownerId, email: "owner@example.invalid", emailConfirmedAt: "2026-10-28T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z" };
const editor = { ...user, id: editorId, email: "editor@example.invalid" };
const relation = { id: relationId, agency_workspace_id: agencyId, client_workspace_id: clientId, request_direction: "agency_to_client", status: "pending", requested_at: "2026-10-28T00:00:00.000Z" };
const users = { owner: user, editor };
const verifier = async (token) => users[token] ? { status: "verified", user: users[token] } : { status: "invalid" };
function fixture() {
    const state = {
        storedInvitationHash: null, acceptedHash: null, profile: { agency_workspace_id: agencyId }, clientWorkspaceReads: [], requested: [], transitionCalls: 0,
    };
    const repo = {
        async getRole(workspaceId, userId) {
            if (workspaceId === agencyId && userId === ownerId)
                return "owner";
            if (workspaceId === agencyId && userId === editorId)
                return "editor";
            if (workspaceId === clientId && userId === ownerId)
                return "owner";
            return null;
        },
        async agencyProfile(workspaceId) { return workspaceId === agencyId ? state.profile : null; },
        async saveAgencyProfile(workspaceId, input) { state.profile = { agency_workspace_id: workspaceId, ...input }; return state.profile; },
        async relationships(workspaceId, side) { return side === "agency" && workspaceId === agencyId ? [relation] : []; },
        async requestRelationship(_workspaceId, otherWorkspaceId, side) { state.requested.push({ side, other: otherWorkspaceId }); return { ...relation, client_workspace_id: otherWorkspaceId }; },
        async transitionRelationship(id, action) { state.transitionCalls += 1; return { ...relation, id, status: action === "accept" ? "active" : "ended", decision: action }; },
        async memberWorkspaceIds() { return []; },
        async clientWorkspaces(ids) { state.clientWorkspaceReads.push(ids); return ids.map((id) => ({ id, name: "Private client identity", industry_key: "fitness" })); },
        async agencyOverview() { return { authorized_client_count: 0, campaign_count: 0, pending_campaign_reviews: 0, open_tasks: 0 }; },
        async clientOverview() { return { campaign_count: 1, pending_campaign_reviews: 1, creative_review_count: 0, open_task_count: 1 }; },
        async teamMembers() { return [{ id: relationId, user_id: ownerId, role: "owner" }]; },
        async assignments() { return []; },
        async createAssignment() { return { id: relationId, agency_workspace_id: agencyId }; },
        async revokeAssignment(id) { return { id, agency_workspace_id: agencyId }; },
        async removeTeamMember() { return { status: "revoked" }; },
        async invitations() { return []; },
        async createInvitation(input) { state.storedInvitationHash = input.tokenHash; return { id: relationId, workspace_id: input.workspaceId, status: "pending", expires_at: input.expiresAt }; },
        async revokeInvitation(id) { return { id, workspace_id: agencyId, status: "revoked" }; },
        async acceptInvitation(tokenHash) { state.acceptedHash = tokenHash; return { status: "accepted", workspace_id: agencyId, membership_existed: false }; },
        async tasks() { return [{ id: relationId, title: "Visible", visibility: "client_visible" }, { id: clientId, title: "Internal", visibility: "agency_internal" }]; },
        async createTask(_workspaceId, input) { return { ...input, id: relationId }; },
        async updateTask(_workspaceId, id) { return { id, status: "done" }; },
        async comments() { return [{ id: relationId, body: "Visible comment", visibility: "client_visible" }, { id: clientId, body: "Private agency note", visibility: "agency_internal" }]; },
        async createComment(_workspaceId, input) { return { ...input, id: relationId }; },
        async resolveComment(_workspaceId, id, resolve) { return { id, resolve }; },
        async activity() { return { rows: [], total: 0 }; },
    };
    return { repo, state };
}
async function withApi(repo, run) {
    const app = express();
    app.use(express.json());
    app.use(createAgencyRouter({ ...config, corsAllowedOrigins: ["http://localhost:5180"] }, verifier, { repositoryFactory: () => repo }));
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
test("agency routes deny unauthenticated, nonmember, and editor management requests", async () => {
    const { repo } = fixture();
    await withApi(repo, async (base) => {
        assert.equal((await fetch(`${base}/api/workspaces/${agencyId}/agency/overview`)).status, 401);
        const ordinaryWorkspace = await fetch(`${base}/api/workspaces/${clientId}/agency/overview`, { headers: { authorization: "Bearer owner" } });
        assert.equal(ordinaryWorkspace.status, 200);
        assert.equal((await ordinaryWorkspace.json()).designated, false);
        assert.equal((await fetch(`${base}/api/workspaces/${agencyId}/agency/profile`, { method: "PUT", headers: { authorization: "Bearer editor", "content-type": "application/json" }, body: JSON.stringify({ description: "", websiteUrl: null, specializations: [] }) })).status, 403);
    });
});
test("agency designation persists through the owner-scoped profile RPC", async () => {
    const { repo, state } = fixture();
    state.profile = null;
    await withApi(repo, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${agencyId}/agency/profile`, { method: "PUT", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ description: "Independent agency", websiteUrl: "https://agency.example", specializations: ["fitness", "e-commerce"] }) });
        assert.equal(response.status, 200);
        assert.equal(state.profile?.description, "Independent agency");
    });
});
test("client workspace identity remains hidden until the current user has client membership", async () => {
    const { repo, state } = fixture();
    await withApi(repo, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${agencyId}/agency/overview`, { headers: { authorization: "Bearer owner" } });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.clients[0]?.access, "membership_required");
        assert.equal(body.clients[0]?.client, null);
        assert.deepEqual(state.clientWorkspaceReads, [[]]);
    });
});
test("agency relationship creation records a request but grants no client membership", async () => {
    const { repo, state } = fixture();
    await withApi(repo, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${agencyId}/agency/relationships`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ otherWorkspaceId: clientId }) });
        assert.equal(response.status, 201);
        assert.deepEqual(state.requested, [{ side: "agency", other: clientId }]);
        const result = await response.json();
        assert.match(result.note, /client owner must accept/i);
    });
});
test("client portal shows its own pending collaboration request", async () => {
    const { repo } = fixture();
    repo.relationships = async (_workspaceId, side) => side === "client" ? [{ ...relation, request_direction: "client_to_agency", status: "pending" }] : [];
    await withApi(repo, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${clientId}/client/relationships`, { headers: { authorization: "Bearer owner" } });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.deepEqual(result.relationships.map((item) => [item.request_direction, item.status]), [["client_to_agency", "pending"]]);
    });
});
test("relationship ID from another workspace is rejected before the transition RPC", async () => {
    const { repo, state } = fixture();
    await withApi(repo, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${clientId}/agency/relationships/${relationId}/decision`, {
            method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ action: "end" }),
        });
        assert.equal(response.status, 404);
        assert.equal(state.transitionCalls, 0);
    });
});
test("client portal excludes agency-internal tasks and comments", async () => {
    const { repo } = fixture();
    await withApi(repo, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${clientId}/client/overview`, { headers: { authorization: "Bearer owner" } });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.deepEqual(result.tasks.map((item) => item.title), ["Visible"]);
        assert.deepEqual(result.comments.map((item) => item.body), ["Visible comment"]);
    });
});
test("invitation links are explicitly not emailed and only token hashes reach storage", async () => {
    const { repo, state } = fixture();
    await withApi(repo, async (base) => {
        const response = await fetch(`${base}/api/workspaces/${agencyId}/agency/invitations`, { method: "POST", headers: { authorization: "Bearer owner", origin: "http://localhost:5180", "content-type": "application/json" }, body: JSON.stringify({ email: "New.Member@example.invalid", role: "editor" }) });
        assert.equal(response.status, 201);
        const result = await response.json();
        assert.equal(result.delivery, "not_emailed");
        assert.match(result.copyInstruction, /not emailed/i);
        const token = new URL(result.invitationLink).hash.slice(1).replace(/^token=/, "");
        assert.equal(token.length, 43);
        assert.equal(state.storedInvitationHash, createHash("sha256").update(token).digest("hex"));
        assert.ok(!JSON.stringify(result).includes(state.storedInvitationHash ?? "__missing__"));
    });
});
test("invitation acceptance hashes the supplied one-time token before repository access", async () => {
    const { repo, state } = fixture();
    await withApi(repo, async (base) => {
        const token = "x".repeat(43);
        const response = await fetch(`${base}/api/invitations/accept`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ token }) });
        assert.equal(response.status, 200);
        assert.equal(state.acceptedHash, createHash("sha256").update(token).digest("hex"));
        assert.notEqual(state.acceptedHash, token);
    });
});
