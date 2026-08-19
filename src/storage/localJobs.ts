import fs from "node:fs";
import path from "node:path";
import type { JobRecord } from "./firestore";

// Same fallback discipline as localApiKeys.ts / localEchoModels.ts — this
// sandbox has no GCP credentials to reach real Firestore. Jobs were the one
// record type that never got this treatment (createJob/getJob/updateJob/
// listJobsForKey all called getDb() unconditionally), which crashes any
// live video-generation request the instant Firestore is unreachable —
// caught while live-testing the billing gate against a running server.
const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "jobs-registry.json");

function readAll(): JobRecord[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as JobRecord[];
}

function writeAll(records: JobRecord[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2));
}

export function upsertLocalJob(record: JobRecord): void {
  const all = readAll().filter((r) => r.id !== record.id);
  all.push(record);
  writeAll(all);
}

export function getLocalJob(id: string): JobRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function listLocalJobsForKey(apiKeyId: string, limit: number, offset: number): JobRecord[] {
  return readAll()
    .filter((r) => r.apiKeyId === apiKeyId && r.deletedAt === null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(offset, offset + limit);
}
