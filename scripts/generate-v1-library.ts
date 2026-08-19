import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { ASSET_MANIFEST, describeManifestEntry } from "../src/images/assetLibrary/manifest";
import { buildLibraryPrompt } from "../src/images/styleModel/libraryPrompt";
import { removeFlatBackground } from "../src/images/styleModel/removeBackground";
import { uploadBufferToR2 } from "../src/storage/r2";
import type { StyleModelVersion } from "../src/images/styleModel/types";

// Revision-2 Layer 0 finish: generate the real v1 library (amendment
// §1-2's 20-asset manifest) through the TRAINED model, not the pre-training
// candidates — see the "training data vs. final assets" distinction
// discussed with the shareholder. Firestore isn't reachable from this
// session (no GCP credentials), so results are written to a local JSON
// registry alongside the real R2-hosted images; syncing that JSON into
// Firestore is a follow-up once this runs somewhere with GCP access.

const COST_PER_IMAGE_USD = 0.03;

interface RegistryEntry {
  id: string;
  tier: string;
  role: string;
  r2Key: string;
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  costUsd: number;
  styleModelVersion: string;
  generatedAt: string;
  localPath: string;
  description: string;
  origin: "v1-manifest";
  quarantineStatus: "promoted";
}

async function main() {
  const apiKey = process.env.FLUX_API_KEY;
  if (!apiKey) throw new Error("FLUX_API_KEY is required.");
  fal.config({ credentials: apiKey });

  const versionPath = path.join(process.cwd(), "style-model-candidates", "style-model-version.json");
  const styleModel = JSON.parse(fs.readFileSync(versionPath, "utf-8")) as StyleModelVersion;

  // Incremental, not a full-rebuild-every-run script — this used to
  // overwrite the whole registry from ASSET_MANIFEST on every run, which
  // meant adding a handful of new manifest entries and re-running would
  // silently re-spend real money regenerating every asset that already
  // existed. Load whatever's already on disk, keep it as-is, and only
  // pay for entries the registry doesn't have yet (--force regenerates
  // everything, for when the trained style model itself changes).
  const force = process.argv.includes("--force");
  const registryPath = path.join(process.cwd(), "style-model-candidates", "v1-library-registry.json");
  const existingRegistry: RegistryEntry[] = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf-8")) : [];
  const existingIds = new Set(existingRegistry.map((e) => e.id));
  const toGenerate = force ? ASSET_MANIFEST : ASSET_MANIFEST.filter((e) => !existingIds.has(e.id));

  console.log(
    `Generating v1 library through trained model ${styleModel.version}: ${toGenerate.length} new asset(s), ${force ? 0 : existingIds.size} already present and kept as-is.\n`,
  );

  const rawDir = path.join(process.cwd(), "style-model-candidates", "v1-library-raw");
  const finalDir = path.join(process.cwd(), "style-model-candidates", "v1-library");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(finalDir, { recursive: true });

  const registry: RegistryEntry[] = force ? [] : existingRegistry.filter((e) => ASSET_MANIFEST.some((m) => m.id === e.id));
  let totalCost = 0;

  for (let i = 0; i < toGenerate.length; i++) {
    const entry = toGenerate[i]!;
    process.stdout.write(`[${i + 1}/${toGenerate.length}] ${entry.id}... `);

    const prompt = buildLibraryPrompt(entry, styleModel.triggerWord);
    const result = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt,
        loras: [{ path: styleModel.loraUrl, scale: 1 }],
        image_size: "square_hd",
        num_images: 1,
      },
      logs: false,
    });

    const data = result.data as { images: Array<{ url: string }> };
    const image = data.images?.[0];
    if (!image) throw new Error(`No image returned for "${entry.id}".`);

    const imageResponse = await fetch(image.url);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const rawPath = path.join(rawDir, `${entry.id}.png`);
    fs.writeFileSync(rawPath, buffer);

    const finalPath = path.join(finalDir, `${entry.id}.png`);
    await removeFlatBackground({ inputPath: rawPath, outputPath: finalPath });

    const finalBuffer = fs.readFileSync(finalPath);
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(finalBuffer).metadata();

    const r2Key = `assets/${entry.tier}/${entry.id}.png`;
    const { url } = await uploadBufferToR2({ buffer: finalBuffer, key: r2Key, contentType: "image/png" });

    registry.push({
      id: entry.id,
      tier: entry.tier,
      role: entry.role,
      r2Key,
      imageUrl: url,
      widthPx: metadata.width ?? 0,
      heightPx: metadata.height ?? 0,
      costUsd: COST_PER_IMAGE_USD,
      styleModelVersion: styleModel.version,
      generatedAt: new Date().toISOString(),
      localPath: finalPath,
      description: describeManifestEntry(entry),
      origin: "v1-manifest",
      quarantineStatus: "promoted",
    });
    totalCost += COST_PER_IMAGE_USD;
    console.log("done");
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  console.log(`\nGenerated ${toGenerate.length} new asset(s) for $${totalCost.toFixed(2)}. Registry now has ${registry.length} total.`);
  console.log(`Registry: ${registryPath}`);
  console.log(`Local images: ${finalDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
