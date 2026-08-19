import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createEchoModel, getEchoModel, listEchoModelsForOwner, updateEchoModel } from "../src/storage/firestore";
import { resolveSceneDocument } from "../src/pipeline/resolveSceneDocument";
import { cacheProviderDiscriminator } from "../src/images/cache";
import { TrainedStyleImageProvider } from "../src/images/trainedStyle";
import type { EchoModelRecord } from "../src/images/styleModel/echoTypes";

const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "echo-models-registry.json");

function makeRecord(overrides: Partial<EchoModelRecord> = {}): EchoModelRecord {
  const now = Date.now();
  return {
    id: overrides.id ?? "echo-1",
    ownerLabel: overrides.ownerLabel ?? "owner@example.com",
    status: overrides.status ?? "pending",
    referenceImageUrls: overrides.referenceImageUrls ?? ["https://example.com/ref1.png"],
    retrainCount: overrides.retrainCount ?? 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Echo model storage", () => {
  beforeEach(() => {
    if (fs.existsSync(REGISTRY_PATH)) fs.rmSync(REGISTRY_PATH);
  });
  afterEach(() => {
    if (fs.existsSync(REGISTRY_PATH)) fs.rmSync(REGISTRY_PATH);
  });

  it("creates and resolves a record by id", async () => {
    const record = makeRecord();
    await createEchoModel(record);
    const found = await getEchoModel(record.id);
    expect(found?.status).toBe("pending");
    expect(found?.ownerLabel).toBe("owner@example.com");
  });

  it("lists every model sharing an ownerLabel, not other owners' models", async () => {
    await createEchoModel(makeRecord({ id: "a1", ownerLabel: "a@example.com" }));
    await createEchoModel(makeRecord({ id: "a2", ownerLabel: "a@example.com" }));
    await createEchoModel(makeRecord({ id: "b1", ownerLabel: "b@example.com" }));

    const aModels = await listEchoModelsForOwner("a@example.com");
    expect(aModels).toHaveLength(2);
    expect(aModels.every((m) => m.ownerLabel === "a@example.com")).toBe(true);
  });

  it("updateEchoModel patches status and clears prior training fields on retrain", async () => {
    const record = makeRecord({
      status: "ready",
      candidateImageUrls: ["c1"],
      selectedImageUrls: ["s1"],
      styleModel: { version: "v1", loraUrl: "url", triggerWord: "echoabc", plan: "echo", curatedCount: 20, trainingCostUsd: 3.5, trainedAt: "now" },
      retrainCount: 0,
    });
    await createEchoModel(record);

    await updateEchoModel(record.id, {
      status: "pending",
      candidateImageUrls: undefined,
      selectedImageUrls: undefined,
      styleModel: undefined,
      retrainCount: 1,
    });

    const updated = await getEchoModel(record.id);
    expect(updated?.status).toBe("pending");
    expect(updated?.styleModel).toBeUndefined();
    expect(updated?.retrainCount).toBe(1);
  });
});

describe("Echo model image isolation", () => {
  it("two Echo models with different trigger words never share a cache key for the same concept", () => {
    const providerA = new TrainedStyleImageProvider("fake-key", {
      version: "v1",
      loraUrl: "https://example.com/a.safetensors",
      triggerWord: "echoaaaaaaaa",
      plan: "echo",
      curatedCount: 20,
      trainingCostUsd: 3.5,
      trainedAt: "now",
    });
    const providerB = new TrainedStyleImageProvider("fake-key", {
      version: "v1",
      loraUrl: "https://example.com/b.safetensors",
      triggerWord: "echobbbbbbbb",
      plan: "echo",
      curatedCount: 20,
      trainingCostUsd: 3.5,
      trainedAt: "now",
    });

    expect(cacheProviderDiscriminator(providerA)).not.toBe(cacheProviderDiscriminator(providerB));
  });
});

describe("resolveSceneDocument with an echoModelId", () => {
  it("rejects a scenes request that references an echoModelId which doesn't exist", async () => {
    const scenes = {
      schemaVersion: 1,
      narrationScript: "Hello.",
      voice: "v",
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
      actions: [
        { id: "a1", type: "fullBleedGraphic", atSeconds: 0, durationSeconds: 3, imageConcept: "a red ball" },
      ],
    };
    await expect(
      resolveSceneDocument({ scenes, echoModelId: "does-not-exist" } as never),
    ).rejects.toThrow(/echoModelId.*not found/i);
  });
});
