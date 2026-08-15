import fs from "node:fs";
import path from "node:path";
import { ASSET_MANIFEST, describeManifestEntry } from "../src/images/assetLibrary/manifest";
import type { LibraryAssetRecord } from "../src/storage/firestore";

// Layer 2 adds description/origin/quarantineStatus to LibraryAssetRecord.
// The v1 library was generated before those fields existed — this backfills
// the existing local registry in place (no re-generation, no new cost).
// v1-manifest assets are hand-curated and already sign-off-approved, so they
// backfill straight to quarantineStatus "promoted".

async function main() {
  const registryPath = path.join(process.cwd(), "style-model-candidates", "v1-library-registry.json");
  const entries = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as Array<LibraryAssetRecord & Record<string, unknown>>;

  const manifestById = new Map(ASSET_MANIFEST.map((e) => [e.id, e]));
  let updated = 0;

  for (const entry of entries) {
    const manifestEntry = manifestById.get(entry.id);
    if (!manifestEntry) {
      console.warn(`No manifest entry for registry id "${entry.id}" — leaving description empty.`);
    }
    entry.description = manifestEntry ? describeManifestEntry(manifestEntry) : entry.id;
    entry.origin = "v1-manifest";
    entry.quarantineStatus = "promoted";
    updated++;
  }

  fs.writeFileSync(registryPath, JSON.stringify(entries, null, 2));
  console.log(`Backfilled ${updated} v1 registry entries with description/origin/quarantineStatus.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
