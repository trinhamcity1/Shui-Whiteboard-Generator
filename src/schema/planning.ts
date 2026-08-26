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

// Approximate Claude Sonnet rates, per million tokens — a planning-stage
// estimate for the cost printout, same discipline as the TTS/render cost
// constants elsewhere in this project, not a number pulled from a real
// bill. Check anthropic.com/pricing for the exact current rate and update
// these two constants if they've drifted. Upgraded from Haiku 4.5 after
// real test renders caught it hallucinating an assetId outside the given
// catalog twice — Sonnet's stronger instruction-following is worth the
// small absolute cost increase (planning is a small slice of total
// per-video cost).
const INPUT_COST_PER_MTOK_USD = 3.0;
const OUTPUT_COST_PER_MTOK_USD = 15.0;

const DEFAULT_MODEL = "claude-sonnet-5";
// Exported so timing.ts's realignSceneTiming can map a scene's atSeconds
// back to the same word index the planner implicitly used when it chose
// that timestamp — the two need to agree on the same rate or the mapping
// is meaningless.
export const WORDS_PER_SECOND = 2.5; // ~150 wpm, a normal narration pace

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
  "composition",
] as const;

const PlannedActionsSchema = z.array(SceneAction).min(1);

const KNOWN_ASSET_IDS = new Set(ASSET_MANIFEST.map((entry) => entry.id));

/** Every assetId the model can reference across an action, including
 * sketchDiagram characters/insets and composition slots — same shape
 * resolveImages.ts's collectAssetIdTargets walks, just against the raw
 * planned output instead of a resolved SceneDocument. */
function collectReferencedAssetIds(actions: SceneActionT[]): string[] {
  const ids: string[] = [];
  for (const action of actions) {
    if (action.assetId) ids.push(action.assetId);
    const diagram = action.sketchDiagram;
    if (diagram) {
      if (diagram.leftCharacterAssetId) ids.push(diagram.leftCharacterAssetId);
      if (diagram.rightCharacterAssetId) ids.push(diagram.rightCharacterAssetId);
      for (const tier of diagram.tiers) {
        if (tier.insetAssetId) ids.push(tier.insetAssetId);
      }
    }
    const composition = action.composition;
    if (composition) {
      for (const slot of Object.values(composition.slots)) {
        if (slot.assetId) ids.push(slot.assetId);
      }
    }
  }
  return ids;
}

const CONNECTOR_DECORATION_KINDS = new Set(["arrowCurved", "arrowStraight", "arrowJagged", "arrowDashed"]);

/** Belt-and-suspenders backstop for the prompt's own instruction below: a
 * sketchDiagram already draws its own connecting arrows between tiers/steps
 * as part of the diagram itself, using exact box coordinates this
 * function's caller has no way to predict. A real render showed the model
 * ignore that instruction and add a decorative connector arrow anyway,
 * landing in whatever empty canvas the diagram didn't use — pointing at
 * nothing. Rather than trust prompt compliance alone, any connector-kind
 * decoration on a sketchDiagram action is dropped here regardless of what
 * the model returned. */
function stripUngroundedSketchDiagramConnectors(actions: SceneActionT[]): SceneActionT[] {
  return actions.map((action) => {
    if (action.type !== "sketchDiagram" || !action.decorations?.length) return action;
    const filtered = action.decorations.filter((d) => !CONNECTOR_DECORATION_KINDS.has(d.kind));
    if (filtered.length === action.decorations.length) return action;
    return { ...action, decorations: filtered };
  });
}

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
- Each action: {"id": string, "type": string, "atSeconds": number, "durationSeconds": number, "coversText": string, ...type-specific fields}
- "type" must be one of exactly: ${PLANNABLE_ACTION_TYPES.join(", ")}
- Never invent a type outside that list.
- "coversText" is REQUIRED on every action: the exact span of the narration script this action
  illustrates, copied VERBATIM — same words, same punctuation, same capitalization, character-for-
  character from the script below. Do not paraphrase, summarize, or fix anything about it. This is
  never shown on screen; it's the only thing that lets the real synthesized narration audio (whose
  actual pacing you cannot know yet) get matched to this action after the fact — "atSeconds" and
  "durationSeconds" are only your own rough estimate and will be corrected against coversText once
  real audio exists. Every action's coversText must be a later, non-overlapping span than the
  previous action's — cover the script in order, start to end, with no action's span jumping
  backward or repeating an earlier action's words.
