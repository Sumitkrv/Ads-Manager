import assert from "node:assert/strict";
import { once } from "node:events";
import express, { type ErrorRequestHandler } from "express";
import sharp from "sharp";
import test from "node:test";
import { CreativeAssetListQuerySchema } from "@ai-ads/shared";
import { type AuthenticatedApiUser, type TokenVerifier } from "../auth.js";
import { config, type ApiConfig } from "../config.js";
import { HttpError } from "../errors.js";
import { createCreativesRouter } from "./routes.js";
import type { CreativeRepository } from "./repository.js";
import type { CreativeAssetUploadService } from "./asset-upload-service.js";

const workspaceId = "62000000-0000-4000-8000-000000000001";
const workspaceB = "62000000-0000-4000-8000-000000000002";
const ownerId = "61000000-0000-4000-8000-000000000001";
const viewerId = "61000000-0000-4000-8000-000000000004";
const timestamp = "2026-10-28T00:00:00.000Z";
const users: Record<string, AuthenticatedApiUser> = {
  "owner-token": { id: ownerId, email: "owner@example.invalid", emailConfirmedAt: timestamp, createdAt: timestamp },
  "viewer-token": { id: viewerId, email: "viewer@example.invalid", emailConfirmedAt: timestamp, createdAt: timestamp },
};
const verifier: TokenVerifier = async (token) => users[token] ? { status: "verified", user: users[token]! } : { status: "invalid" };

test("asset list query parses archived flags as explicit booleans", () => {
  assert.equal(CreativeAssetListQuerySchema.parse({ archived: "false" }).archived, false);
  assert.equal(CreativeAssetListQuerySchema.parse({ archived: "true" }).archived, true);
  assert.equal(CreativeAssetListQuerySchema.parse({}).archived, false);
});

function fixtureRepository() {
  const calls = { role: 0, assets: 0 };
  const repository = {
    async getRole(workspace: string, userId: string) {
      calls.role += 1;
      if (workspace !== workspaceId && workspace !== workspaceB) return null;
      if (workspace === workspaceB) return null;
      if (userId === ownerId) return "owner";
      if (userId === viewerId) return "viewer";
      return null;
    },
    async getWorkspace() { return { name: "Studio North", industry_key: "professional_services" }; },
    async getBrandKit() { return null; },
    async saveBrandKit() { throw new Error("Not used by this fixture."); },
    async listAssets() { calls.assets += 1; return { assets: [], total: 0 }; },
  } as unknown as CreativeRepository;
  return { repository, calls };
}

async function withApi<T>(repository: CreativeRepository, apiConfig: ApiConfig, run: (base: string) => Promise<T>, uploadServiceFactory?: (apiConfig: ApiConfig) => CreativeAssetUploadService | null): Promise<T> {
  const app = express();
  app.use("/api/workspaces/:workspaceId/assets", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "5mb" }));
  app.use(express.json());
  app.use(createCreativesRouter(apiConfig, verifier, { repositoryFactory: () => repository, ...(uploadServiceFactory ? { uploadServiceFactory } : {}) }));
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

test("creative APIs require authentication before tenant storage access", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, config, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceId}/assets`);
    assert.equal(response.status, 401);
    assert.equal(fixture.calls.role, 0);
  });
});

test("viewers can read safe workspace records but cannot mutate the Brand Kit", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, config, async (base) => {
    const read = await fetch(`${base}/api/workspaces/${workspaceId}/brand-kit`, { headers: { authorization: "Bearer viewer-token" } });
    assert.equal(read.status, 200);
    const result = await read.json() as { brandKit: { displayName: string; industry: string } };
    assert.equal(result.brandKit.displayName, "Studio North");
    assert.equal(result.brandKit.industry, "professional_services");
    const write = await fetch(`${base}/api/workspaces/${workspaceId}/brand-kit`, { method: "PUT", headers: { authorization: "Bearer viewer-token", "content-type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(write.status, 403);
  });
});

test("nonmembers cannot inspect another tenant's creative assets", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, config, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceB}/assets`, { headers: { authorization: "Bearer owner-token" } });
    assert.equal(response.status, 404);
    assert.equal(fixture.calls.assets, 0);
  });
});

