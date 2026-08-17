import Anthropic from "@anthropic-ai/sdk";
import type { AnchorKind, AnchorPoint } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const INPUT_COST_PER_MTOK_USD = 0.8;
const OUTPUT_COST_PER_MTOK_USD = 4.0;

export interface AnchorDetectionResult {
  /** @deprecated kept for existing callers — same value as the "label" entry in `anchors`, if any. */
  labelAnchor: { xFraction: number; yFraction: number } | null;
  anchors: AnchorPoint[];
  dominantColor: string | null;
  tokensUsed: number;
  costUsd: number;
}

/**
 * Layer 2 step 3 (revision-2), generalized in revision-3 Workstream 3: one
 * vision call now finds up to three kinds of anchor point on a newly
 * generated asset, no human ever clicking a coordinate:
 * - "label": a flat area for a text label to sit on (a sign, a plaque, a
 *   building's frieze) — the original single-purpose anchor.
 * - "inset": a good spot to place a small icon-scale illustration inside
 *   the asset itself (a diagram tier's inset), typically only meaningful
 *   on larger/simpler shapes.
 * - "attachment": a spot a character could stand/sit at *on* this asset
 *   (a building's front steps, a desk's chair) — what makes composition
 *   templates read as "characters interacting with content" instead of
 *   assets placed in neighboring slots (Part I §7/§8).
 *
 * Any/all of these can be absent — most assets (a plain character
 * portrait, a small prop) have none, and a bad guess is worse than no
 * anchor at all since callers only use this for placement.
 */
export async function detectAnchors(
  imageBuffer: Buffer,
  opts: { apiKey?: string; model?: string } = {},
): Promise<AnchorDetectionResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — required for anchor detection.");

  const client = new Anthropic({ apiKey });
  const system = `You look at a single illustration (transparent/flat background already removed) and find up to
three kinds of anchor point on it, each optional — most illustrations have zero or one, not all three:
1. "label": the single best flat area for a short text label to sit on top of — e.g. a sign, a
   plaque, a building's frieze, a book's cover, a flag's field.
2. "inset": a good spot to place a small icon-scale illustration INSIDE this asset (only meaningful
   for a large, simple shape like a building or box — never for a character or a small prop).
3. "attachment": a spot where a character could visually stand or sit ON this asset — e.g. a
   building's front steps, a bench, a desk's chair (only meaningful for scene-scale props/backdrops,
   never for a character itself).
Be honest — inventing an anchor that doesn't make sense is worse than reporting none.

Respond with ONLY a JSON object:
{"anchors": [{"kind": "label"|"inset"|"attachment", "xFraction": number, "yFraction": number}, ...],
"dominantColor": string}
xFraction/yFraction are 0-1 fractions of the image's own width/height (0,0 = top-left), the center of
that anchor. dominantColor is a short CSS-style hex color (e.g. "#8a6d4b") sampled from the subject's
largest solid-color region.`;

  const response = await client.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: 300,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: imageBuffer.toString("base64") } },
          { type: "text", text: "Find the anchor points and dominant color for this illustration." },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  const costUsd =
    (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
    (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;

  try {
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenceMatch ? fenceMatch[1]! : rawText) as {
      anchors: Array<{ kind: AnchorKind; xFraction: number; yFraction: number }>;
      dominantColor: string;
    };
    const anchors: AnchorPoint[] = (parsed.anchors ?? []).filter(
      (a) => typeof a.xFraction === "number" && typeof a.yFraction === "number" && ["label", "inset", "attachment"].includes(a.kind),
    );
    const label = anchors.find((a) => a.kind === "label");
    return {
      labelAnchor: label ? { xFraction: label.xFraction, yFraction: label.yFraction } : null,
      anchors,
      dominantColor: parsed.dominantColor ?? null,
      tokensUsed,
      costUsd,
    };
  } catch {
    return { labelAnchor: null, anchors: [], dominantColor: null, tokensUsed, costUsd };
  }
}

/** @deprecated use detectAnchors — kept so any existing caller keeps compiling. */
export const detectLabelAnchor = detectAnchors;
