import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  AdBeat,
  AdTemplateId,
  AdVisualStyle,
  AD_DURATION_TIERS,
  type AdRequest,
  type AdBeat as AdBeatT,
  type AdTemplateId as AdTemplateIdT,
  type AdVisualStyle as AdVisualStyleT,
} from "./ad";

export interface AdPlanningResult {
  templateId: AdTemplateIdT;
  visualStyle: AdVisualStyleT;
  durationSeconds: number;
  targetAudience: string;
  suggestedAudiences?: string[];
  beats: AdBeatT[];
  tokensUsed: number;
  costUsd: number;
}

// Same rates as scene planning (planning.ts) — one model, one rate table.
const INPUT_COST_PER_MTOK_USD = 3.0;
const OUTPUT_COST_PER_MTOK_USD = 15.0;
const DEFAULT_MODEL = "claude-sonnet-5";

const TEMPLATE_CATALOG = `
- "problem-solution": broad-appeal product solving a clear daily annoyance. Hook = the pain, then reveal the product as the fix.
- "before-after": beauty, fitness, home — visually transformative results.
- "demo-how-it-works": novel or technical product needing explanation (apps, gadgets, tools).
- "testimonial": higher-consideration purchases, services, trust-sensitive categories.
- "unboxing": physical product launches, novelty/gift appeal.
- "founder-story": mission-driven brands, nonprofits, small/local business authenticity.
- "listicle": feature-rich products, comparison-shopping audience — hook then 3 quick benefit beats.
- "promo-urgency": ANY business with an active promotion set — this template outranks the others whenever a promotion exists, because the offer itself is the strongest hook available.
- "day-in-the-life": lifestyle/brand-affinity building, younger/broad audience, low sales pressure.
- "pov-skit": humor-forward brands, Gen Z-leaning audience — a relatable scenario with a twist, product as the punchline's resolution.
`.trim();