test("creative variation endpoint returns only explicitly labeled offline designs", async () => {
  const fixture = fixtureRepository();
  await withApi(fixture.repository, config, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceId}/creatives/variations`, {
      method: "POST", headers: { authorization: "Bearer owner-token", "content-type": "application/json" },
      body: JSON.stringify({ industry: "restaurants_cafes", businessName: "Juniper Table", productService: "Seasonal menu", objective: "local_visits", seed: 29 }),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as { mode: string; label: string; variations: Array<{ document: { elements: unknown[] } }> };
    assert.equal(result.mode, "offline");
    assert.equal(result.label, "Offline Creative Variations");
    assert.equal(result.variations.length, 8);
    assert.ok(result.variations.every((variation) => variation.document.elements.length > 0));
  });
});

test("creative API refuses to run when server configuration is not local mode", async () => {
  const fixture = fixtureRepository();
  const blocked = { ...config, CREATIVE_EXECUTION_MODE: "disabled" } as unknown as ApiConfig;
  await withApi(fixture.repository, blocked, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceId}/brand-kit`, { headers: { authorization: "Bearer owner-token" } });
    assert.equal(response.status, 503);
    assert.equal(fixture.calls.role, 0);
  });
});

test("validated asset upload crosses the server-only upload service after image decoding", async () => {
  const fixture = fixtureRepository();
  const seen: Array<{ workspaceId: string; userId: string; type: string; mimeType: string; width: number; height: number; bytes: number }> = [];
  const uploadService: CreativeAssetUploadService = {
    async upload(input) {
      seen.push({ workspaceId: input.workspaceId, userId: input.userId, type: input.type, mimeType: input.mimeType, width: input.width, height: input.height, bytes: input.buffer.byteLength });
      return { id: input.assetId, workspaceId: input.workspaceId, type: input.type, originalFilename: input.filename, mimeType: input.mimeType as "image/png", sizeBytes: input.buffer.byteLength, width: input.width, height: input.height, uploaderId: input.userId, tags: [], archivedAt: null, createdAt: timestamp, signedUrl: null };
    },
    async removeObject() {},
  };
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 40, g: 90, b: 210, alpha: 1 } } }).png().toBuffer();
  await withApi(fixture.repository, config, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceId}/assets`, {
      method: "POST",
      headers: { authorization: "Bearer owner-token", "content-type": "image/png", "x-asset-type": "image", "x-asset-filename": "brief.png" },
      body: png,
    });
    assert.equal(response.status, 201);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.workspaceId, workspaceId);
    assert.equal(seen[0]?.userId, ownerId);
    assert.equal(seen[0]?.mimeType, "image/png");
    assert.equal(seen[0]?.width, 2);
    assert.equal(seen[0]?.height, 2);
    assert.ok((seen[0]?.bytes ?? 0) > 0);
  }, () => uploadService);
});

test("invalid image content is rejected before the privileged Storage uploader is reached", async () => {
  const fixture = fixtureRepository();
  let uploads = 0;
  const uploadService: CreativeAssetUploadService = { async upload() { uploads += 1; throw new Error("must not run"); }, async removeObject() {} };
  await withApi(fixture.repository, config, async (base) => {
    const response = await fetch(`${base}/api/workspaces/${workspaceId}/assets`, {
      method: "POST",
      headers: { authorization: "Bearer owner-token", "content-type": "image/png", "x-asset-type": "image", "x-asset-filename": "fake.png" },
      body: Buffer.from("not an image"),
    });
    assert.equal(response.status, 400);
    assert.equal(uploads, 0);
  }, () => uploadService);
});
