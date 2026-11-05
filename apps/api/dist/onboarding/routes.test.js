import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import test from "node:test";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createOnboardingRouter } from "./routes.js";
const workspaceId = "62000000-0000-4000-8000-000000000001";
const testUser = {
    id: "72000000-0000-4000-8000-000000000001",
    email: "onboarding@example.invalid",
    emailConfirmedAt: "2026-10-29T00:00:00.000Z",
    createdAt: "2026-10-29T00:00:00.000Z",
};
const verifier = async (token) => token === "onboarding-token"
    ? { status: "verified", user: testUser }
    : { status: "invalid" };
async function withApi(run) {
    const app = express();
    app.use(express.json());
    app.use(createOnboardingRouter(config, verifier));
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
test("onboarding endpoints reject unauthenticated requests before storage access", async () => {
    await withApi(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/me/onboarding`);
        const payload = await response.json();
        assert.equal(response.status, 401);
        assert.equal(payload.error?.code, "authentication_required");
    });
});
test("tour reads validate workspace ids before opening Supabase storage", async () => {
    await withApi(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/me/product-tours?workspaceId=not-a-uuid`, {
            headers: { authorization: "Bearer onboarding-token" },
        });
        const payload = await response.json();
        assert.equal(response.status, 400);
        assert.equal(payload.error?.code, "invalid_workspace_id");
    });
});
test("activation event endpoint accepts only user acknowledgements, not fabricated milestones", async () => {
    await withApi(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workspaces/${workspaceId}/activation/events`, {
            method: "POST",
            headers: { authorization: "Bearer onboarding-token", "content-type": "application/json" },
            body: JSON.stringify({ eventKey: "first_campaign_created" }),
        });
        const payload = await response.json();
        assert.equal(response.status, 400);
        assert.equal(payload.error?.code, "activation_event_invalid");
    });
});
test("tour progress rejects a path/body mismatch before touching workspace data", async () => {
    await withApi(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/me/product-tours/analytics/progress`, {
            method: "POST",
            headers: { authorization: "Bearer onboarding-token", "content-type": "application/json" },
            body: JSON.stringify({ tourId: "owner-overview", workspaceId, stepIndex: 0, status: "running" }),
        });
        const payload = await response.json();
        assert.equal(response.status, 404);
        assert.equal(payload.error?.code, "tour_not_found");
    });
});
