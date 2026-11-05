import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import test from "node:test";
import { CampaignBriefSchema, CampaignRecordSchema, ReportDefinitionInputSchema } from "@ai-ads/shared";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createAnalyticsRouter } from "./routes.js";
const workspaceA = "82000000-0000-4000-8000-000000000001";
const workspaceB = "82000000-0000-4000-8000-000000000002";
const ownerId = "81000000-0000-4000-8000-000000000001";
const viewerId = "81000000-0000-4000-8000-000000000002";
const users = { owner: { id: ownerId, email: "owner@example.invalid", emailConfirmedAt: "2026-10-28T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z" }, viewer: { id: viewerId, email: "viewer@example.invalid", emailConfirmedAt: "2026-10-28T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z" } };
const verifier = async (token) => users[token] ? { status: "verified", user: users[token] } : { status: "invalid" };
const brief = CampaignBriefSchema.parse({ businessName: "Northstar Studio", industry: "professional_services", industryLabel: null, productService: "Consulting", businessDescription: "", offer: "", landingPageUrl: "https://northstar.example", uniqueSellingPoints: [], brandVoice: "clear", preferredCta: "Learn more", country: "India", regions: [], language: "English", intendedCustomer: "Growing teams", audienceDescription: "", keywords: [], interestThemes: [], exclusions: [], budgetType: "daily", budgetAmount: 50, currency: "USD", startDate: "2026-10-01", endDate: null, budgetRationale: "", biddingPreference: "manual_review", tone: "clear", mainMessage: "", promotionalHook: "", brandAttributes: [], copyStyle: "benefit_led" });
const campaign = CampaignRecordSchema.parse({ id: "83000000-0000-4000-8000-000000000001", workspaceId: workspaceA, name: "Stored demo campaign", platform: "google_ads", objective: "website_traffic", status: "demo_published", revision: 1, approvedRevision: 1, generatedAt: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-28T00:00:00.000Z", executionMode: "demo", publishedExternally: false, brief, plan: null });
const reportInput = ReportDefinitionInputSchema.parse({ name: "Performance report", description: "Stored simulation", reportType: "executive_overview", filters: { preset: "last_30_days", platform: "all", comparePrevious: false }, metrics: ["spend", "clicks", "ctr"], dimensions: ["campaign", "currency"], sections: [{ id: "84000000-0000-4000-8000-000000000001", type: "heading", title: "Summary" }], dateRangePolicy: { kind: "rolling", preset: "last_30_days", schedulePreference: null } });
function fixture() {
    const state = { reports: [], exports: [] };
    const repo = {
        async getRole(workspaceId, userId) { if (workspaceId === workspaceA && userId === ownerId)
            return "owner"; if (workspaceId === workspaceA && userId === viewerId)
            return "viewer"; return null; },
        async workspace(id) { return id === workspaceA ? { id, name: "Northstar Workspace" } : null; },
        async campaigns(id) { return id === workspaceA ? { rows: [campaign], truncated: false } : { rows: [], truncated: false }; },
        async analytics(id) { return { rows: id === workspaceA ? [{ id: "85000000-0000-4000-8000-000000000001", workspace_id: workspaceA, campaign_id: campaign.id, data_source: "demo_simulation", scenario: "average", seed: 42, simulated_at: "2026-10-28T00:00:00.000Z", metrics: { label: "Simulated Data — Not Actual Ad Performance", days: [{ date: "2026-10-27", impressions: 1000, clicks: 50, spend: 20, conversions: 5 }, { date: "2026-10-28", impressions: 1000, clicks: 40, spend: 15, conversions: 3 }] } }] : [], truncated: false }; },
        async creatives() { return { rows: [], links: [] }; }, async savedViews() { return []; }, async saveView() { throw new Error("not used"); },
        async reports(id) { return state.reports.filter((row) => row.workspace_id === id && row.status === "active"); },
        async report(id, reportId) { return state.reports.find((row) => row.workspace_id === id && row.id === reportId && row.status === "active") ?? null; },
        async createReport(id, definition) { const now = "2026-10-28T00:00:00.000Z"; const row = { id: "86000000-0000-4000-8000-000000000001", workspace_id: id, name: definition.name, description: "Stored simulation", report_type: "executive_overview", definition, version: 1, status: "active", created_by_user_id: ownerId, updated_by_user_id: ownerId, created_at: now, updated_at: now }; state.reports.push(row); return row; },
        async saveReport() { throw new Error("not used"); }, async duplicateReport() { throw new Error("not used"); }, async archiveReport() { throw new Error("not used"); },
        async reportHistory() { return []; }, async exportHistory() { return state.exports; },
        async recordExport(_workspaceId, reportId, _version, format, rowCount, bytes, sha256) { const row = { id: `87000000-0000-4000-8000-${String(state.exports.length + 1).padStart(12, "0")}`, report_id: reportId, export_format: format, row_count: rowCount, file_bytes: bytes, sha256, data_source: "DEMO_SIMULATION" }; state.exports.push(row); return row; },
    };
    return { repo, state };
}
async function withApi(repo, run) { const app = express(); app.use(express.json()); app.use(createAnalyticsRouter(config, verifier, { repositoryFactory: () => repo })); const errors = (error, _request, response, _next) => { if (error instanceof HttpError)
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
else
    response.status(500).json({ error: { code: "internal_error" } }); }; app.use(errors); const server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert.ok(address && typeof address !== "string"); try {
    await run(`http://127.0.0.1:${address.port}`);
}
finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
} }
test("analytics routes require authentication and current workspace membership", async () => { const { repo } = fixture(); await withApi(repo, async (base) => { const unauth = await fetch(`${base}/api/workspaces/${workspaceA}/analytics/overview`); assert.equal(unauth.status, 401); const cross = await fetch(`${base}/api/workspaces/${workspaceB}/analytics/overview`, { headers: { authorization: "Bearer owner" } }); assert.equal(cross.status, 404); }); });
test("overview aggregates stored demo facts with explicit provenance", async () => { const { repo } = fixture(); await withApi(repo, async (base) => { const response = await fetch(`${base}/api/workspaces/${workspaceA}/analytics/overview?preset=last_30_days&platform=all`, { headers: { authorization: "Bearer owner" } }); assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.source, "DEMO_SIMULATION"); assert.equal(result.label, "Simulated Data — Not Actual Ad Performance"); const summary = result.summary; assert.equal(summary.impressions, 2000); assert.equal(summary.clicks, 90); assert.equal(summary.ctr, 4.5); assert.equal(result.campaigns.length, 1); }); });
test("viewer cannot export, while owner receives a valid report PDF and saved export audit", async () => { const { repo, state } = fixture(); await withApi(repo, async (base) => { const viewer = await fetch(`${base}/api/workspaces/${workspaceA}/analytics/export.csv`, { headers: { authorization: "Bearer viewer" } }); assert.equal(viewer.status, 403); const create = await fetch(`${base}/api/workspaces/${workspaceA}/reports`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify(reportInput) }); assert.equal(create.status, 201); const created = await create.json(); const response = await fetch(`${base}/api/workspaces/${workspaceA}/reports/${created.report.id}/export`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ format: "pdf" }) }); assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/pdf"); const pdf = Buffer.from(await response.arrayBuffer()); assert.ok(pdf.toString("ascii").startsWith("%PDF-1.4")); assert.ok(pdf.toString("ascii").includes("Performance report")); assert.ok(pdf.toString("ascii").includes("SIMULATED DATA - NOT ACTUAL AD PERFORMANCE")); assert.equal(state.exports.length, 1); assert.equal(state.exports[0]?.data_source, "DEMO_SIMULATION"); }); });
test("campaign CSV honors workspace filtering and includes only stored rows", async () => { const { repo } = fixture(); await withApi(repo, async (base) => { const response = await fetch(`${base}/api/workspaces/${workspaceA}/analytics/export.csv?preset=last_30_days`, { headers: { authorization: "Bearer owner" } }); assert.equal(response.status, 200); const csv = await response.text(); assert.ok(csv.includes("Stored demo campaign")); assert.ok(csv.includes("DEMO_SIMULATION") === false, "campaign table export contains only table columns; provenance is returned in response headers"); assert.equal(response.headers.get("x-analytics-source"), "DEMO_SIMULATION"); }); });
