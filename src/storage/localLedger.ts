import fs from "node:fs";
import path from "node:path";
import type { LedgerEntry } from "../billing/types";

const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "ledger-registry.json");

function readAll(): LedgerEntry[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as LedgerEntry[];
}

function writeAll(records: LedgerEntry[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(records, null, 2));
}

export function appendLocalLedgerEntry(entry: LedgerEntry): void {
  const all = readAll();
  all.push(entry);
  writeAll(all);
}

export function listLocalLedgerForOwner(ownerLabel: string): LedgerEntry[] {
  return readAll()
    .filter((e) => e.ownerLabel === ownerLabel)
    .sort((a, b) => b.createdAt - a.createdAt);
}
