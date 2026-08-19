import { fal } from "@fal-ai/client";

// fal.ai's hosted Bria RMBG 2.0 endpoint — confirmed real
// (fal-ai/bria/background/remove, https://fal.ai/models/fal-ai/bria/background/remove/api).
// The kinetic-hero visual style needs a clean cutout of the business's own
// uploaded product photo (arbitrary background — a desk, a hand, a
// shelf), which the existing flood-fill remover in styleModel/
// removeBackground.ts can't handle: that one only works on the near-flat
// cream background the trained LoRA itself always generates. A real photo
// needs a real ML segmentation model instead.
//
// Started on the cheaper fal-ai/imageutils/rembg baseline, but a real test
// render on a near-white-background product photo (the Insta360 GO 3 B&H
// shot) showed it erasing almost the entire white camera body along with
// the background — too close in color for that weaker model to segment.
// Bria RMBG 2.0 is the same model verified locally (via the Python rembg
// package) to handle this exact photo cleanly; same input/output shape,
// so this was a one-line swap once the failure was diagnosed.
const COST_PER_IMAGE_USD = 0.018; // fal.ai's published Bria RMBG 2.0 rate

export interface BackgroundRemovalResult {
  imageBuffer: Buffer;
  costUsd: number;
}

export async function removeBackgroundViaFal(imageUrl: string, apiKey: string): Promise<BackgroundRemovalResult> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe("fal-ai/bria/background/remove", {
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
