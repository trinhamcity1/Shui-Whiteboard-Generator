import { fal } from "@fal-ai/client";

// fal.ai's hosted rembg endpoint — confirmed real (fal-ai/imageutils/rembg,
// https://fal.ai/models/fal-ai/imageutils/rembg/api), not guessed. The
// kinetic-hero visual style needs a clean cutout of the business's own
// uploaded product photo (arbitrary background — a desk, a hand, a
// shelf), which the existing flood-fill remover in styleModel/
// removeBackground.ts can't handle: that one only works on the near-flat
// cream background the trained LoRA itself always generates. A real photo
// needs a real ML segmentation model instead.
const COST_PER_IMAGE_USD = 0.02; // approximate fal.ai rembg-family rate; not a real invoice

export interface BackgroundRemovalResult {
  imageBuffer: Buffer;
  costUsd: number;
}

export async function removeBackgroundViaFal(imageUrl: string, apiKey: string): Promise<BackgroundRemovalResult> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe("fal-ai/imageutils/rembg", {
    input: { image_url: imageUrl },
    logs: false,
  });

  const data = result.data as { image?: { url: string } };
  if (!data.image?.url) throw new Error(`Background removal returned no image for: ${imageUrl}`);

  const response = await fetch(data.image.url);
  if (!response.ok) throw new Error(`Failed to fetch background-removed image (${response.status}): ${data.image.url}`);
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  return { imageBuffer, costUsd: COST_PER_IMAGE_USD };
}
