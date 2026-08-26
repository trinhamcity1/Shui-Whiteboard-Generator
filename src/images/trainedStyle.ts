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

  // Public so Layer 2's autoExpand flow (src/images/assetLibrary/autoExpand.ts)
  // can reuse this exact key/model pair instead of re-deriving them —
  // it needs to call fal.ai directly with the same trained LoRA, not just
  // through this class's generate() method.
  constructor(
    readonly apiKey: string,
    readonly styleModel: StyleModelVersion,
  ) {
    if (!apiKey) throw new Error("TrainedStyleImageProvider requires a fal.ai API key.");
  }

  async generate(
    concept: string,
    opts: { styleVariant: string; orientation: "vertical" | "horizontal"; backgroundMode?: "cutout" | "scene" },
  ): Promise<RawGeneratedImage> {
    const backgroundMode = opts.backgroundMode ?? "cutout";
    const first = await this.generateOnce(concept, backgroundMode);
    if (!(await isEffectivelyBlank(first.imageBuffer))) return first;

    // Caught on a real render: the model occasionally returns a flat/empty
    // result for a concept — background removal then strips it down to a
    // fully (or near-fully) blank image, silently rendering as an empty
    // white box with no indication anything went wrong. One retry before
    // accepting whatever comes back, same discipline as the planner's own
    // one-retry-then-accept pattern elsewhere in this pipeline.
    const retry = await this.generateOnce(concept, backgroundMode);
    return retry;
  }

  private async generateOnce(concept: string, backgroundMode: "cutout" | "scene"): Promise<RawGeneratedImage> {
    fal.config({ credentials: this.apiKey });

    // Caught on a real render batch: every "scene" concept (a ship on the
    // ocean, a forest, a palace interior) was still being told to render
    // against a flat cream background, same as a character cutout — the
    // model then blended the two instructions into a baked-in cream
    // vignette wash over the real scene, which the flood-fill background
    // remover (built for a genuinely flat background) couldn't cleanly key
    // out either. Scene mode asks for the opposite and skips removal
    // entirely below.
    //
    // Revision 4 gap: this file's own hardcoded "warm painterly" + "cream
    // background" wording was never updated when candidatePrompts.ts moved
    // to the cool palette — it's a separate live one-off/fallback path (not
    // the trained LoRA's baked-in style), so it kept generating warm output
    // straight through the whole regeneration. Root cause of a real render's
    // yellow-toned US-map backdrop surviving the "fixed" library.
    const prompt =
      backgroundMode === "scene"
        ? `${this.styleModel.triggerWord}, cool-toned painterly storybook illustration, ${concept}, ` +
          "a fully rendered illustrated environment filling the entire frame, no flat color background, " +
          "no vignette, no border, no text, no lettering, no warm/yellow/orange/sepia color cast — " +
          "cool and neutral tones only (blues, teals, cool grays, muted greens)"
        : `${this.styleModel.triggerWord}, cool-toned painterly storybook illustration, ${concept}, ` +
          "FLAT SOLID UNIFORM cool white background color only, no vignette, no glow, no gradient, " +
          "no atmospheric lighting effect, no shading or wash behind the subject, no text, no lettering, " +
          "no warm/yellow/cream color cast";

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

    if (backgroundMode === "scene") {
      // fal.ai doesn't guarantee PNG bytes back just because we didn't ask
      // for a specific format — a real response came back as JPEG here and
      // crashed the later vision quality-check call, which trusts the
      // declared contentType. The cutout path never hit this because
      // removeFlatBackground always re-encodes through sharp's .png() on
      // its way out; normalize here the same way instead of trusting
      // whatever fal.ai actually sent.
      const sharp = (await import("sharp")).default;
      const pngBuffer = await sharp(rawBuffer).png().toBuffer();
      const metadata = await sharp(pngBuffer).metadata();
      return {
        imageBuffer: pngBuffer,
        contentType: "image/png",
        widthPx: metadata.width ?? 0,
        heightPx: metadata.height ?? 0,
        costUsd: COST_PER_IMAGE_USD,
      };
    }

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

/** True if the image has no real visible content — either almost entirely
 * transparent (background removal found no subject to keep) or almost
 * entirely one flat color (a wash with nothing drawn on it). Caught on a
 * real render: a "pen full of pigs" concept came back as a fully blank
 * 1024x1024 white square, rendering as an empty box with no error. */
async function isEffectivelyBlank(buffer: Buffer): Promise<boolean> {
  const sharp = (await import("sharp")).default;
  const stats = await sharp(buffer).stats();
  const alphaChannel = stats.channels[3];
  if (alphaChannel && alphaChannel.mean < 8) return true;
  const [r, g, b] = stats.channels;
  const maxStdev = Math.max(r?.stdev ?? 0, g?.stdev ?? 0, b?.stdev ?? 0);
  return maxStdev < 3;
}
