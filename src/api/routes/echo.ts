import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { ApiError } from "../errors";
import {
  createEchoModel,
  getApiKeyById,
  getEchoModel,
  getOrCreateAccount,
  listEchoModelsForOwner,
  updateEchoModel,
} from "../../storage/firestore";
import { uploadBufferToR2 } from "../../storage/r2";
import { assertEchoAccess } from "../../billing/gate";
import { ECHO_RETRAIN_CREDITS, ECHO_TRAIN_CREDITS } from "../../billing/tiers";
import { InsufficientCreditsError } from "../../billing/types";
import type { EchoModelRecord } from "../../images/styleModel/echoTypes";
import type { JobQueue } from "../../queue/types";

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // same generous headroom as assets.ts's photo upload
const MIN_REFERENCE_IMAGES = 5;
const MAX_REFERENCE_IMAGES = 10;

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

function serializeEchoModel(m: EchoModelRecord) {
  return {
    id: m.id,
    status: m.status,
    referenceImageCount: m.referenceImageUrls.length,
    triggerWord: m.styleModel?.triggerWord,
    retrainCount: m.retrainCount,
    errorMessage: m.errorMessage,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

async function uploadReferenceImages(
  apiKeyId: string,
  echoModelId: string,
  files: Express.Multer.File[],
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (!ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
      throw new ApiError(400, `Unsupported content type "${file.mimetype}" — use JPEG, PNG, or WebP.`);
    }
    const ext = extensionFor(file.mimetype);
    const r2Key = `users/${apiKeyId}/echo-references/${echoModelId}/${crypto.randomUUID()}.${ext}`;
    const { url } = await uploadBufferToR2({ buffer: file.buffer, key: r2Key, contentType: file.mimetype });
    urls.push(url);
  }
  return urls;
}

/**
 * Pyramidion-exclusive: upload 5-10 reference images of a customer's own
 * character/art style, kick off the async training pipeline (candidate
 * generation -> selection -> LoRA training — see echoPipeline.ts), and
 * check on / retrain the result. The 22-credit / 11-credit charge from the
 * pricing plan is debited AFTER a successful (re)training run (see
 * echoTrainHandler.ts) — this route only gates tier access, reference-count
 * shape, ownership, and a fast pre-check that the account can plausibly
 * afford the run at all before any real money gets spent on it.
 */
export function echoRouter(queue: JobQueue): Router {
  const router = Router();

  router.post("/echo/models", upload.array("references", MAX_REFERENCE_IMAGES), async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const account = await getOrCreateAccount(self.ownerLabel);
      assertEchoAccess(account.tier);
      if (account.creditBalance < ECHO_TRAIN_CREDITS) {
        throw new InsufficientCreditsError(account.ownerLabel, ECHO_TRAIN_CREDITS, account.creditBalance);
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length < MIN_REFERENCE_IMAGES || files.length > MAX_REFERENCE_IMAGES) {
        throw new ApiError(
          400,
          `Upload between ${MIN_REFERENCE_IMAGES} and ${MAX_REFERENCE_IMAGES} reference images (got ${files.length}).`,
        );
      }

      const id = crypto.randomUUID();
      const referenceImageUrls = await uploadReferenceImages(self.id, id, files);

      const now = Date.now();
      const record: EchoModelRecord = {
        id,
        ownerLabel: self.ownerLabel,
        status: "pending",
        referenceImageUrls,
        retrainCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await createEchoModel(record);
      await queue.enqueueEchoTrainingJob({ echoModelId: id });

      res.status(202).json(serializeEchoModel(record));
    } catch (err) {
      next(err);
    }
  });

  router.get("/echo/models", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const models = await listEchoModelsForOwner(self.ownerLabel);
      res.json({ items: models.map(serializeEchoModel) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/echo/models/:id", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const model = await getEchoModel(req.params.id);
      if (!model) throw new ApiError(404, "Echo model not found.");
      if (model.ownerLabel !== self.ownerLabel) throw new ApiError(403, "Not permitted.");
      res.json(serializeEchoModel(model));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/echo/models/:id/retrain",
    upload.array("references", MAX_REFERENCE_IMAGES),
    async (req, res, next) => {
      try {
        const self = await getApiKeyById(req.apiKeyId!);
        if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
        const account = await getOrCreateAccount(self.ownerLabel);
        assertEchoAccess(account.tier);
        if (account.creditBalance < ECHO_RETRAIN_CREDITS) {
          throw new InsufficientCreditsError(account.ownerLabel, ECHO_RETRAIN_CREDITS, account.creditBalance);
        }

        const modelId = req.params.id;
        if (!modelId) throw new ApiError(400, "Missing echo model id.");
        const model = await getEchoModel(modelId);
        if (!model) throw new ApiError(404, "Echo model not found.");
        if (model.ownerLabel !== self.ownerLabel) throw new ApiError(403, "Not permitted.");
        if (model.status !== "ready" && model.status !== "failed") {
          throw new ApiError(409, `Echo model is currently "${model.status}" — wait for it to finish before retraining.`);
        }

        // New reference images are optional on retrain — reuse the existing
        // set unless the customer uploads a fresh one, since "I don't like
        // this model, try again" doesn't necessarily mean new photos.
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const referenceImageUrls =
          files.length > 0 ? await uploadReferenceImages(self.id, model.id, files) : model.referenceImageUrls;
        if (files.length > 0 && (files.length < MIN_REFERENCE_IMAGES || files.length > MAX_REFERENCE_IMAGES)) {
          throw new ApiError(
            400,
            `Upload between ${MIN_REFERENCE_IMAGES} and ${MAX_REFERENCE_IMAGES} reference images (got ${files.length}).`,
          );
        }

        // Retraining deletes everything prior in this model, per the
        // pricing plan — this is not a version history, the old
        // styleModel/candidates are simply overwritten by the pipeline's
        // result once it completes.
        await updateEchoModel(model.id, {
          status: "pending",
          referenceImageUrls,
          candidateImageUrls: undefined,
          selectedImageUrls: undefined,
          styleModel: undefined,
          errorMessage: undefined,
          retrainCount: model.retrainCount + 1,
        });
        await queue.enqueueEchoTrainingJob({ echoModelId: model.id });

        const updated = await getEchoModel(model.id);
        res.status(202).json(serializeEchoModel(updated!));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
