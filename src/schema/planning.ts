import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SceneAction, type SceneAction as SceneActionT } from "./scene";
import { AVAILABLE_ICON_NAMES } from "../render/icons/registry";

export interface ScenePlanningResult {
  actions: SceneActionT[];
  tokensUsed: number;
  costUsd: number;
}

// Published Claude Haiku rates, per million tokens — a planning-stage
// estimate for the cost printout, same discipline as the TTS/render cost
// constants elsewhere in this project, not a number pulled from a real bill.
const INPUT_COST_PER_MTOK_USD = 0.8;
const OUTPUT_COST_PER_MTOK_USD = 4.0;

const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const WORDS_PER_SECOND = 2.5; // ~150 wpm, a normal narration pace

// Planner never has real images to reference, so documentReveal and
// fullBleedGraphic are deliberately excluded from what it may choose —
// those stay a pre-authored-only concern.
const PLANNABLE_ACTION_TYPES = [
  "titleCard",
  "bulletList",
  "iconCallout",
  "timeline",
  "comparisonCards",
  "quote",
] as const;

const PlannedActionsSchema = z.array(SceneAction).min(1);

function buildSystemPrompt(estimatedDurationSeconds: number): string {
  return `You are planning the visual timeline for a whiteboard-style narrated video.
Given a narration script, break it into a sequence of SceneAction objects that visually
support the narration as it plays.

Rules:
- Output ONLY a JSON array of SceneAction objects. No prose, no markdown fences, no explanation.
- Each action: {"id": string, "type": string, "atSeconds": number, "durationSeconds": number, ...type-specific fields}
- "type" must be one of exactly: ${PLANNABLE_ACTION_TYPES.join(", ")}
- Never invent a type outside that list, and never use "documentReveal" or "fullBleedGraphic" — no images are available.
- Type-specific required fields:
  - titleCard: "text" (short string)
  - bulletList: "items" (array of short strings)
  - iconCallout: "icon" (must be one of: ${AVAILABLE_ICON_NAMES.join(", ")}) and "text"
  - timeline: "timelineEntries" (array of {"year": number, "label": string})
  - comparisonCards: "comparisonCards" (array of {"title": string, "items": string[]})
  - quote: "text" (and optionally "attribution")
- Actions should cover roughly 0 to ${estimatedDurationSeconds.toFixed(1)} seconds (the estimated
  narration length), with each action's atSeconds + durationSeconds not exceeding that total by much.
- Start with a titleCard summarizing the topic.
- Produce a coherent, watchable sequence — a decent first draft, not exhaustive detail.`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1]! : trimmed;
  return JSON.parse(jsonText);
}

/**
 * Plans a SceneAction[] from a plain narration script via a single LLM
 * call against the fixed component/icon vocabulary. Validates the result
 * against the Zod schema and retries once with the validation errors fed
 * back to the model before giving up — never passes malformed data into
 * the renderer.
 */
export async function planScenesFromScript(
  narrationScript: string,
  opts: { apiKey?: string; model?: string } = {},
): Promise<ScenePlanningResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — required for the narrationScript-only path (Phase 3).");
  }
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const wordCount = narrationScript.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDurationSeconds = Math.max(3, wordCount / WORDS_PER_SECOND);

  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(estimatedDurationSeconds);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Narration script:\n\n${narrationScript}` },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 1536,
      system,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch (err) {
      if (attempt === 0) {
        messages.push({ role: "assistant", content: rawText });
        messages.push({ role: "user", content: `That was not valid JSON (${(err as Error).message}). Return ONLY a valid JSON array of SceneAction objects, no other text.` });
        continue;
      }
      throw new Error(`Scene planner returned invalid JSON after retry: ${(err as Error).message}`);
    }

    const result = PlannedActionsSchema.safeParse(parsed);
    if (result.success) {
      const tokensUsed = totalInputTokens + totalOutputTokens;
      const costUsd =
        (totalInputTokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
        (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;
      return { actions: result.data, tokensUsed, costUsd };
    }

    if (attempt === 0) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      messages.push({ role: "assistant", content: rawText });
      messages.push({
        role: "user",
        content: `That output failed schema validation: ${issues}. Return ONLY a corrected JSON array of SceneAction objects, no other text.`,
      });
      continue;
    }

    throw new Error(
      `Scene planner output failed schema validation after retry: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  // Unreachable — the loop always returns or throws.
  throw new Error("Scene planner failed unexpectedly.");
}
