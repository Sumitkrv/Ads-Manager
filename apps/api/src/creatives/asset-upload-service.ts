import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { CreativeAssetSchema, type CreativeAsset } from "@ai-ads/shared";
import { config, type ApiConfig } from "../config.js";
import { HttpError } from "../errors.js";

const bucketName = "workspace-creative-assets";
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const storagePathPattern = new RegExp(`^${uuid}/${uuid}\\.(png|jpg|webp)$`, "i");

export type ValidatedAssetUpload = {
  workspaceId: string;
  userId: string;
  assetId: string;
  type: "logo" | "image";
  filename: string;
  mimeType: string;
  buffer: Buffer;
  width: number;
  height: number;
};

export interface CreativeAssetUploadService {
  upload(input: ValidatedAssetUpload): Promise<CreativeAsset>;
  removeObject(path: string): Promise<void>;
}

function fail(message = "Private creative storage is temporarily unavailable."): never {
  throw new HttpError(503, "creative_storage_unavailable", message);
}

function resultRow(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return fail("Private creative storage returned an invalid result.");
  return row as Record<string, unknown>;
}

export function createCreativeAssetUploadService(apiConfig: ApiConfig = config): CreativeAssetUploadService | null {
  if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_SERVICE_ROLE_KEY) return null;

  // This client is intentionally confined to the fixed creative bucket and
  // four narrow upload/reservation RPCs. All membership and ordinary metadata
  // reads continue through the requester's user-scoped client and RLS.
  const privileged = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  async function remove(path: string): Promise<void> {
    if (!storagePathPattern.test(path)) throw new HttpError(400, "asset_path_invalid", "The private asset path is invalid.");
    const { error } = await privileged.storage.from(bucketName).remove([path]);
    if (error) fail();
  }

  async function cleanExpired(): Promise<void> {
    const { data, error } = await privileged.rpc("list_expired_creative_asset_uploads");
    if (error) fail();
    if (!Array.isArray(data)) return;
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const item = row as Record<string, unknown>;
      if (typeof item.reservation_id !== "string" || typeof item.storage_path !== "string" || !storagePathPattern.test(item.storage_path)) continue;
      const { error: removeError } = await privileged.storage.from(bucketName).remove([item.storage_path]);
      if (removeError) continue;
      await privileged.rpc("cancel_creative_asset_upload", { p_reservation_id: item.reservation_id });
    }
  }

  return {
    async upload(input) {
      await cleanExpired();
      const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/webp" ? "webp" : null;
      if (!extension || input.buffer.byteLength < 1 || input.buffer.byteLength > 5 * 1024 * 1024) {
        throw new HttpError(400, "asset_upload_invalid", "The validated image metadata is invalid.");
      }
      const reservationId = randomUUID();
      const { data: reserved, error: reserveError } = await privileged.rpc("reserve_creative_asset_upload", {
        p_workspace_id: input.workspaceId,
        p_user_id: input.userId,
        p_reservation_id: reservationId,
        p_asset_id: input.assetId,
        p_asset_type: input.type,
        p_original_filename: input.filename,
        p_mime_type: input.mimeType,
        p_size_bytes: input.buffer.byteLength,
        p_width: input.width,
        p_height: input.height,
      });
      if (reserveError) {
        if (reserveError.code === "42501") throw new HttpError(403, "creative_forbidden", "Workspace upload permission is required.");
        if (reserveError.code === "54000") throw new HttpError(413, "workspace_asset_quota_exceeded", "This workspace has reached its creative asset storage allowance.");
        if (reserveError.code === "22023") throw new HttpError(400, "asset_upload_invalid", "The validated image metadata is invalid.");
        fail();
      }
      const reservation = resultRow(reserved);
      const path = typeof reservation.storage_path === "string" ? reservation.storage_path : "";
      const expectedPath = input.workspaceId + "/" + input.assetId + "." + extension;
      if (reservation.reservation_id !== reservationId || path !== expectedPath || !storagePathPattern.test(path)) {
        await privileged.rpc("cancel_creative_asset_upload", { p_reservation_id: reservationId });
        fail("The private upload reservation was invalid.");
      }

      let uploaded = false;
      let finalized = false;
      try {
        const { error } = await privileged.storage.from(bucketName).upload(path, input.buffer, {
          contentType: input.mimeType, cacheControl: "3600", upsert: false,
        });
        if (error) fail();
        uploaded = true;
        const { data, error: finalizeError } = await privileged.rpc("finalize_creative_asset_upload", { p_reservation_id: reservationId });
        if (finalizeError) {
          if (finalizeError.code === "42501") throw new HttpError(403, "creative_forbidden", "Workspace upload permission changed before the image could be saved.");
          fail("The image could not be finalized in the private asset library.");
        }
        finalized = true;
        const row = resultRow(data);
        return CreativeAssetSchema.parse({
          id: row.id, workspaceId: row.workspace_id, type: row.asset_type,
          originalFilename: row.original_filename, mimeType: row.mime_type,
          sizeBytes: row.size_bytes, width: row.width, height: row.height,
          uploaderId: row.uploader_user_id, tags: row.tags ?? [], archivedAt: row.archived_at,
          createdAt: row.created_at, signedUrl: null,
        });
      } catch (error) {
        let cleanupSucceeded = !uploaded || finalized;
        if (uploaded && !finalized) {
          try { await remove(path); cleanupSucceeded = true; } catch { cleanupSucceeded = false; }
        }
        if (cleanupSucceeded) await privileged.rpc("cancel_creative_asset_upload", { p_reservation_id: reservationId });
        throw error;
      }
    },
    removeObject: remove,
  };
}
