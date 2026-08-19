import type { ImageProvider, RawGeneratedImage } from "./types";
import { buildImagePrompt } from "./promptStyle";

// Published fal.ai rate for Flux Schnell, per the direction-update PDF's
// range ($0.015-0.02/image) — using the upper bound as the planning-stage
// estimate, not pulled from a real invoice.
const COST_PER_IMAGE_USD = 0.02;

export class FluxImageProvider implements ImageProvider {
  readonly name = "flux" as const;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("FluxImageProvider requires an API key (FLUX_API_KEY, from fal.ai or your chosen aggregator).");
    }
  }

  async generate(
    concept: string,
    opts: { styleVariant: string; orientation: "vertical" | "horizontal" },
  ): Promise<RawGeneratedImage> {
    const prompt = buildImagePrompt(concept, opts.styleVariant);
    const imageSize = opts.orientation === "vertical" ? "portrait_16_9" : "landscape_16_9";

    const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        Authorization: `Key ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_images: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Flux (fal.ai) image generation failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      images: Array<{ url: string; width: number; height: number; content_type: string }>;
    };
    const image = data.images[0];
    if (!image) {
      throw new Error("Flux (fal.ai) response contained no image.");
    }

    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated Flux image (${imageResponse.status}).`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    return {
      imageBuffer,
      contentType: image.content_type || "image/png",
      widthPx: image.width,
      heightPx: image.height,
      costUsd: COST_PER_IMAGE_USD,
    };
  }
}
