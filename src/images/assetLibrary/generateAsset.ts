import type { RawGeneratedImage } from "../types";
import type { AssetManifestEntry } from "./types";
import { buildAssetPrompt } from "./promptTemplate";
import { getRecraftStyleId, saveRecraftStyleId } from "../../storage/firestore";

const RECRAFT_COST_PER_IMAGE_USD = 0.08;
const FLUX_COST_PER_IMAGE_USD = 0.02;
const ASSET_SIZE = "1024x1024"; // standalone stickers — square, no orientation to match

/**
 * Recraft's custom-style feature keeps every pose of the same character
 * visually consistent (same line weight, same color treatment) — without
 * it, each generation can drift toward a slightly different look. This is
 * best-effort against Recraft's documented style-creation pattern; if it
 * fails for any reason (wrong endpoint shape, account tier, etc.), asset
 * generation still proceeds using the plain "vector_illustration" style —
 * degraded consistency, not a blocked build. Real API errors here should
 * be fixed the same way the image-size mismatch was fixed earlier: by
 * reading what Recraft actually says and correcting this function.
 */
async function ensureRecraftStyleId(characterFamily: string, apiKey: string): Promise<string | undefined> {
  const existing = await getRecraftStyleId(characterFamily);
  if (existing) return existing;

  try {
    const response = await fetch("https://external.api.recraft.ai/v1/styles", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ style: "vector_illustration" }),
    });

    if (!response.ok) {
      console.warn(`Recraft style creation failed (${response.status}) for "${characterFamily}" — falling back to the plain style param.`);
      return undefined;
    }

    const data = (await response.json()) as { id?: string; style_id?: string };
    const styleId = data.id ?? data.style_id;
    if (!styleId) {
      console.warn(`Recraft style creation returned no style id for "${characterFamily}" — falling back to the plain style param.`);
      return undefined;
    }

    await saveRecraftStyleId(characterFamily, styleId);
    return styleId;
  } catch (err) {
    console.warn(`Recraft style creation errored for "${characterFamily}": ${(err as Error).message} — falling back to the plain style param.`);
    return undefined;
  }
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status}).`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "image/png",
  };
}

async function generateRecraftAsset(entry: AssetManifestEntry, apiKey: string): Promise<RawGeneratedImage> {
  const prompt = buildAssetPrompt(entry);
  const styleId = entry.characterFamily ? await ensureRecraftStyleId(entry.characterFamily, apiKey) : undefined;

  const response = await fetch("https://external.api.recraft.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      ...(styleId ? { style_id: styleId } : { style: "vector_illustration" }),
      size: ASSET_SIZE,
      n: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Recraft asset generation failed for "${entry.id}" (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { data: Array<{ url: string }> };
  const imageUrl = data.data[0]?.url;
  if (!imageUrl) throw new Error(`Recraft response for "${entry.id}" contained no image URL.`);

  const { buffer, contentType } = await downloadImage(imageUrl);
  const [widthPx, heightPx] = ASSET_SIZE.split("x").map(Number);

  return { imageBuffer: buffer, contentType, widthPx: widthPx!, heightPx: heightPx!, costUsd: RECRAFT_COST_PER_IMAGE_USD };
}

async function generateFluxAsset(entry: AssetManifestEntry, apiKey: string): Promise<RawGeneratedImage> {
  const prompt = buildAssetPrompt(entry);

  const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_images: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Flux asset generation failed for "${entry.id}" (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    images: Array<{ url: string; width: number; height: number; content_type: string }>;
  };
  const image = data.images[0];
  if (!image) throw new Error(`Flux response for "${entry.id}" contained no image.`);

  const { buffer } = await downloadImage(image.url);

  // NOTE: Flux/fal.ai's raster output is not guaranteed to carry real alpha
  // transparency just because the prompt asks for a "transparent
  // background" — diffusion raster models commonly return an opaque
  // background despite the prompt. If generated props show a visible
  // background instead of true transparency, the fix is a background-
  // removal post-process (e.g. an rembg-style step), not a prompt tweak —
  // check the test batch output for this specifically before the full run.
  return {
    imageBuffer: buffer,
    contentType: image.content_type || "image/png",
    widthPx: image.width,
    heightPx: image.height,
    costUsd: FLUX_COST_PER_IMAGE_USD,
  };
}

export async function generateLibraryAsset(
  entry: AssetManifestEntry,
  keys: { recraftApiKey: string; fluxApiKey: string },
): Promise<RawGeneratedImage> {
  if (entry.provider === "recraft") return generateRecraftAsset(entry, keys.recraftApiKey);
  return generateFluxAsset(entry, keys.fluxApiKey);
}
