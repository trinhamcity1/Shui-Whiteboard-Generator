import { z } from "zod";

// The Ads product: a business submits its own product photos + a brief,
// and gets back a short conversion-oriented video for TikTok/Reels/Stories/
// feed. Deliberately a SIBLING schema to SceneDocument (schemaVersion 1),
// not an extension of it — an ad beat (hook/CTA/promo badge) and a
// whiteboard SceneAction (bulletList/sketchDiagram) share almost no fields,
// and cramming both into one discriminated union would mean every consumer
// of SceneAction has to reason about ad-only fields it never sees, and vice
// versa. schemaVersion 2 marks "this is the ad shape," not "v1 plus fixes."

export const AdPlatform = z.enum(["tiktok", "instagram", "facebook", "x"]);
export type AdPlatform = z.infer<typeof AdPlatform>;

// The four duration tiers the product owner specified, used as a decision
// rubric by the planner when the caller doesn't pin a duration — never a
// hard rule the caller can't override.
export const AD_DURATION_TIERS = [
  { max: 6, label: "Under 6s — non-skippable bumper ads or a quick brand nudge" },
  { max: 15, label: "6-15s — Instagram Stories, TikTok, fast social feeds" },
  { max: 30, label: "15-30s — Facebook feeds, mobile placements, a quick product story" },
  { max: 60, label: "30s+ — only when the viewer is deeply engaged or the product needs real explanation" },
] as const;

/** Picks the tier label a given duration falls into — for logging/prompting, not validation (any positive duration is schema-valid). */
export function durationTierLabel(seconds: number): string {
  const tier = AD_DURATION_TIERS.find((t) => seconds <= t.max);
  return tier?.label ?? AD_DURATION_TIERS[AD_DURATION_TIERS.length - 1]!.label;
}

// The researched template taxonomy — a fixed, human-reviewed set, same
// discipline as CompositionTemplateId in scene.ts. The planner selects one,
// never invents a new structure.
export const AdTemplateId = z.enum([
  "problem-solution",
  "before-after",
  "demo-how-it-works",
  "testimonial",
  "unboxing",
  "founder-story",
  "listicle",
  "promo-urgency",
  "day-in-the-life",
  "pov-skit",
]);
export type AdTemplateId = z.infer<typeof AdTemplateId>;

// Google's ABCD framework — every beat is tagged with the job it's doing,
// so the plan is auditable against the framework instead of eyeballed.
export const AdBeatRole = z.enum(["attention", "branding", "connection", "direction"]);
export type AdBeatRole = z.infer<typeof AdBeatRole>;

export const PhotoRef = z.object({
  // Index into the request's productImages array — the beat never carries
  // its own URL, so a single uploaded photo can be reused across beats
  // with different crops/motion.
  imageIndex: z.number().int().nonnegative(),
  focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.5 }),
  // Ken Burns zoom bounds — a scale multiplier, animated linearly across
  // the beat's own duration. 1.0 = no zoom. zoomTo > zoomFrom pushes in
  // (the far more common choice — a slow push-in reads as intentional;
  // pushing out reads as an accident on a static product photo).
  zoomFrom: z.number().positive().default(1.0),
  zoomTo: z.number().positive().default(1.12),
});
export type PhotoRef = z.infer<typeof PhotoRef>;

export const PromoBadge = z.object({
  code: z.string().optional(),
  description: z.string(),
  expiresAt: z.string().optional(),
});
export type PromoBadge = z.infer<typeof PromoBadge>;

export const AdBeat = z
  .object({
    id: z.string(),
    role: AdBeatRole,
    atSeconds: z.number().nonnegative(),
    durationSeconds: z.number().positive(),
    // Spoken narration for this beat, if any — concatenated across beats
    // in order to form the full TTS script, same "coversText realignment"
    // discipline as SceneAction, minus the illustration-specific fields.
    text: z.string().optional(),
    photoRef: PhotoRef.optional(),
    promoBadge: PromoBadge.optional(),
    ctaLabel: z.string().optional(),
    ctaUrl: z.string().optional(),
    captionStyle: z.enum(["word-highlight", "sentence", "none"]).default("word-highlight"),
  })
  .superRefine((beat, ctx) => {
    if (!beat.text && !beat.photoRef && !beat.promoBadge && !beat.ctaLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AdBeat must carry at least one of: text, photoRef, promoBadge, ctaLabel.",
        path: ["text"],
      });
    }
    if (beat.role === "direction" && !beat.ctaLabel && !beat.promoBadge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A "direction" beat should carry a ctaLabel or promoBadge — that\'s the job this role is tagging.',
        path: ["ctaLabel"],
      });
    }
  });
export type AdBeat = z.infer<typeof AdBeat>;

export const AdDocument = z.object({
  schemaVersion: z.literal(2),
  templateId: AdTemplateId,
  platform: AdPlatform,
  voice: z.string().min(1),
  durationSeconds: z.number().positive(),
  targetAudience: z.string(),
  // Populated only when the caller omitted targetAudience — the AI's
  // alternates, surfaced rather than silently discarded.
  suggestedAudiences: z.array(z.string()).optional(),
  productImages: z.array(z.object({ url: z.string(), label: z.string().optional() })).min(1),
  beats: z.array(AdBeat).min(1),
});
export type AdDocument = z.infer<typeof AdDocument>;

// A caller either references a photo already uploaded via POST
// /assets/upload (assetId — resolved with an ownership check at render
// time, since the api key that submits this job may not be the one that
// uploaded it) or supplies a raw url directly (e.g. for testing, or a
// publicly hosted photo). Never both on the same entry.
export const ProductImageRef = z.union([
  z.object({ assetId: z.string().min(1), label: z.string().optional() }),
  z.object({ url: z.string().min(1), label: z.string().optional() }),
]);
export type ProductImageRef = z.infer<typeof ProductImageRef>;

export const AdRequestSchema = z
  .object({
    mode: z.literal("ad"),
    businessName: z.string().min(1),
    businessType: z.string().min(1),
    productDescription: z.string().min(1),
    productImages: z.array(ProductImageRef).min(1),
    promotion: z
      .object({
        description: z.string(),
        code: z.string().optional(),
        expiresAt: z.string().optional(),
      })
      .optional(),
    targetAudience: z.string().optional(),
    platform: AdPlatform,
    // "auto" defers to the planner's own judgment against AD_DURATION_TIERS.
    durationSeconds: z.union([z.number().positive(), z.literal("auto")]).default("auto"),
    voice: z.string().min(1),
  })
  .strict();
export type AdRequest = z.infer<typeof AdRequestSchema>;

export class AdValidationError extends Error {
  issues: Array<{ loc: (string | number)[]; msg: string }>;

  constructor(issues: Array<{ loc: (string | number)[]; msg: string }>) {
    super(`Invalid AdDocument: ${issues.map((i) => `${i.loc.join(".")}: ${i.msg}`).join("; ")}`);
    this.name = "AdValidationError";
    this.issues = issues;
  }
}

export function parseAdDocument(input: unknown): AdDocument {
  const result = AdDocument.safeParse(input);
  if (!result.success) {
    throw new AdValidationError(result.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })));
  }
  return result.data;
}
