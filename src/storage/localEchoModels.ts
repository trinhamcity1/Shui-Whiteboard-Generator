import fs from "node:fs";
import path from "node:path";
import type { EchoModelRecord } from "../images/styleModel/echoTypes";

/** Same fallback discipline as localApiKeys.ts — this sandbox has no GCP credentials to reach real Firestore. */
const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "echo-models-registry.json");

function readAll(): EchoModelRecord[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as EchoModelRecord[];
}

function writeAll(records: EchoModelRecord[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2));
}

export function upsertLocalEchoModel(record: EchoModelRecord): void {
  const all = readAll().filter((r) => r.id !== record.id);
  all.push(record);
  writeAll(all);
}

export function getLocalEchoModel(id: string): EchoModelRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function listLocalEchoModelsForOwner(ownerLabel: string): EchoModelRecord[] {
  return readAll().filter((r) => r.ownerLabel === ownerLabel);
}
