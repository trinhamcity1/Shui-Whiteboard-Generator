import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const INPUT_COST_PER_MTOK_USD = 0.8;
const OUTPUT_COST_PER_MTOK_USD = 4.0;

export interface AnchorDetectionResult {
  labelAnchor: { xFraction: number; yFraction: number } | null;
  dominantColor: string | null;
  tokensUsed: number;
  costUsd: number;
}

/**
 * Layer 2 step 3: reads a newly generated asset and returns where a text
 * label would sit well on it (e.g. a plaque/sign area on a building), plus
 * the asset's dominant color for matching a label board to it — no human
 * ever clicks a coordinate. See the revision-2 doc, Layer 1's labelAnchor
 * field and Layer 2's step 3.
 *
 * Returns nulls (never throws) when the model can't find a sensible flat
 * area to label — not every asset needs one, and a bad guess is worse than
 * no anchor at all since a caller only uses this for label placement.
 */
export async function detectLabelAnchor(
  imageBuffer: Buffer,
  opts: { apiKey?: string; model?: string } = {},
): Promise<AnchorDetectionResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — required for Layer 2 anchor detection.");

  const client = new Anthropic({ apiKey });
  const system = `You look at a single illustration (transparent/flat background already removed) and find
the single best flat area on the subject itself for a short text label to sit on top of — e.g. a
sign, a plaque, a building's frieze, a book's cover, a flag's field. Many illustrations (a person,
a simple prop with no flat surface) have NO sensible label area — say so honestly, don't invent one.

Respond with ONLY a JSON object:
{"hasLabelArea": boolean, "xFraction": number | null, "yFraction": number | null, "dominantColor": string}
xFraction/yFraction are 0-1 fractions of the image's own width/height (0,0 = top-left), the center
of the best label area, or null if hasLabelArea is false. dominantColor is a short CSS-style hex
color (e.g. "#8a6d4b") sampled from the subject's largest solid-color region.`;

  const response = await client.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: 200,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: imageBuffer.toString("base64") } },
          { type: "text", text: "Find the label anchor and dominant color for this illustration." },
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
      hasLabelArea: boolean;
      xFraction: number | null;
      yFraction: number | null;
      dominantColor: string;
    };
    const labelAnchor =
      parsed.hasLabelArea && typeof parsed.xFraction === "number" && typeof parsed.yFraction === "number"
        ? { xFraction: parsed.xFraction, yFraction: parsed.yFraction }
        : null;
    return { labelAnchor, dominantColor: parsed.dominantColor ?? null, tokensUsed, costUsd };
  } catch {
    return { labelAnchor: null, dominantColor: null, tokensUsed, costUsd };
  }
}
