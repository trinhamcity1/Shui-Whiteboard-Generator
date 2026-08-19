import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import type { StyleModelTestAsset, StyleModelVersion } from "./types";
import { SHARED_STYLE } from "./candidatePrompts";

const COST_PER_IMAGE_USD = 0.03; // LoRA inference runs slightly above plain Flux Schnell's $0.02.
const INFERENCE_ENDPOINT = "fal-ai/flux-lora";

/**
 * Amendment §3 sign-off gate: generate a handful of NEW subjects (not the
 * curated training images themselves) through the trained model, so the
 * shareholder can judge whether it actually holds the style on unseen
 * content before anything else proceeds.
 */
export async function generateStyleModelTestAssets(args: {
  apiKey: string;
  styleModel: StyleModelVersion;
  subjects: Array<{ id: string; description: string }>;
  outDir: string;
}): Promise<StyleModelTestAsset[]> {
  const { apiKey, styleModel, subjects, outDir } = args;
  fal.config({ credentials: apiKey });
  fs.mkdirSync(outDir, { recursive: true });

  const results: StyleModelTestAsset[] = [];

  for (const subject of subjects) {
    const prompt = `${styleModel.triggerWord}, ${subject.description}. Style: ${SHARED_STYLE}.`;
    console.log(`Generating sign-off test asset "${subject.id}"...`);

    const result = await fal.subscribe(INFERENCE_ENDPOINT, {
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
    if (!image) {
      throw new Error(`No image returned for test asset "${subject.id}". Raw result: ${JSON.stringify(result.data)}`);
    }

    const imageResponse = await fetch(image.url);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const localPath = path.join(outDir, `${subject.id}.png`);
    fs.writeFileSync(localPath, buffer);

    results.push({
      id: subject.id,
      prompt,
      localPath,
      costUsd: COST_PER_IMAGE_USD,
      styleModelVersion: styleModel.version,
    });
  }

  const manifestPath = path.join(outDir, "test-assets-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));

  return results;
}
