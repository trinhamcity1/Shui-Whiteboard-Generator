import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AdBeat, AdTemplateId, AD_DURATION_TIERS, type AdRequest, type AdBeat as AdBeatT, type AdTemplateId as AdTemplateIdT } from "./ad";

export interface AdPlanningResult {
  templateId: AdTemplateIdT;
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

DURATION — the business gave: ${request.durationSeconds === "auto" ? "no preference, decide for them using this rubric" : `an explicit ${request.durationSeconds}s`}.
${tierRubric}

TARGET AUDIENCE — the business gave: ${request.targetAudience ?? "no target audience, infer the best one from the product/business description and also propose 1-2 alternates"}.

Output ONLY a JSON object, no prose, no markdown fences:
{
  "templateId": one of the template ids above,
  "durationSeconds": number,
  "targetAudience": string,
  "suggestedAudiences": string[] (ONLY include this key if the business did not give a target audience),
  "beats": [
    {
      "id": string,
      "role": "attention" | "branding" | "connection" | "direction",
      "atSeconds": number, "durationSeconds": number,
      "text": string (optional — spoken narration for this beat, concatenated in order across beats to form the full script),
      "photoRef": { "imageIndex": number (0-based, into the ${request.productImages.length} product image(s) given), "focalPoint": {"x":0-1,"y":0-1}, "zoomFrom": number, "zoomTo": number } (optional),
      "promoBadge": { "code": string, "description": string, "expiresAt": string } (optional — only on a promo/direction beat, only if a promotion was actually given),
      "ctaLabel": string (optional — a specific single-threaded CTA, e.g. "Order now", not "Learn more"),
      "ctaUrl": string (optional),
      "captionStyle": "word-highlight" | "sentence" | "none" (default word-highlight)
    }
  ]
}

Rules:
- Every beat's atSeconds + durationSeconds must sum to at most the plan's own durationSeconds.
- At least one beat must have role "attention" and be the FIRST beat (atSeconds: 0).
- At least one beat must have role "direction" and carry a ctaLabel or promoBadge.
- Only use "promoBadge" if the business actually gave a promotion (see below) — never invent a discount.
- Only set "ctaUrl" if a real website URL was actually given below (see "Website URL") — never invent one, and never
  guess a plausible-looking product page. If none was given, omit "ctaUrl" entirely; the ctaLabel alone (e.g. "Shop
  now") is still a complete, valid direction beat without a link attached.
- Only reference "imageIndex" values that exist in the ${request.productImages.length} image(s) actually given.
- Do not add narration text to every beat — a beat can be pure visual (photoRef only) or pure CTA (ctaLabel only) with no spoken line.

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
      const invalidIndexes = result.data.beats
        .map((b) => b.photoRef?.imageIndex)
        .filter((i): i is number => i !== undefined && (i < 0 || i >= request.productImages.length));
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
          content: `These photoRef.imageIndex values are out of range (only 0-${request.productImages.length - 1} exist): ${invalidIndexes.join(", ")}. Return a corrected JSON object, no other text.`,
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
