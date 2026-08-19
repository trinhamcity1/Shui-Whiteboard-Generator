import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { ASSET_MANIFEST } from "../src/images/assetLibrary/manifest";
import { buildLibraryPrompt } from "../src/images/styleModel/libraryPrompt";
import { removeFlatBackground } from "../src/images/styleModel/removeBackground";
import type { StyleModelVersion } from "../src/images/styleModel/types";

// One-off: re-generate specific v1-library assets that failed visual QA
// (blank output, garbled generation, or an off-brief painterly result),
// without re-spending on the 18 assets that already passed. Pass ids as
// argv: npx tsx scripts/retry-v1-library-assets.ts narrator-thinking prop-lightbulb civics-prop-gavel

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) throw new Error("Pass at least one asset id to retry.");

  const apiKey = process.env.FLUX_API_KEY;
  if (!apiKey) throw new Error("FLUX_API_KEY is required.");
  fal.config({ credentials: apiKey });

  const versionPath = path.join(process.cwd(), "style-model-candidates", "style-model-version.json");
  const styleModel = JSON.parse(fs.readFileSync(versionPath, "utf-8")) as StyleModelVersion;

  const rawDir = path.join(process.cwd(), "style-model-candidates", "v1-library-raw");
  const finalDir = path.join(process.cwd(), "style-model-candidates", "v1-library");

  for (const id of ids) {
    const entry = ASSET_MANIFEST.find((e) => e.id === id);
    if (!entry) throw new Error(`No manifest entry for "${id}".`);

    process.stdout.write(`Retrying ${id}... `);
    const prompt = buildLibraryPrompt(entry, styleModel.triggerWord);
    const result = await fal.subscribe("fal-ai/flux-lora", {
      input: { prompt, loras: [{ path: styleModel.loraUrl, scale: 1 }], image_size: "square_hd", num_images: 1 },
      logs: false,
    });

    const data = result.data as { images: Array<{ url: string }> };
    const image = data.images?.[0];
    if (!image) throw new Error(`No image returned for "${id}".`);

    const imageResponse = await fetch(image.url);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const rawPath = path.join(rawDir, `${id}.png`);
    fs.writeFileSync(rawPath, buffer);

    const finalPath = path.join(finalDir, `${id}.png`);
    await removeFlatBackground({ inputPath: rawPath, outputPath: finalPath });
    console.log("done");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
