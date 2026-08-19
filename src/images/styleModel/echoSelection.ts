import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const MODEL = "claude-sonnet-5";
// Same Sonnet rates used elsewhere in this project (planning.ts, layoutQA.ts) — a planning-stage estimate, not a number pulled from a real bill.
const INPUT_COST_PER_MTOK_USD = 3.0;
const OUTPUT_COST_PER_MTOK_USD = 15.0;

const DEFAULT_TARGET_COUNT = 20;

const SelectionSchema = z.object({
  selectedIndices: z.array(z.number().int().min(0)).min(1),
});

export interface EchoSelectionResult {
  selectedUrls: string[];
  costUsd: number;
}

/**
 * Picks the strongest subset of a generated candidate pool to actually
 * train on — a vision-LLM quality/consistency check, same discipline as
 * layoutQA.ts's frame critique, applied to LoRA training-set curation
 * instead of a rendered video frame. Bad training images (garbled
 * anatomy, an off-style outlier, a near-duplicate of another candidate)
 * measurably hurt a small LoRA training set, so this isn't just picking
 * "any 20" — it's the one automated quality gate before real money gets
 * spent on the training call itself.
 */
export async function selectBestEchoCandidates(args: {
  candidateUrls: string[];
  targetCount?: number;
  apiKey?: string;
}): Promise<EchoSelectionResult> {
  const apiKey = args.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — required for Echo model candidate selection.");
  const targetCount = args.targetCount ?? DEFAULT_TARGET_COUNT;

  if (args.candidateUrls.length <= targetCount) {
    return { selectedUrls: args.candidateUrls, costUsd: 0 };
  }

  const client = new Anthropic({ apiKey });

  const imageBlocks = await Promise.all(
    args.candidateUrls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download candidate image for selection (${response.status}): ${url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") ?? "image/png";
      const mediaType: "image/jpeg" | "image/png" =
        contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg" : "image/png";
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data: buffer.toString("base64") },
      };
    }),
  );

  const system = `You are curating a training set for a custom LoRA style model, from a pool of candidate
images numbered 0 to ${args.candidateUrls.length - 1} (in the order shown). Select the best
${targetCount} for training.

Prefer images that are:
- Clean and clear, with no garbled anatomy, malformed hands, or visual artifacts.
- Representative of a single, consistent art style and character/subject across the set —
  discard any outlier that looks like a different style or a different subject entirely.
- Not near-duplicates of another selected image — prefer variety of pose/angle over
  redundancy.

Respond with ONLY a JSON object: {"selectedIndices": number[]} — exactly ${targetCount} distinct
indices (or fewer only if fewer than ${targetCount} candidates are actually usable), 0-indexed
matching the order the images were shown in.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: "Select the best candidates for training." }],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const costUsd =
    (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
    (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;

  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const parsed = JSON.parse(fenceMatch ? fenceMatch[1]! : rawText);
  const result = SelectionSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Echo candidate selection returned an unexpected shape: ${result.error.message}`);
  }

  const validIndices = result.data.selectedIndices.filter((i) => i >= 0 && i < args.candidateUrls.length);
  const uniqueIndices = [...new Set(validIndices)].slice(0, targetCount);
  if (uniqueIndices.length === 0) {
    throw new Error("Echo candidate selection returned no valid indices.");
  }

  return {
    selectedUrls: uniqueIndices.map((i) => args.candidateUrls[i]!),
    costUsd,
  };
}