- Type-specific required fields:
  - titleCard: "text" (short string)
  - bulletList: "items" (array of short strings)
  - iconCallout: "icon" (must be one of: ${AVAILABLE_ICON_NAMES.join(", ")}) and "text". Before reaching for
    this, check whether a narrator character reacting fits instead (narrator-celebrating for encouragement,
    narrator-thinking for a tip or "here's the trick," narrator-confident for reassurance, narrator-pointing
    for "here's what matters") — use a "composition" action with templateId "hero-backdrop", that
    character's assetId in the "character" slot (leave "backdrop" unset — it's optional), and the line
    itself in the "caption" slot, rather than using iconCallout. Do NOT put a bare character assetId
    directly on a plain fullBleedGraphic action — these character images are narrow cropped cutouts (one is
    barely a third as wide as it is tall), and fullBleedGraphic fills the ENTIRE frame edge-to-edge, which
    for a cutout this narrow means blowing it up far past its real size and cropping off the top of the
    figure (a real render lost the character's head this way). hero-backdrop's character slot already sizes
    and grounds a cutout correctly. A meta/instructional beat with no concrete object to draw (encouragement,
    test-taking advice, "any of these works") almost always still has a person reacting to draw, which reads
    as part of the same illustrated film instead of a different, flatter kind of scene. Reserve iconCallout
    itself for
    the rare beat where even a reacting character is a stretch.
  - timeline: "timelineEntries" (array of {"year": number, "label": string})
  - comparisonCards: "comparisonCards" (array of {"title": string, "items": string[]})
  - quote: "text" (and optionally "attribution")
  - documentReveal / fullBleedGraphic: prefer "assetId" (see the library below) when a matching character
    or prop already exists in the library — it costs nothing and is guaranteed style-consistent. Only fall
    back to "imageConcept" (a short, concrete description of exactly what should be drawn) for something
    genuinely not in the library. NEVER set "imageUrl" yourself — you have no real images, only descriptions
    and asset ids.
  - sketchDiagram: "sketchDiagram" object — {"diagramType": "pyramid" | "flowchart" | "comparison",
    "title": string, "tiers": [{"label": string, "insetAssetId"?: string}, ...], "topLabel"?: string,
    "bottomBanner"?: string, "leftCharacterAssetId"?: string, "rightCharacterAssetId"?: string,
    "isCyclical"?: boolean}.
    insetAssetId (pyramid mode only) places a small icon-scale library asset inside that tier next to its
    label, when one from the library fits — "diagram shapes carry embedded content," a small icon inside
    the tier reads as more composed than a bare colored band. Optional; only set it when a real matching
    icon-scale asset exists in the library below. Tier labels are drawn as real
    text, always correctly spelled — never ask for a diagram with words baked into an
    imageConcept/assetId illustration. Keep each tier/step label SHORT (a few words, not a full clause
    with its own explanation) — it has to fit inside a drawn shape, not read like a sentence.
    - "pyramid": a real hierarchy or ranking only — e.g. "federal, state, and local government" (each
      tier is genuinely subordinate to the one above it). Do NOT use pyramid for a sequence, process, or
      cycle — that visually claims a ranking the content doesn't have.
    - "flowchart": a sequence, process, or cycle — steps happen in order (e.g. "evaporation →
      condensation → precipitation → collection"). Tiers become connected boxes in order. Set
      "isCyclical": true ONLY when the script explicitly describes the last step leading back into the
      first, making it a genuine repeating loop (e.g. the water cycle) — this draws a curved return arrow
      from the last box back to the first. Leave it false/omitted for a plain one-shot sequence or a list
      of parallel examples that merely happen to use box shapes (e.g. three unrelated ways the mind can
      wander) — those are NOT cycles, and drawing a loop arrow onto them is wrong even though they use
      "flowchart". When in doubt, default to false.
    - "comparison": exactly two tiers, side by side — for "X vs Y" content.
    leftCharacterAssetId/rightCharacterAssetId — ALWAYS set leftCharacterAssetId (and
    rightCharacterAssetId for a "pyramid" diagram specifically — flowchart/comparison only render the
    left character) when the library has a character relevant to the diagram's subject (check the
    library below first). A diagram about courts or law enforcement with a judge or officer available in
    the library and NOT placed beside it is a mistake, not a valid minimal choice — an empty diagram is a
    worse video than one with its relevant characters present.
  - composition: "composition" object — {"templateId": one of the eight below, "title"?: string,
    "dividerStyle"?: "vs"|"torn" (comparison-2box only), "slots": {"<slotName>": {"assetId"?: string,
    "imageConcept"?: string, "label"?: string, "revealAtSeconds"?: number, "attachTo"?: string}}}. A
    template is a fixed, pre-designed layout — you select a templateId and fill its declared slots, you
    never invent your own layout or slot names. revealAtSeconds is an OFFSET from this scene's own start
    (not absolute video time) — set it on a later slot (e.g. 1.5, 2.5) so that slot appears only once the
    narration has moved on to describing it, instead of every slot appearing at once on frame one.
    TWO RULES THAT ARE EASY TO MISS: (1) "templateId" is REQUIRED on every composition object — never
    write a "composition" without it. (2) EVERY slot value is an object, even a caption-only slot with
    nothing but a label — WRONG: "caption": "some text". RIGHT: "caption": {"label": "some text"}.
    - "hero-backdrop" slots: backdrop (assetId/imageConcept — a scene-setting illustration), character
      (assetId — a person relevant to the scene), caption (label — a short callout line). Use for one
      strong establishing/closing visual with a character reacting to it. If the backdrop asset is a
      building/structure with a known front-steps anchor (check the library below — an asset with
      "attachment" anchor data), set character's "attachTo": "backdrop" instead of relying on the
      default fixed position — the character then stands AT that anchor (e.g. on the steps) rather than
      floating in a neighboring box. Only set attachTo when the backdrop asset actually has an
      attachment anchor; otherwise omit it.
    - "pyramid-flanked" slots: tier1, tier2, tier3, ... (label each — SHORT phrases, this is the same
      shape as a "pyramid" sketchDiagram; assetId optional per tier — a small inset icon inside that
      tier), leftCharacter/rightCharacter (assetId), topLabel (label — a banner above the pyramid, e.g.
      "CONSTITUTION"), bottomBanner (label — a footer banner, e.g. a country/organization name). This is
      really just an alternate way to build a flanked pyramid with banners/insets — prefer the plain
      "sketchDiagram" action type (which also supports topLabel/bottomBanner/tier insetAssetId) when you
      don't need it inside a bigger multi-slot composition.
    - "storyboard-4panel" slots: panel1, panel2, panel3, panel4 (assetId/imageConcept + label each, 2-4
      of them, not all 4 required). Use for a multi-step story or example that isn't a clean
      process/cycle (use sketchDiagram flowchart for an actual process instead) — e.g. illustrating three
      different everyday examples of the same idea.
    - "comparison-2box" slots: left, right (assetId/imageConcept + label each). Use for "X vs Y" when
      each side needs an actual illustration, not just text — the existing "comparisonCards" action
      stays the right choice when text alone is enough. dividerStyle "vs" (default) shows a neutral VS
      badge between the two; "torn" replaces it with a jagged torn-paper seam — use "torn" only when the
      comparison itself is a rupture/before-after (e.g. "Collapse | Transformation"), not a neutral
      face-off.
    - "narrative-3-zone" slots: zone1, zone2, zone3 (assetId/imageConcept + label each, all 3 required).
      A strict 3-beat narrative read top-to-bottom with a connecting arrow between each — use for a
      cause -> event -> consequence/decision structure (e.g. "a law is challenged -> the court reviews
      it -> the court's ruling"). Do not use for anything that isn't genuinely 3 sequential beats.
    - "central-focal" slots: central (assetId/imageConcept — the one dominant subject), reactor1..4
      (assetId/imageConcept — smaller figures reacting to it, 1-4 of them, not all 4 required), caption
      (label). Use for one big event/object with several characters visibly reacting around it — not for
      an establishing shot (use hero-backdrop) or a neutral illustration (use a plain image action).
    - "confrontation-mirror" slots: left, right (assetId/imageConcept), caption (label). Use for two
      opposing groups/forces facing off symmetrically (a standoff, tension, "vs" as conflict rather than
      comparison) — visually similar to comparison-2box but with no VS badge and a starker, more dramatic
      read; don't use this for a neutral side-by-side comparison, that's comparison-2box's job.
    - "group-lineup" slots: person1, person2, ... (assetId/imageConcept each, as many as make sense — 3
      to a dozen-plus), caption (label). Use for "a crowd" or "everyone who plays a role" framings (e.g.
      naming several officials/rulers/participants at once) — not for 2-4 individually-important figures
      (use storyboard-4panel or comparison-2box instead, where each gets more visual weight).
    Use composition SPARINGLY, same discipline as sketchDiagram/illustrations generally — most scenes
    should still be plain typographic components.
- "decorations": an OPTIONAL array on any action (top-level or inside a composition slot) —
  {"kind": one of the kinds below, "x", "y" (position; for arrows also "toX"/"toY"), "width"/"height"/"size"
  (shape-specific), "color"?, "fill"?, "revealAtSeconds"?}. Coordinates are absolute pixels on the canvas
  (1080×1920 for vertical orientation, 1920×1080 for horizontal) — place decorations where they make sense
  next to the action's own content. Decoration kinds:
  - Connectors (need x/y/toX/toY): "arrowCurved" (the default connective arrow — cause to effect, or
    guiding the eye from one element to the next), "arrowStraight" (a plain annotation line),
    "arrowJagged" (a red trend/urgency arrow), "arrowDashed" (implies motion, not a hard connection).
  - Emphasis marks (need x/y, optional size/color): "xMark" (negation ONLY — "this is wrong/forbidden",
    never decorative), "checkmark" (correctness/completion), "radiatingStrokes" (draws attention to a
    point), "circledScribble" (a loose highlight ring around something), "underlineSwash" (needs "width" —
    underline a specific word/phrase), "sparkle" (small accent, use sparingly, 1-2 max), "motionDashes"
    (trailing dashes implying movement).
  - Containers (need x/y/width/height): "bannerRibbon" (title device), "scroll" (a document/artifact,
    optional "hasSeal" for an official one), "thoughtBubble", "speechBubble", "wobbleFrame" (a plain
    grouping box), "tornPaperEdge" (a "broken/ended" beat).
  - Environmental (need x/y/width): "groundTufts", "bushes" (both make a character/prop look grounded on
    the board), "shadowEllipse" (place directly under a character/prop's feet).
  Use decorations to add the connective/energetic layer real whiteboard videos have — an arrow guiding the
  eye between two things you just placed, an X over something wrong, a checkmark after something right — but
  keep it to 3-6 decorations per scene, never a wall of doodles. A decoration with no clear communicative
  purpose (arrows must guide reading order; xMark only for negation; sparkles are rare accents, not filler)
  should not be added at all.
  CRITICAL for any connector ("arrowCurved"/"arrowStraight"/"arrowJagged"/"arrowDashed"): you do not know
  this scene's exact rendered layout, only its rough intent — a coordinate you invent has a real chance of
  landing in empty canvas next to nothing. A real render showed exactly this failure: a decorative arrow
  placed from y:700 to y:1100 on a scene whose actual content occupied only the top few hundred pixels,
  reading as an arrow pointing at nothing in a sea of blank paper. Two rules fix this: (1) NEVER add a
  connector decoration to a "sketchDiagram" action — it already draws its own connecting arrows between
  tiers/steps as part of the diagram itself, and a second, independently-coordinated arrow on top of it
  cannot know where those tiers actually are. (2) On any other action, only add a connector between two
  elements you are highly confident both occupy known screen regions (e.g., a caption's fixed bottom band, a
  composition slot's documented fixed box) — when in doubt, leave the connector out entirely rather than
  guess coordinates.
- Use "fullBleedGraphic" for a strong establishing or closing visual when the script describes something
  concrete and drawable — an object, a place, a process. "fullBleedGraphic" also takes an optional
  "attribution" (a short caption burned over the image, e.g. "THE CONSTITUTION") — set it whenever a label
  helps the viewer follow along without relying on audio alone, same idea as a diagram's tier label. Use
  "documentReveal" when the script references an actual document, artifact, or figure worth showing
  prominently ("attribution" there is its caption too). Use "sketchDiagram" specifically when the script
  describes a structured hierarchy, multi-step process, or comparison. Use "composition" (hero-backdrop,
  central-focal, etc.) for a scene, a group, or a character interacting with something — see the template
  catalog above.
- DEFAULT TO AN IMAGE, not a bullet list. This is the single most important rule in this prompt: for every
  distinct claim or beat in the script, ask "can this be drawn?" first, and if the answer is yes — a person,
  an object, a place, an action, a document, a comparison, a hierarchy, a group of people — it MUST get an
  illustrated action (assetId/imageConcept via fullBleedGraphic/documentReveal/composition, or a
  sketchDiagram), not bulletList/iconCallout/timeline. Reserve the plain typographic components for content
  that genuinely isn't a concrete image — a list of many short parallel facts with nothing to draw, a direct
  quotation, a numeric year-by-year timeline. A script that describes concrete things (people, places,
  objects, actions, comparisons) and gets mostly bulletList scenes is a WRONG plan, not a safe minimal one —
  the video should read like an illustrated book, one picture per point, not a slideshow of text with
  occasional decoration. Do not artificially cap how many illustrated scenes a video has — if every beat in
  the script is concretely drawable, illustrate every one of them.
- "imageConcept" is a full creative brief, not just a last-resort filler — write it as a real, specific
  description (subject, setting, action, mood) the way you'd brief an illustrator, the same level of detail
  as the library's own asset descriptions below. It renders through the project's own trained illustration
  style (the same "art" the library assets are made of), so treat it as real illustration, not a placeholder
  — a generic one-word concept like "courtroom" produces a generic result; "a judge's gavel striking down
  mid-air above a torn law page" produces something worth watching. Prefer "assetId" over "imageConcept"
  ONLY when an existing library asset is a genuinely good match for this exact moment — never force a loose
  asset match just to avoid a live-generation cost; a purpose-built imageConcept that actually matches the
  narration beats a reused asset that only sort of fits.
- NEVER describe lighting, glow, or color in warm terms (golden/amber/yellow/orange light, a "warm glow",
  sunset tones, etc.) in an imageConcept — this product's palette is deliberately cool (blues, teals, cool
  grays), a direct shareholder correction after real renders kept coming back yellow-toned specifically
  BECAUSE the concept text itself asked for warm light, overriding the illustration style's own cool-palette
  instruction. If a concept needs a light/glow effect at all, describe it as cool-white, pale blue, or simply
  "a soft glow" with no color named — never gold, amber, or yellow.
- CHARACTER OUTFIT AND SETTING MUST MATCH THE SCRIPT'S ERA. The asset library below is built entirely
  around modern civics content — a narrator in a modern collared shirt, judges in modern black robes,
  police officers in modern uniforms. That library is a WRONG match for anything set in a different time,
  place, or culture (ancient history, mythology, another country's traditional dress, etc.) — reusing a
  modern-civics assetId there is not "close enough," it's a visible anachronism (a Bronze Age Greek sailor
  drawn in a modern collared shirt). When the script's setting doesn't match what the library actually
  depicts, use "imageConcept" instead and write the character's actual period-accurate attire and
  appearance into the brief explicitly — e.g. for ancient Greece: "wearing a simple wool chiton, leather
  sandals, no modern clothing," not just "a sailor." Get the history right before you get the drawing right.
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
      // 1536, then 4096, then 8192 all proved too tight and crashed real
      // renders mid-JSON — the "illustrate every drawable beat" density
      // rule, the longer imageConcept cap (now 600 chars), Sonnet's
      // generally chattier structured output, and now adaptive thinking's
      // own token spend (billed as output tokens, sharing this same cap)
      // all push a real ~90s plan well past a moderate ceiling. Generous
      // headroom, not a tuned number — this is a cap, not a cost driver.
      max_tokens: 16000,
      // Scene planning is exactly the kind of task adaptive thinking is
      // for — juggling timing, template choice, character continuity, and
      // full narration coverage all at once, then producing one internally
      // consistent JSON plan. On Sonnet 5 this is the only "on" mode
      // (budget_tokens is removed/400); temperature/top_p/top_k must stay
      // unset — they 400 once thinking is active. effort is the real
      // depth knob; "high" trades a bit more cost/latency for the kind of
      // multi-constraint reasoning this task actually needs.
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";
    if (process.env.DEBUG_PLANNING_RAW) console.error("[DEBUG_PLANNING_RAW]\n" + rawText + "\n");

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
      // The model sometimes references a plausible-sounding assetId that
      // isn't actually in the catalog it was given (a hallucination, not a
      // schema error — Zod can't catch it since any string is a valid
      // assetId shape). Caught here and fed back the same way a schema
      // error is, instead of failing the whole render at image-resolution
      // time with no chance to self-correct.
      const invalidIds = [...new Set(collectReferencedAssetIds(result.data))].filter((id) => !KNOWN_ASSET_IDS.has(id));
      if (invalidIds.length === 0) {
        const tokensUsed = totalInputTokens + totalOutputTokens;
        const costUsd =
          (totalInputTokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
          (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;
        return { actions: stripUngroundedSketchDiagramConnectors(result.data), tokensUsed, costUsd };
      }

      if (attempt === 0) {
        messages.push({ role: "assistant", content: rawText });
        messages.push({
          role: "user",
          content: `These assetId values do not exist in the catalog you were given: ${invalidIds.join(", ")}. Use only exact ids from the asset library list, or switch that action/slot to "imageConcept" instead. Return ONLY a corrected JSON array of SceneAction objects, no other text.`,
        });
        continue;
      }

      throw new Error(`Scene planner referenced assetId(s) not in the catalog after retry: ${invalidIds.join(", ")}`);
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
