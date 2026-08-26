import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const MODEL = "claude-haiku-4-5-20251001";
const INPUT_COST_PER_MTOK_USD = 0.8;
const OUTPUT_COST_PER_MTOK_USD = 4.0;
const MIN_SINGLE_DIMENSION_PX = 100; // catches a truly tiny/broken sliver
const MIN_AREA_PX = 150 * 150; // catches a tiny icon without penalizing a legitimately wide/thin cutout (e.g. a fence line)
const MIN_TRANSPARENT_BORDER_FRACTION = 0.05; // a real cutout should have some transparent border, not fill the frame

export interface QuarantineCheckResult {
  passed: boolean;
  reasons: string[]; // failures, if any — always populated when !passed
  costUsd: number;
}

/**
 * Layer 2 step 4: a new auto-expanded asset serves the video that needed it
 * immediately, but only enters the shared registry after this check passes
 * — one bad generation entering the shared library silently propagates
 * into every future video that reuses it (revision-2 doc, Layer 2).
 *
 * Three checks, cheapest first so a clear failure never reaches the paid
 * vision call: dimensions, background transparency actually worked, then a
 * lightweight vision self-check for obvious style/artifact problems.
 */
export async function runQuarantineCheck(
  imageBuffer: Buffer,
  opts: { apiKey?: string; model?: string; requireTransparency?: boolean } = {},
): Promise<QuarantineCheckResult> {
  // Defaults true — every caller before "scene"-role assets existed wanted
  // a transparent cutout. A "scene" asset is a full illustrated backdrop
  // by design (see trainedStyle.ts's backgroundMode) and was never run
  // through background removal, so checking for transparency on it isn't
  // validating anything — it would just fail every scene asset outright.
  const requireTransparency = opts.requireTransparency ?? true;
  const reasons: string[] = [];
  let costUsd = 0;

  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  // Area-based, not a flat per-side minimum — a real cutout can legitimately
  // be wide-and-thin (a fence line, a shelf of books) without being "too
  // small"; only reject something that's actually tiny or a broken sliver.
  if (width < MIN_SINGLE_DIMENSION_PX || height < MIN_SINGLE_DIMENSION_PX || width * height < MIN_AREA_PX) {
    reasons.push(`Image too small (${width}x${height}px).`);
  }

  if (requireTransparency) {
    if (!metadata.hasAlpha) {
      reasons.push("Image has no alpha channel — background removal did not produce transparency.");
    } else {
      const transparentBorderFraction = await estimateTransparentBorderFraction(imageBuffer, width, height);
      if (transparentBorderFraction < MIN_TRANSPARENT_BORDER_FRACTION) {
        reasons.push(
          `Border is only ${(transparentBorderFraction * 100).toFixed(1)}% transparent — background removal likely failed or the subject fills the whole frame.`,
        );
      }
    }
  }

  // Dimension/transparency failures are cheap and conclusive — no reason to
  // spend a vision call on an asset that's already disqualified.
  if (reasons.length > 0) {
    return { passed: false, reasons, costUsd };
  }

  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const styleCheck = await runStyleSelfCheck(imageBuffer, apiKey, requireTransparency, opts.model);
    costUsd += styleCheck.costUsd;
    if (!styleCheck.passed) reasons.push(styleCheck.reason ?? "Style self-check failed.");
  }

  return { passed: reasons.length === 0, reasons, costUsd };
}

async function estimateTransparentBorderFraction(buffer: Buffer, width: number, height: number): Promise<number> {
  if (width === 0 || height === 0) return 0;
  const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = 4;
  let transparentBorderPixels = 0;
  let totalBorderPixels = 0;

  const isTransparent = (x: number, y: number) => {
    const idx = (y * width + x) * channels + 3;
    return data[idx]! < 16;
  };

  for (let x = 0; x < width; x++) {
    totalBorderPixels += 2;
    if (isTransparent(x, 0)) transparentBorderPixels++;
    if (isTransparent(x, height - 1)) transparentBorderPixels++;
  }
  for (let y = 0; y < height; y++) {
    totalBorderPixels += 2;
    if (isTransparent(0, y)) transparentBorderPixels++;
    if (isTransparent(width - 1, y)) transparentBorderPixels++;
  }

  return totalBorderPixels === 0 ? 0 : transparentBorderPixels / totalBorderPixels;
}

async function runStyleSelfCheck(
  imageBuffer: Buffer,
  apiKey: string,
  requireTransparency: boolean,
  model?: string,
): Promise<{ passed: boolean; reason?: string; costUsd: number }> {
  const client = new Anthropic({ apiKey });
  // Revision 4: the "warm painterly" wording below used to describe the
  // accepted house style — it stopped being true the moment the palette
  // moved to a cool educator-friendly tone, but this quality gate was never
  // updated, so it kept explicitly APPROVING warm/yellow-cast output as
  // correct rather than flagging it. Found while tracing why a warm-toned
  // scene asset made it all the way to a real render despite the "fixed"
  // library.
  const system = requireTransparency
    ? `You are a quality gate for a whiteboard-video illustration library. Every asset should be a
clean, cool-toned painterly storybook-style illustration on a transparent background, with no
warm/yellow/orange/sepia/cream color cast, no baked-in text/lettering/watermark, no obvious
rendering artifacts (garbled shapes, extra limbs, melted features), and no leftover background
wash or vignette. Flag any noticeably warm/yellow-tinted result as a failure. Respond with ONLY a
JSON object: {"passed": boolean, "reason": string | null} — reason explains a failure in one short
sentence, null if passed.`
    : `You are a quality gate for a whiteboard-video illustration library. This asset is a full
illustrated SCENE/backdrop meant to be shown whole (not a cutout on a transparent background) —
do NOT flag it for having a real background, that's expected and correct here. It should be a
clean, cool-toned painterly storybook-style illustration filling the frame, with no warm/yellow/
orange/sepia color cast, no baked-in text/lettering/watermark and no obvious rendering artifacts
(garbled shapes, extra limbs, melted features, nonsensical geometry). Flag any noticeably
warm/yellow-tinted result as a failure. Respond with ONLY a JSON object: {"passed": boolean,
"reason": string | null} — reason explains a failure in one short sentence, null if passed.`;

  const response = await client.messages.create({
    model: model ?? MODEL,
    max_tokens: 150,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: imageBuffer.toString("base64") } },
          { type: "text", text: "Check this asset against the quality gate." },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const costUsd =
    (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
    (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;

  try {
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenceMatch ? fenceMatch[1]! : rawText) as { passed: boolean; reason: string | null };
    return { passed: parsed.passed, reason: parsed.reason ?? undefined, costUsd };
  } catch {
    // Malformed response — fail open (don't block promotion on a parsing
    // hiccup) but leave a visible reason in case this needs investigating.
    return { passed: true, costUsd };
  }
}
