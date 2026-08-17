import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ASSET_MANIFEST, describeManifestEntry } from "../src/images/assetLibrary/manifest";
import { uploadBufferToR2 } from "../src/storage/r2";

// Companion to retry-v1-library-assets.ts: re-uploads the locally-fixed
// PNGs to R2 and patches their entries in v1-library-registry.json, since
// the registry's imageUrl is a signed URL captured at upload time and
// doesn't pick up a local file overwrite on its own.

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) throw new Error("Pass at least one asset id to reupload.");

  const registryPath = path.join(process.cwd(), "style-model-candidates", "v1-library-registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as Array<Record<string, unknown>>;
  const finalDir = path.join(process.cwd(), "style-model-candidates", "v1-library");

  for (const id of ids) {
    const entry = ASSET_MANIFEST.find((e) => e.id === id);
    if (!entry) throw new Error(`No manifest entry for "${id}".`);
    const idx = registry.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`No registry entry for "${id}".`);

    const finalPath = path.join(finalDir, `${id}.png`);
    const finalBuffer = fs.readFileSync(finalPath);
    const metadata = await sharp(finalBuffer).metadata();

    const r2Key = `assets/${entry.tier}/${entry.id}.png`;
    const { url } = await uploadBufferToR2({ buffer: finalBuffer, key: r2Key, contentType: "image/png" });

    registry[idx] = {
      ...registry[idx],
      imageUrl: url,
      widthPx: metadata.width ?? 0,
      heightPx: metadata.height ?? 0,
      generatedAt: new Date().toISOString(),
      localPath: finalPath,
      description: describeManifestEntry(entry),
    };
    console.log(`Reuploaded ${id} -> ${url}`);
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.log(`\nRegistry updated: ${registryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
