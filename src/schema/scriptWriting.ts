import Anthropic from "@anthropic-ai/sdk";
import { WORDS_PER_SECOND } from "./planning";
import { SCRIPTWRITING_METHODOLOGY_RULES } from "./methodology";

export interface ScriptWritingResult {
  narrationScript: string;
  tokensUsed: number;
  costUsd: number;
}

// Same Sonnet rates as planning.ts (same model, same discipline — a
// planning-stage estimate, not a number pulled from a real bill). Kept as
// its own constant pair rather than importing planning.ts's private ones so
// this module can change model/pricing independently later without an
// unrelated diff to the scene planner.
const INPUT_COST_PER_MTOK_USD = 3.0;
const OUTPUT_COST_PER_MTOK_USD = 15.0;

const DEFAULT_MODEL = "claude-sonnet-5";
// Exported so billing/gate.ts's pre-render length/afford estimate uses the
// exact same default this function falls back to — a topic-mode request
// with no explicit targetDurationSeconds still produces a real ~60s video,
// so the billing estimate must not silently treat it as zero-length.
export const DEFAULT_TARGET_DURATION_SECONDS = 60;

// Exported for tests/methodology.test.ts — see planning.ts's matching export
// for why.
export function buildSystemPrompt(targetDurationSeconds: number): string {
  const targetWords = Math.round(targetDurationSeconds * WORDS_PER_SECOND);
  return `You are a scriptwriter for short narrated whiteboard-style explainer videos.
Given a short topic, write a complete narration script a voice actor would read aloud —
the exact words that will be synthesized into audio for the video.

Rules:
- Output ONLY the narration text. No title, no headers, no scene directions, no markdown,
  no stage directions like "[pause]" — just the words to be spoken, as continuous prose.
- Target length: approximately ${targetWords} words (about ${targetDurationSeconds.toFixed(0)} seconds
  of narration at a normal speaking pace). Do not pad to hit the count or cut the topic short to
  stay under it — get as close as the topic honestly supports.
- Write in a clear, engaging, spoken register — sentences meant to be heard, not read: shorter,
  more direct than formal writing, no bullet points or lists (say "first... then... finally"
  instead of enumerating).
- Be concrete and specific. Prefer real, checkable facts and specific details over vague
  generalities. If you are not confident a specific fact is accurate, phrase it more generally
  rather than inventing a precise-sounding but unverified detail.
- Stay strictly on the given topic. Do not wander into a different subject.

${SCRIPTWRITING_METHODOLOGY_RULES}`;
}

/**
 * Expands a short topic into a full narration script the customer never
 * wrote themselves — the "advanced" input tier that sits in front of the
 * existing script-only path (planScenesFromScript). Its output is meant to
 * be handed directly to that same function afterward; this module only
 * writes narration prose, it never decides visuals.
 */
export async function writeScriptFromTopic(
  topic: string,
  opts: { targetDurationSeconds?: number; apiKey?: string; model?: string } = {},
): Promise<ScriptWritingResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — required for the topic-only path.");
  }
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const targetDurationSeconds = opts.targetDurationSeconds ?? DEFAULT_TARGET_DURATION_SECONDS;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: buildSystemPrompt(targetDurationSeconds),
    messages: [{ role: "user", content: `Topic: ${topic}` }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const narrationScript = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  if (!narrationScript) {
    throw new Error("Script writer returned an empty script.");
  }

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  const costUsd =
    (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
    (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;

  return { narrationScript, tokensUsed, costUsd };
}
