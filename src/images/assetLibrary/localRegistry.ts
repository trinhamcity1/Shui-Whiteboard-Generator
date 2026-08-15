import fs from "node:fs";
import path from "node:path";
import type { LibraryAssetRecord } from "../../storage/firestore";

/**
 * Firestore is the real registry (amendment §4), but this dev/test
 * environment has no GCP credentials to reach it. This local JSON file is
 * the fallback both v1 manifest generation and Layer 2 auto-expansion
 * write to, so the pipeline works end to end wherever Firestore isn't
 * reachable — a real deployment (Cloud Run, real GCP creds) hits
 * Firestore first and never needs this file.
 */
const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "auto-expanded-registry.json");

function readAll(): LibraryAssetRecord[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as LibraryAssetRecord[];
}

function writeAll(records: LibraryAssetRecord[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2));
}

export function appendLocalLibraryAsset(record: LibraryAssetRecord): void {
  const all = readAll();
  const withoutExisting = all.filter((r) => r.id !== record.id);
  withoutExisting.push(record);
  writeAll(withoutExisting);
}

export function updateLocalLibraryAsset(id: string, patch: Partial<LibraryAssetRecord>): void {
  const all = readAll();
  const index = all.findIndex((r) => r.id === id);
  if (index === -1) return;
  all[index] = { ...all[index]!, ...patch };
  writeAll(all);
}

export function listLocalAutoExpandedAssets(): LibraryAssetRecord[] {
  return readAll();
}
