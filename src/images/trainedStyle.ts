import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fal } from "@fal-ai/client";
import type { ImageProvider, RawGeneratedImage } from "./types";
import { removeFlatBackground } from "./styleModel/removeBackground";
import type { StyleModelVersion } from "./styleModel/types";

const COST_PER_IMAGE_USD = 0.03;

/**
 * Revision-2 Layer 2's actual fix: a live one-off generation (the
 * imageConcept fallback, for anything not already in the asset library)
 * must go through the SAME trained LoRA the library itself was built
 * from — otherwise a live fallback silently reverts to the disconnected
 * flat-vector Recraft/Flux style and breaks visual consistency the moment
 * the planner reaches for something the library doesn't have yet.
 */
export class TrainedStyleImageProvider implements ImageProvider {
  readonly name = "trained-style" as const;

  constructor(
    private readonly apiKey: string,
    private readonly styleModel: StyleModelVersion,
  ) {
    if (!apiKey) throw new Error("TrainedStyleImageProvider requires a fal.ai API key.");
  }

  async generate(
    concept: string,
    _opts: { styleVariant: string; orientation: "vertical" | "horizontal" },
  ): Promise<RawGeneratedImage> {
    fal.config({ credentials: this.apiKey });

    const prompt =
      `${this.styleModel.triggerWord}, warm painterly storybook illustration, ${concept}, ` +
      "FLAT SOLID UNIFORM cream background color only, no vignette, no glow, no gradient, " +
      "no atmospheric lighting effect, no shading or wash behind the subject, no text, no lettering";

    const result = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt,
        loras: [{ path: this.styleModel.loraUrl, scale: 1 }],
        image_size: "square_hd",
        num_images: 1,
      },
      logs: false,
    });

    const data = result.data as { images: Array<{ url: string }> };
    const image = data.images?.[0];
    if (!image) throw new Error(`Trained-style generation returned no image for concept: "${concept}"`);

    const imageResponse = await fetch(image.url);
    const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Same background-removal discipline as the library assets — a live
    // one-off is only usable in a composited scene if its background is
    // actually clean, not a raw flat-cream square.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trained-style-"));
    const rawPath = path.join(tmpDir, "raw.png");
    const finalPath = path.join(tmpDir, "final.png");
    fs.writeFileSync(rawPath, rawBuffer);
    await removeFlatBackground({ inputPath: rawPath, outputPath: finalPath });
    const finalBuffer = fs.readFileSync(finalPath);

    const sharp = (await import("sharp")).default;
    const metadata = await sharp(finalBuffer).metadata();
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return {
      imageBuffer: finalBuffer,
      contentType: "image/png",
      widthPx: metadata.width ?? 0,
      heightPx: metadata.height ?? 0,
      costUsd: COST_PER_IMAGE_USD,
    };
  }
}