function buildSystemPrompt(request: AdRequest): string {
  const tierRubric = AD_DURATION_TIERS.map((t) => `  - up to ${t.max}s: ${t.label}`).join("\n");
  return `You write short conversion-oriented ad videos for businesses, following two real advertising frameworks:

GOOGLE'S ABCD FRAMEWORK — every beat must be tagged with the job it does:
- Attention: earn attention in the first few seconds — an unexpected visual, a direct question, a bold statement. The viewer must watch past the skip point.
- Branding: show the brand/business early — this does not hurt performance, brands appearing early get stronger recall than brands only at the close, but it must feel natural, not forced.
- Connection: humor improves receptivity more than any other creative element; storytelling that builds tension and releases it drives stronger emotional engagement than a plain feature list.
- Direction: the CTA must be specific and single-threaded — "Start your free trial" beats "Learn more"; "See how [X] saved 40%" beats "Visit our site."

META'S CREATIVE PRINCIPLES:
- Open on the problem/desire, not the brand.
- The product/cause is the hero, not the business's logo.
- Keep it tight — 15 seconds is a common ceiling for feed/Stories; don't pad.
- The core message must land in the first 3 seconds even with sound off, though most short-form video today is watched sound-on.
- Low-friction, single, obvious CTA.
- Prefer an authentic, specific voice over a polished corporate one.

TEMPLATE CATALOG — pick exactly one, never invent a new structure:
${TEMPLATE_CATALOG}

VISUAL STYLE — pick exactly one for the WHOLE ad (a beat cannot mix styles):
- "photo-real": a Ken Burns push/pull on the business's own real, uncropped uploaded photo(s), with word-highlight
  captions. Best for anything that reads better as authentic/POV/lifestyle — action cameras, apparel worn in real
  settings, services, anything where "this is a real photo of the real thing" IS the credibility.
- "kinetic-hero": a glossy commercial motion-graphics look — a solid/gradient color background, the product shown
  as a clean floating/rotating hero cutout (background removed), small decorative props drifting around it, and
  big bold kinetic title typography. Best for packaged goods, drinks, cosmetics, anything that reads well as a
  single hero object on a clean background rather than an in-context photo — think a glossy e-commerce product
  spot, not a documentary.
  COLOR for this style: default to bright, highly saturated, eye-catching gradient colors — this style exists to
  look stunning and scroll-stopping, not corporate-safe. A muted/desaturated/dark palette is a deliberate choice
  for a genuinely premium/luxury/moody brand, not the default fallback for "a gadget" or "I'm not sure what fits."
  When in doubt, go bolder and more saturated, not calmer.
${request.visualStyle ? `The business specified "${request.visualStyle}" — use it.` : "The business did not specify one — pick whichever fits the product better, using the guidance above."}

DURATION — the business gave: ${request.durationSeconds === "auto" ? "no preference, decide for them using this rubric" : `an explicit ${request.durationSeconds}s`}.
${tierRubric}

TARGET AUDIENCE — the business gave: ${request.targetAudience ?? "no target audience, infer the best one from the product/business description and also propose 1-2 alternates"}.

Output ONLY a JSON object, no prose, no markdown fences:
{
  "templateId": one of the template ids above,
  "visualStyle": "photo-real" | "kinetic-hero",
  "durationSeconds": number,
  "targetAudience": string,
  "suggestedAudiences": string[] (ONLY include this key if the business did not give a target audience),
  "beats": [
    {
      "id": string,
      "role": "attention" | "branding" | "connection" | "direction",
      "atSeconds": number, "durationSeconds": number,
      "text": string (optional — spoken narration for this beat, concatenated in order across beats to form the full script),
      "photoRef": { "imageIndex": number, "focalPoint": {"x":0-1,"y":0-1}, "zoomFrom": number, "zoomTo": number }
        (optional — ONLY when visualStyle is "photo-real"),
      "kineticHero": { "productImageIndex": number, "backgroundColorFrom": string (hex), "backgroundColorTo": string (hex),
        "title": string (a SHORT, bold headline — 1-4 words, e.g. "FRESH ORANGE" — this is a graphic design
        element, not a caption), "props": [ { "kind": one of the prop kinds below, "startX": 0-1, "startY": 0-1,
        "driftAngleDeg": number, "driftDistancePx": number, "sizePx": number, "delaySeconds": number,
        "rotateSpeedDegPerSec": number (0 for a still prop, nonzero to make it tumble while it drifts — use this
        for extra energy, not every prop needs it) }, ... up to 24 props ] } (optional — ONLY when visualStyle is
        "kinetic-hero"),
      "promoBadge": { "code": string, "description": string, "expiresAt": string } (optional — only on a promo/direction beat, only if a promotion was actually given),
      "ctaLabel": string (optional — a specific single-threaded CTA, e.g. "Order now", not "Learn more"),
      "ctaUrl": string (optional),
      "captionStyle": "word-highlight" | "sentence" | "none" (default word-highlight)
    }
  ]
}

KINETIC PROP KINDS (pick whichever actually fit the product's category — never force fruit/ice onto a product
they don't suit. Don't hold back on quantity: a sparse 2-3-prop beat reads as cheap and unfinished next to a real
commercial spot. Use your own judgment on density per beat — an "attention" or "branding" beat usually earns the
busiest treatment (this is the moment to impress), while a "direction"/CTA beat can be calmer so the CTA itself
stays legible. Vary size/startX/startY/driftAngleDeg/rotateSpeedDegPerSec per prop so a denser field still reads
as intentional, not overlapping clutter — that variation is what separates "busy and premium" from "busy and
messy." If you judge a beat genuinely calls for more visual richness than this vocabulary covers on its own
(a second smaller title line, an extra burst of the same prop kind timed slightly later, more props layered at
different depths via size/delay), do it — you have real creative latitude here, this is not a strict minimum
checklist to satisfy):
- "citrus-slice", "droplet", "bubble": drinks, food, skincare with a "fresh/hydrating" angle.
- "ice-cube": cold drinks specifically.
- "leaf", "petal": natural/organic/wellness products.
- "sparkle", "star-burst": beauty, jewelry, anything "shiny/premium."
- "wisp": steam/motion/energy — coffee, tech, anything implying speed or warmth.
- "flame": energy drinks, spicy food, anything "intense."
A gadget/hardware product (a camera, a tool) fits kinetic-hero fine too — lean on "sparkle"/"star-burst"/"wisp"
(implying a lens flare/motion-trail) rather than forcing food-coded props onto it.

Rules:
- Every beat's atSeconds + durationSeconds must sum to at most the plan's own durationSeconds.
- At least one beat must have role "attention" and be the FIRST beat (atSeconds: 0).
- At least one beat must have role "direction" and carry a ctaLabel or promoBadge.
- A beat can carry "photoRef" OR "kineticHero", never both — and only the one matching the plan's own visualStyle.
- Only use "promoBadge" if the business actually gave a promotion (see below) — never invent a discount.
- Only set "ctaUrl" if a real website URL was actually given below (see "Website URL") — never invent one, and never
  guess a plausible-looking product page. If none was given, omit "ctaUrl" entirely; the ctaLabel alone (e.g. "Shop
  now") is still a complete, valid direction beat without a link attached.
- Only reference "imageIndex"/"productImageIndex" values that exist in the ${request.productImages.length} image(s) actually given.
${request.productImages.length > 1 ? `- ${request.productImages.length} product images were given — actually use more than one of them across the beats (different angles/configurations read as a real, considered product shoot, not the same single photo recycled through every beat). Only reuse the same index across beats when the images are genuinely near-duplicates and there's no better fit for a given beat.` : ""}
- Do not add narration text to every beat — a beat can be pure visual (photoRef/kineticHero only) or pure CTA (ctaLabel only) with no spoken line.

Business: ${request.businessName} (${request.businessType})
Product/service: ${request.productDescription}
Platform: ${request.platform}
${request.promotion ? `Current promotion: ${request.promotion.description}${request.promotion.code ? ` (code: ${request.promotion.code})` : ""}${request.promotion.expiresAt ? `, expires ${request.promotion.expiresAt}` : ""}` : "No current promotion."}
Website URL: ${request.websiteUrl ?? "none given — do not set ctaUrl on any beat"}
Product images provided: ${request.productImages.map((img, i) => `[${i}] ${img.label ?? "unlabeled"}`).join(", ")}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1]! : trimmed;
  return JSON.parse(jsonText);
}

