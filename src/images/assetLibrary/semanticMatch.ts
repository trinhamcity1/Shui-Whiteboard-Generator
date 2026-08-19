import Anthropic from "@anthropic-ai/sdk";
import type { LibraryAssetRecord } from "../../storage/firestore";

const MODEL = "claude-haiku-4-5-20251001";
const INPUT_COST_PER_MTOK_USD = 0.8;
const OUTPUT_COST_PER_MTOK_USD = 4.0;

export interface SemanticMatchResult {
  matchedAssetId: string | null;
  tokensUsed: number;
  costUsd: number;
}

/**
 * Layer 2 step 1: before generating anything new, check whether an
 * existing library asset already covers this concept closely enough
 * ("grocery store," "corner market," "supermarket downtown" should all
 * resolve to one asset). Without this step the library fills with
 * near-duplicates instead of actually growing reusable coverage — see the
 * revision-2 doc, Layer 2.
 *
 * A cheap single Haiku call, not embeddings/a vector DB — the catalog is
 * small (tens to low hundreds of assets even at scale) and a plain-text
 * classification prompt is simpler infrastructure for that size.
 */
export async function findSemanticMatch(
  concept: string,
  candidates: LibraryAssetRecord[],
  opts: { apiKey?: string; model?: string } = {},
): Promise<SemanticMatchResult> {
  if (candidates.length === 0) {
    return { matchedAssetId: null, tokensUsed: 0, costUsd: 0 };
  }

  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — required for Layer 2 semantic match.");

  const catalog = candidates.map((c) => `  - "${c.id}": ${c.description}`).join("\n");
  const system = `You match a requested illustration concept against an existing asset library, to avoid
generating a near-duplicate. Given a concept and a catalog of existing assets (id + description),
decide whether ANY existing asset already depicts essentially the same subject — the same
identifiable object/character/place, allowing for wording differences ("grocery store" ==
"corner market" == "supermarket"). A DIFFERENT specific subject (e.g. "a courthouse" vs
"a school building") is NOT a match even if both are "a building."

Respond with ONLY a JSON object: {"matchedAssetId": string | null}. Use null if nothing in the
catalog is really the same subject — a near-duplicate must actually be reusable, a plausible-ish
guess is not good enough.`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: 200,
    system,
    messages: [
      {
        role: "user",
        content: `Concept: "${concept}"\n\nExisting asset catalog:\n${catalog}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  const costUsd =
    (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
    (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;

  let matchedAssetId: string | null = null;
  try {
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenceMatch ? fenceMatch[1]! : rawText) as { matchedAssetId: string | null };
    matchedAssetId = parsed.matchedAssetId ?? null;
  } catch {
    matchedAssetId = null; // Malformed response — fail open to "no match" (generate fresh) rather than block the render.
  }

  // Guard against a hallucinated id that isn't actually in the catalog.
  if (matchedAssetId && !candidates.some((c) => c.id === matchedAssetId)) {
    matchedAssetId = null;
  }

  return { matchedAssetId, tokensUsed, costUsd };
}
