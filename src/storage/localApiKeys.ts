import fs from "node:fs";
import path from "node:path";
import type { ApiKeyRecord } from "./firestore";

/** Same fallback discipline as localAdAssets.ts / assetLibrary/localRegistry.ts — this sandbox has no GCP credentials to reach real Firestore. */
const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "api-keys-registry.json");

function readAll(): ApiKeyRecord[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as ApiKeyRecord[];
}

function writeAll(records: ApiKeyRecord[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2));
}

export function appendLocalApiKey(record: ApiKeyRecord): void {
  const all = readAll().filter((r) => r.id !== record.id);
  all.push(record);
  writeAll(all);
}

export function getLocalApiKey(id: string): ApiKeyRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function listLocalApiKeysForOwner(ownerLabel: string): ApiKeyRecord[] {
  return readAll().filter((r) => r.ownerLabel === ownerLabel);
}

export function setLocalApiKeyActive(id: string, isActive: boolean): void {
  const all = readAll();
  const index = all.findIndex((r) => r.id === id);
  if (index === -1) return;
  all[index] = { ...all[index]!, isActive };
  writeAll(all);
}
