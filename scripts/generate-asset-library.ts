import "dotenv/config";
import { ASSET_MANIFEST } from "../src/images/assetLibrary/manifest";
import { generateLibraryAsset } from "../src/images/assetLibrary/generateAsset";
import type { AssetManifestEntry } from "../src/images/assetLibrary/types";
import { uploadBufferToR2 } from "../src/storage/r2";
import { getLibraryAsset, createLibraryAsset } from "../src/storage/firestore";

// Amendment §8, step 1: generate the small test batch first (--test),
// review those against the Golpo reference, then run the full manifest
// (no flag) only once approved. Idempotent either way — an asset already
// in Firestore is skipped unless --force.
function extensionFor(contentType: string): string {
  return contentType.includes("svg") ? "svg" : "png";
}

async function generateOne(entry: AssetManifestEntry, keys: { recraftApiKey: string; fluxApiKey: string }) {
  const raw = await generateLibraryAsset(entry, keys);
  const r2Key = `assets/${entry.tier}/${entry.id}.${extensionFor(raw.contentType)}`;
  const { url } = await uploadBufferToR2({ buffer: raw.imageBuffer, key: r2Key, contentType: raw.contentType });

  await createLibraryAsset({
    id: entry.id,
    tier: entry.tier,
    role: entry.role,
    provider: entry.provider,
    r2Key,
    imageUrl: url,
    widthPx: raw.widthPx,
    heightPx: raw.heightPx,
    costUsd: raw.costUsd,
    generatedAt: new Date().toISOString(),
  });

  return { url, costUsd: raw.costUsd };
}

async function main() {
  const args = process.argv.slice(2);
  const testOnly = args.includes("--test");
  const force = args.includes("--force");

  const recraftApiKey = process.env.RECRAFT_API_KEY;
  const fluxApiKey = process.env.FLUX_API_KEY;
  if (!recraftApiKey) throw new Error("RECRAFT_API_KEY is not set. Fill it in .env.");
  if (!fluxApiKey) throw new Error("FLUX_API_KEY is not set. Fill it in .env.");

  const entries = testOnly ? ASSET_MANIFEST.filter((e) => e.isTest) : ASSET_MANIFEST;
  console.log(`Generating ${entries.length} asset(s)${testOnly ? " (test batch only)" : " (full manifest)"}...`);

  let totalCost = 0;
  let generated = 0;
  let skipped = 0;

  for (const [i, entry] of entries.entries()) {
    if (!force) {
      const existing = await getLibraryAsset(entry.id);
      if (existing) {
        console.log(`[${i + 1}/${entries.length}] ${entry.id} — already exists, skipping (use --force to regenerate)`);
        skipped++;
        continue;
      }
    }

    console.log(`[${i + 1}/${entries.length}] ${entry.id} (${entry.provider})...`);
    try {
      const result = await generateOne(entry, { recraftApiKey, fluxApiKey });
      console.log(`   -> $${result.costUsd.toFixed(4)}  ${result.url}`);
      totalCost += result.costUsd;
      generated++;
    } catch (err) {
      console.error(`   FAILED: ${(err as Error).message}`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Generated: ${generated}  Skipped (already existed): ${skipped}  Total cost: $${totalCost.toFixed(4)}`);
  if (testOnly) {
    console.log(`\nReview these against the Golpo reference frame before running the full batch:`);
    console.log(`  npm run generate-asset-library`);
  }
}

main().catch((err) => {
  console.error("generate-asset-library failed:", err);
  process.exitCode = 1;
});
