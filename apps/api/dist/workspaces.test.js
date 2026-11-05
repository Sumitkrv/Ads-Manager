import assert from "node:assert/strict";
import test from "node:test";
import { CreateWorkspaceInputSchema, WorkspaceBusinessInputSchema, WorkspaceSettingsInputSchema, hasWorkspacePermission, } from "@ai-ads/shared";
const baseInput = {
    requestId: "41000000-0000-4000-8000-000000000001",
    name: "Northstar Studio",
    slug: "Northstar-Studio",
    industryKey: "professional_services",
    industryCustomLabel: null,
    websiteUrl: "",
    countryCode: "us",
    timezone: "America/New_York",
};
test("workspace creation validation normalizes safe fields and keeps industry data", () => {
    const result = CreateWorkspaceInputSchema.safeParse(baseInput);
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.slug, "northstar-studio");
        assert.equal(result.data.websiteUrl, null);
        assert.equal(result.data.countryCode, "US");
        assert.equal(result.data.industryKey, "professional_services");
    }
});
test("unsupported industry, malformed slug, and missing custom label are rejected", () => {
    assert.equal(WorkspaceBusinessInputSchema.safeParse({
        name: "Northstar", slug: "northstar", industryKey: "unknown",
        industryCustomLabel: null, websiteUrl: null, countryCode: null, timezone: "UTC",
    }).success, false);
    assert.equal(WorkspaceBusinessInputSchema.safeParse({
        name: "Northstar", slug: "../private", industryKey: "professional_services",
        industryCustomLabel: null, websiteUrl: null, countryCode: null, timezone: "UTC",
    }).success, false);
    assert.equal(WorkspaceBusinessInputSchema.safeParse({
        name: "Northstar", slug: "northstar", industryKey: "other",
        industryCustomLabel: null, websiteUrl: null, countryCode: null, timezone: "UTC",
    }).success, false);
});
test("workspace settings reject arbitrary role and ownership fields", () => {
    const result = WorkspaceSettingsInputSchema.safeParse({ role: "owner", createdBy: "user-controlled" });
    assert.equal(result.success, false);
    const createResult = CreateWorkspaceInputSchema.safeParse({
        ...baseInput,
        ownerUserId: "user-controlled",
        role: "admin",
    });
    assert.equal(createResult.success, false);
});
test("role permissions are centralized for workspace actions", () => {
    const roles = ["owner", "admin", "editor", "viewer"];
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "workspace.read")), [true, true, true, true]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "workspace.updateSettings")), [true, true, false, false]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "workspace.viewMembers")), [true, true, false, false]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "workspace.editOperationalData")), [true, true, true, false]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "integrations.read")), [true, true, true, true]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "integrations.manage")), [true, true, false, false]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "analytics.read")), [true, true, true, true]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "reports.manage")), [true, true, true, false]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "reports.archive")), [true, true, false, false]);
    assert.deepEqual(roles.map((role) => hasWorkspacePermission(role, "reports.export")), [true, true, true, false]);
});
