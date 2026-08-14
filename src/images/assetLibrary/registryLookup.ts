import fs from "node:fs";
import path from "node:path";
import { getLibraryAsset, type LibraryAssetRecord } from "../../storage/firestore";

export interface ResolvedAsset {
  imageUrl: string;
  widthPx: number;
  heightPx: number;
}

let localRegistryCache: Map<string, ResolvedAsset> | undefined;

/**
 * Firestore is the real registry (amendment §4), but this dev/test
 * environment has no GCP credentials to reach it. Falls back to the local
 * JSON registry scripts/generate-v1-library.ts writes, so the pipeline
 * still works end to end wherever Firestore isn't reachable — a real
 * deployment (Cloud Run, real GCP creds) hits Firestore first and never
 * needs this fallback.
 */
function loadLocalRegistry(): Map<string, ResolvedAsset> {
  if (localRegistryCache) return localRegistryCache;
  const registryPath = path.join(process.cwd(), "style-model-candidates", "v1-library-registry.json");
  const map = new Map<string, ResolvedAsset>();
  if (fs.existsSync(registryPath)) {
    const entries = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as Array<
      LibraryAssetRecord & { widthPx: number; heightPx: number }
    >;
    for (const entry of entries) {
      map.set(entry.id, { imageUrl: entry.imageUrl, widthPx: entry.widthPx, heightPx: entry.heightPx });
    }
  }
  localRegistryCache = map;
  return map;
}

export async function resolveAssetId(assetId: string): Promise<ResolvedAsset | null> {
  try {
    const record = await getLibraryAsset(assetId);
    if (record) return { imageUrl: record.imageUrl, widthPx: record.widthPx, heightPx: record.heightPx };
  } catch {
    // Firestore unreachable (no GCP credentials in this environment) — fall through to the local registry.
  }
  return loadLocalRegistry().get(assetId) ?? null;
}
