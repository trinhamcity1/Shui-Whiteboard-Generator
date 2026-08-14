import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { ASSET_MANIFEST } from "../src/images/assetLibrary/manifest";
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
}

async function main() {
  const apiKey = process.env.FLUX_API_KEY;
  if (!apiKey) throw new Error("FLUX_API_KEY is required.");
  fal.config({ credentials: apiKey });

  const versionPath = path.join(process.cwd(), "style-model-candidates", "style-model-version.json");
  const styleModel = JSON.parse(fs.readFileSync(versionPath, "utf-8")) as StyleModelVersion;
  console.log(`Generating v1 library (${ASSET_MANIFEST.length} assets) through trained model ${styleModel.version}\n`);

  const rawDir = path.join(process.cwd(), "style-model-candidates", "v1-library-raw");
  const finalDir = path.join(process.cwd(), "style-model-candidates", "v1-library");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(finalDir, { recursive: true });

  const registry: RegistryEntry[] = [];
  let totalCost = 0;

  for (let i = 0; i < ASSET_MANIFEST.length; i++) {
    const entry = ASSET_MANIFEST[i]!;
    process.stdout.write(`[${i + 1}/${ASSET_MANIFEST.length}] ${entry.id}... `);

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
    });
    totalCost += COST_PER_IMAGE_USD;
    console.log("done");
  }

  const registryPath = path.join(process.cwd(), "style-model-candidates", "v1-library-registry.json");
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  console.log(`\nGenerated ${registry.length} assets for $${totalCost.toFixed(2)}.`);
  console.log(`Registry: ${registryPath}`);
  console.log(`Local images: ${finalDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
