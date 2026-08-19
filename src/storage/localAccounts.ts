import fs from "node:fs";
import path from "node:path";
import type { AccountRecord } from "../billing/types";

const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "accounts-registry.json");

function readAll(): AccountRecord[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as AccountRecord[];
}

function writeAll(records: AccountRecord[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2));
}

export function upsertLocalAccount(record: AccountRecord): void {
  const all = readAll().filter((r) => r.ownerLabel !== record.ownerLabel);
  all.push(record);
  writeAll(all);
}

export function getLocalAccount(ownerLabel: string): AccountRecord | null {
  return readAll().find((r) => r.ownerLabel === ownerLabel) ?? null;
}
