import fs from "node:fs";
import path from "node:path";
import {
  getLibraryAsset,
  listLibraryAssets,
  isFirestoreKnownUnreachable,
  markFirestoreUnreachable,
  type LibraryAssetRecord,
} from "../../storage/firestore";
import { listLocalAutoExpandedAssets } from "./localRegistry";

export interface ResolvedAsset {
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  anchors?: Array<{ xFraction: number; yFraction: number; kind: "label" | "inset" | "attachment" }>;
}

let localV1RegistryCache: Map<string, LibraryAssetRecord> | undefined;

/**
 * Firestore is the real registry (amendment §4), but this dev/test
 * environment has no GCP credentials to reach it. Falls back to the local
 * JSON registry scripts/generate-v1-library.ts writes, so the pipeline
 * still works end to end wherever Firestore isn't reachable — a real
 * deployment (Cloud Run, real GCP creds) hits Firestore first and never
 * needs this fallback.
 */
function loadLocalV1Registry(): Map<string, LibraryAssetRecord> {
  if (localV1RegistryCache) return localV1RegistryCache;
  const registryPath = path.join(process.cwd(), "style-model-candidates", "v1-library-registry.json");
  const map = new Map<string, LibraryAssetRecord>();
  if (fs.existsSync(registryPath)) {
    const entries = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as LibraryAssetRecord[];
    for (const entry of entries) map.set(entry.id, entry);
  }
  localV1RegistryCache = map;
  return map;
}

export async function resolveAssetId(assetId: string): Promise<ResolvedAsset | null> {
  if (!isFirestoreKnownUnreachable()) {
    try {
      const record = await getLibraryAsset(assetId);
      if (record) return { imageUrl: record.imageUrl, widthPx: record.widthPx, heightPx: record.heightPx, anchors: record.anchors };
    } catch {
      // Firestore unreachable (no GCP credentials in this environment) — fall through to the local registry.
      markFirestoreUnreachable();
    }
  }
  const v1 = loadLocalV1Registry().get(assetId);
  if (v1) return { imageUrl: v1.imageUrl, widthPx: v1.widthPx, heightPx: v1.heightPx, anchors: v1.anchors };
  const autoExpanded = listLocalAutoExpandedAssets().find((r) => r.id === assetId);
  return autoExpanded
    ? { imageUrl: autoExpanded.imageUrl, widthPx: autoExpanded.widthPx, heightPx: autoExpanded.heightPx, anchors: autoExpanded.anchors }
    : null;
}

/**
 * Every known library asset, v1-manifest + Layer 2 auto-expanded
 * (promoted or still quarantined — a quarantined asset is still real and
 * still worth matching against, it just hasn't cleared the shared-registry
 * bar yet). Used by Layer 2's semantic near-match search, which needs the
 * full catalog of descriptions to compare a new concept against.
 */
export async function listAllLibraryAssets(): Promise<LibraryAssetRecord[]> {
  if (!isFirestoreKnownUnreachable()) {
    try {
      const remote = await listLibraryAssets();
      if (remote.length > 0) return remote;
    } catch {
      // Firestore unreachable — fall through to the local registries.
      markFirestoreUnreachable();
    }
  }
  return [...loadLocalV1Registry().values(), ...listLocalAutoExpandedAssets()];
}
