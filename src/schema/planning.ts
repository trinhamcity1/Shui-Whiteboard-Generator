import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SceneAction, type SceneAction as SceneActionT } from "./scene";
import { AVAILABLE_ICON_NAMES } from "../render/icons/registry";
import { ASSET_MANIFEST, describeManifestEntry } from "../images/assetLibrary/manifest";

export interface ScenePlanningResult {
  actions: SceneActionT[];
  tokensUsed: number;
  costUsd: number;
}

// Approximate Claude Haiku rates, per million tokens — a planning-stage
// estimate for the cost printout, same discipline as the TTS/render cost
// constants elsewhere in this project, not a number pulled from a real
// bill. Check anthropic.com/pricing for Haiku 4.5's exact current rate
// and update these two constants if they've drifted.
const INPUT_COST_PER_MTOK_USD = 0.8;
const OUTPUT_COST_PER_MTOK_USD = 4.0;

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const WORDS_PER_SECOND = 2.5; // ~150 wpm, a normal narration pace

// Phase 4: the planner may now request illustrations too — resolved to a
// real image by the image-generation pipeline step before render, so the
// planner never needs (or is allowed) to invent an imageUrl itself.
// Revision-2 Layer 1: sketchDiagram joins the vocabulary too, for a
// structured multi-tier diagram (rough.js shapes + real text, never
// AI-rendered text).
const PLANNABLE_ACTION_TYPES = [
  "titleCard",
  "bulletList",
  "iconCallout",
  "timeline",
  "comparisonCards",
  "quote",
  "documentReveal",
  "fullBleedGraphic",
  "sketchDiagram",
] as const;

const PlannedActionsSchema = z.array(SceneAction).min(1);

// One line per manifest entry — enough for the planner to pick a sensible
// assetId without needing to see the actual generated image.
function buildAssetCatalog(): string {
  return ASSET_MANIFEST.map((entry) => {
    return `  - "${entry.id}" [${entry.tier}/${entry.role}]: ${describeManifestEntry(entry)}`;
  }).join("\n");
}

function buildSystemPrompt(estimatedDurationSeconds: number): string {
  return `You are planning the visual timeline for a whiteboard-style narrated video.
Given a narration script, break it into a sequence of SceneAction objects that visually
support the narration as it plays.

Rules:
- Output ONLY a JSON array of SceneAction objects. No prose, no markdown fences, no explanation.
- Each action: {"id": string, "type": string, "atSeconds": number, "durationSeconds": number, ...type-specific fields}
- "type" must be one of exactly: ${PLANNABLE_ACTION_TYPES.join(", ")}
- Never invent a type outside that list.
- Type-specific required fields:
  - titleCard: "text" (short string)
  - bulletList: "items" (array of short strings)
  - iconCallout: "icon" (must be one of: ${AVAILABLE_ICON_NAMES.join(", ")}) and "text"
  - timeline: "timelineEntries" (array of {"year": number, "label": string})
  - comparisonCards: "comparisonCards" (array of {"title": string, "items": string[]})
  - quote: "text" (and optionally "attribution")
  - documentReveal / fullBleedGraphic: prefer "assetId" (see the library below) when a matching character
    or prop already exists in the library — it costs nothing and is guaranteed style-consistent. Only fall
    back to "imageConcept" (a short, concrete description of exactly what should be drawn) for something
    genuinely not in the library. NEVER set "imageUrl" yourself — you have no real images, only descriptions
    and asset ids.
  - sketchDiagram: "sketchDiagram" object — {"title": string, "tiers": [{"label": string}, ...],
    "topLabel"?: string, "bottomBanner"?: string, "leftCharacterAssetId"?: string, "rightCharacterAssetId"?: string}.
    Use this for a structured multi-part hierarchy or process the script actually describes (e.g. "federal,
    state, and local government" — a real pyramid, not a metaphor). Tier labels are drawn as real text, always
    correctly spelled — never ask for a diagram with words baked into an imageConcept/assetId illustration.
    leftCharacterAssetId/rightCharacterAssetId — ALWAYS set these when the library has a character
    relevant to the diagram's subject (check the library below first). A diagram about courts or law
    enforcement with a judge or officer available in the library and NOT placed beside it is a mistake,
    not a valid minimal choice — an empty diagram is a worse video than one with its relevant characters
    present.
- Use "fullBleedGraphic" for a strong establishing or closing visual when the script describes something
  concrete and drawable — an object, a place, a process. Use "documentReveal" when the script references an
  actual document, artifact, or figure worth showing prominently. Use "sketchDiagram" specifically when the
  script describes a structured hierarchy, multi-step process, or comparison — never force a diagram where
  a plain illustration or bulletList fits better.
- Use illustrations/diagrams SPARINGLY: 1-3 per video, not every scene. Most of the video should still carry
  its point through bulletList/iconCallout/timeline — reserve visuals for the moments that most benefit from
  one. If nothing in the script is concretely drawable (e.g. an abstract argument), it is correct to use zero
  and rely on the typographic components alone.
- NEVER make the same point twice in two different scenes. Before adding a scene, check whether an earlier
  scene already covers that fact — if a sketchDiagram tier already shows "Constitution," a separate
  iconCallout/bulletList scene restating "the Constitution is the foundation of law" is a redundant scene,
  not two reinforcing ones. Cut it. Every scene must add new information the previous scenes didn't.
- Every sentence or clause in the narration script needs a scene whose ON-SCREEN CONTENT actually matches
  it — not just a scene that happens to be playing at that timestamp. If the script's last sentence is
  about a judge and an officer, the scene covering that timestamp must show the judge and/or officer (via
  assetId or a sketchDiagram character), not an unrelated bullet list. Read the whole script first, map
  every distinct claim to one scene each, THEN assign timestamps — don't assign timestamps first and
  backfill content.
- Budget total scene time to land at or slightly under the narration's estimated length
  (${estimatedDurationSeconds.toFixed(1)}s), never over it. Sum every action's durationSeconds before
  finalizing and trim the least essential scene if the total exceeds the estimate — a video that ends
  with dead scene time after the narration stops, or a scene still running after the narration ends, is
  a failed plan.

Asset library (use "assetId" with one of these exact ids when it fits — do not invent an id that isn't listed):
${buildAssetCatalog()}
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
