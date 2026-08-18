import fs from "node:fs";
import path from "node:path";
import type { AdAssetRecord } from "./firestore";

/** Same fallback discipline as images/assetLibrary/localRegistry.ts — this sandbox has no GCP credentials to reach real Firestore. */
const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "ad-assets-registry.json");

function readAll(): AdAssetRecord[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as AdAssetRecord[];
}

function writeAll(records: AdAssetRecord[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2));
}

export function appendLocalAdAsset(record: AdAssetRecord): void {
  const all = readAll();
  all.push(record);
  writeAll(all);
}

export function getLocalAdAsset(id: string): AdAssetRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function listLocalAdAssetsForKey(apiKeyId: string): AdAssetRecord[] {
  return readAll().filter((r) => r.apiKeyId === apiKeyId);
}

export function removeLocalAdAsset(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}
