import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { ApiError } from "../errors";
import {
  createAdAsset,
  deleteAdAsset,
  getAdAsset,
  isFirestoreKnownUnreachable,
  listAdAssetsForKey,
  markFirestoreUnreachable,
  type AdAssetRecord,
} from "../../storage/firestore";
import { appendLocalAdAsset, getLocalAdAsset, listLocalAdAssetsForKey, removeLocalAdAsset } from "../../storage/localAdAssets";
import { deleteObjectFromR2, uploadBufferToR2 } from "../../storage/r2";

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // a real phone photo is typically 2-8MB; 15MB is generous headroom, not a tuned number

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/**
 * The Ads product's photo-upload surface: a business uploads its own
 * product photos here, they land in R2 under that business's own api key
 * (the existing account boundary — see AdAssetRecord's own comment), and
 * the returned assetId is what AdRequestSchema.productImages references
 * instead of (or alongside) a raw url. No login/profile system exists yet
 * — this is deliberately keyed to the same apiKeyId every job already
 * uses, so it slots under a real login layer later without changing shape.
 */
export function assetsRouter(): Router {
  const router = Router();

  router.post("/assets/upload", upload.single("photo"), async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) throw new ApiError(400, 'Missing "photo" file in multipart form data.');
      if (!ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
        throw new ApiError(400, `Unsupported content type "${file.mimetype}" — use JPEG, PNG, or WebP.`);
      }

      const apiKeyId = req.apiKeyId!;
      const id = crypto.randomUUID();
      const ext = extensionFor(file.mimetype);
      const r2Key = `users/${apiKeyId}/uploads/${id}.${ext}`;

      const { url } = await uploadBufferToR2({ buffer: file.buffer, key: r2Key, contentType: file.mimetype });

      const label = typeof req.body?.label === "string" ? req.body.label : undefined;
      const record: AdAssetRecord = { id, apiKeyId, r2Key, url, label, contentType: file.mimetype, createdAt: Date.now() };

      if (isFirestoreKnownUnreachable()) {
        appendLocalAdAsset(record);
      } else {
        try {
          await createAdAsset(record);
        } catch {
          markFirestoreUnreachable();
          appendLocalAdAsset(record);
        }
      }

      res.status(201).json({ id, url, label });
    } catch (err) {
      next(err);
    }
  });

  router.get("/assets", async (req, res, next) => {
    try {
      const apiKeyId = req.apiKeyId!;
      const assets = isFirestoreKnownUnreachable() ? listLocalAdAssetsForKey(apiKeyId) : await listAdAssetsForKey(apiKeyId);
      res.json({ items: assets.map((a) => ({ id: a.id, url: a.url, label: a.label, createdAt: a.createdAt })) });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/assets/:id", async (req, res, next) => {
    try {
      const apiKeyId = req.apiKeyId!;
      const asset = isFirestoreKnownUnreachable() ? getLocalAdAsset(req.params.id) : await getAdAsset(req.params.id);
      if (!asset) throw new ApiError(404, "Asset not found.");
      if (asset.apiKeyId !== apiKeyId) throw new ApiError(403, "Not permitted.");

      await deleteObjectFromR2({ key: asset.r2Key });
      if (isFirestoreKnownUnreachable()) {
        removeLocalAdAsset(asset.id);
      } else {
        await deleteAdAsset(asset.id);
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
