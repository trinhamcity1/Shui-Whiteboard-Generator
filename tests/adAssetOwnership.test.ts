import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveProductImageUrls } from "../src/pipeline/resolveAdDocument";
import { appendLocalAdAsset } from "../src/storage/localAdAssets";
import type { AdRequest } from "../src/schema/ad";

const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "ad-assets-registry.json");

function baseRequest(productImages: AdRequest["productImages"]): AdRequest {
  return {
    mode: "ad",
    businessName: "Test Co.",
    businessType: "physical-product",
    productDescription: "A thing",
    productImages,
    platform: "instagram",
    durationSeconds: "auto",
    voice: "voice-id",
  };
}

describe("resolveProductImageUrls", () => {
  beforeEach(() => {
    if (fs.existsSync(REGISTRY_PATH)) fs.rmSync(REGISTRY_PATH);
  });
  afterEach(() => {
    if (fs.existsSync(REGISTRY_PATH)) fs.rmSync(REGISTRY_PATH);
  });

  it("passes a raw url through untouched", async () => {
    const resolved = await resolveProductImageUrls(baseRequest([{ url: "https://example.com/a.jpg", label: "front" }]), "keyA");
    expect(resolved).toEqual([{ url: "https://example.com/a.jpg", label: "front" }]);
  });

  it("resolves an assetId owned by the requesting key", async () => {
    appendLocalAdAsset({
      id: "asset-1",
      apiKeyId: "keyA",
      r2Key: "users/keyA/uploads/asset-1.jpg",
      url: "https://r2.example.com/asset-1.jpg",
      contentType: "image/jpeg",
      createdAt: Date.now(),
    });

    const resolved = await resolveProductImageUrls(baseRequest([{ assetId: "asset-1" }]), "keyA");
    expect(resolved).toEqual([{ url: "https://r2.example.com/asset-1.jpg", label: undefined }]);
  });

  it("rejects an assetId owned by a different key", async () => {
    appendLocalAdAsset({
      id: "asset-2",
      apiKeyId: "keyB",
      r2Key: "users/keyB/uploads/asset-2.jpg",
      url: "https://r2.example.com/asset-2.jpg",
      contentType: "image/jpeg",
      createdAt: Date.now(),
    });

    await expect(resolveProductImageUrls(baseRequest([{ assetId: "asset-2" }]), "keyA")).rejects.toThrow(/not owned/);
  });

  it("rejects a non-existent assetId", async () => {
    await expect(resolveProductImageUrls(baseRequest([{ assetId: "does-not-exist" }]), "keyA")).rejects.toThrow(/not found/);
  });
});