const PlannedAdSchema = z.object({
  templateId: AdTemplateId,
  visualStyle: AdVisualStyle,
  durationSeconds: z.number().positive(),
  targetAudience: z.string(),
  suggestedAudiences: z.array(z.string()).optional(),
  beats: z.array(AdBeat).min(1),
});

/**
 * Plans an ad's template/duration/audience/beats from the business's own
 * request via a single Sonnet call, using adaptive thinking — creative
 * template selection, duration-tier judgment, and ABCD-role assignment are
 * exactly the multi-constraint reasoning adaptive thinking is for, and
 * unlike the explainer pipeline, this mode has no image-generation cost to
 * offset, so spending on the planning call's quality here is cheap in
 * absolute terms. Validates + retries once, same discipline as
 * planScenesFromScript.
 */
export async function planAdFromRequest(
  request: AdRequest,
  opts: { apiKey?: string; model?: string } = {},
): Promise<AdPlanningResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — required for ad planning.");
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(request);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "Plan the ad now, following the rules exactly." },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
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
        messages.push({ role: "user", content: `That was not valid JSON (${(err as Error).message}). Return ONLY the JSON object, no other text.` });
        continue;
      }
      throw new Error(`Ad planner returned invalid JSON after retry: ${(err as Error).message}`);
    }

    const result = PlannedAdSchema.safeParse(parsed);
    if (result.success) {
      const referencedIndexes = result.data.beats.flatMap((b) => [b.photoRef?.imageIndex, b.kineticHero?.productImageIndex]);
      const invalidIndexes = referencedIndexes.filter((i): i is number => i !== undefined && (i < 0 || i >= request.productImages.length));
      if (invalidIndexes.length === 0) {
        const tokensUsed = totalInputTokens + totalOutputTokens;
        const costUsd =
          (totalInputTokens / 1_000_000) * INPUT_COST_PER_MTOK_USD + (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;
        return { ...result.data, tokensUsed, costUsd };
      }
      if (attempt === 0) {
        messages.push({ role: "assistant", content: rawText });
        messages.push({
          role: "user",
          content: `These photoRef/kineticHero image index values are out of range (only 0-${request.productImages.length - 1} exist): ${invalidIndexes.join(", ")}. Return a corrected JSON object, no other text.`,
        });
        continue;
      }
      throw new Error(`Ad planner referenced out-of-range image index after retry: ${invalidIndexes.join(", ")}`);
    }

    if (attempt === 0) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      messages.push({ role: "assistant", content: rawText });
      messages.push({ role: "user", content: `That output failed schema validation: ${issues}. Return ONLY a corrected JSON object, no other text.` });
      continue;
    }

    throw new Error(
      `Ad planner output failed schema validation after retry: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  throw new Error("Ad planner failed unexpectedly.");
}
