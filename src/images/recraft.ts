import type { ImageProvider, RawGeneratedImage } from "./types";
import { buildImagePrompt } from "./promptStyle";

// Published Recraft list price, per the direction-update PDF's own figure —
// a planning-stage estimate, not pulled from a real invoice.
const COST_PER_IMAGE_USD = 0.08;

export class RecraftImageProvider implements ImageProvider {
  readonly name = "recraft" as const;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("RecraftImageProvider requires an API key (RECRAFT_API_KEY).");
    }
  }

  async generate(
    concept: string,
    opts: { styleVariant: string; orientation: "vertical" | "horizontal" },
  ): Promise<RawGeneratedImage> {
    const prompt = buildImagePrompt(concept, opts.styleVariant);
    // Recraft's fixed size enum — adjust if their API rejects this exact
    // value; the whiteboard aesthetic wants line-art (vector) output.
    const size = opts.orientation === "vertical" ? "1024x1820" : "1820x1024";

    const response = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        style: "vector_illustration",
        size,
        n: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Recraft image generation failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { data: Array<{ url: string }> };
    const imageUrl = data.data[0]?.url;
    if (!imageUrl) {
      throw new Error("Recraft response contained no image URL.");
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated Recraft image (${imageResponse.status}).`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get("content-type") ?? "image/svg+xml";

    const [widthPx, heightPx] = size.split("x").map(Number);

    return {
      imageBuffer,
      contentType,
      widthPx: widthPx!,
      heightPx: heightPx!,
      costUsd: COST_PER_IMAGE_USD,
    };
  }
}
