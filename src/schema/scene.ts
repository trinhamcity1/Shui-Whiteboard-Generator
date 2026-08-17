import { z } from "zod";

export const SceneActionType = z.enum([
  "titleCard",
  "bulletList",
  "iconCallout",
  "documentReveal",
  "timeline",
  "comparisonCards",
  "quote",
  "fullBleedGraphic",
  "sketchDiagram",
  "composition",
]);
export type SceneActionType = z.infer<typeof SceneActionType>;

export const TimelineEntry = z.object({
  year: z.number(),
  label: z.string(),
});

export const ComparisonCard = z.object({
  title: z.string(),
  items: z.array(z.string()),
});

// Revision-2 Layer 1 — mirrors SketchDiagram.tsx's props. Only "pyramid"
// shape is implemented so far (flowchart/comparison come later), so this
// schema only needs the pyramid fields for now.
export const PyramidTierSchema = z.object({
  label: z.string(),
  color: z.string().optional(),
  // Revision-3 Workstream 3: an optional small icon-scale illustration
  // inside the tier itself, alongside its label — "diagram shapes carry
  // embedded content" (Part I §8), not just an outline. Resolved to
  // insetImageUrl by resolveImages, same pattern as assetId elsewhere —
  // never author-supplied directly.
  insetAssetId: z.string().optional(),
  insetImageUrl: z.string().optional(),
});

export const SketchDiagramSpec = z.object({
  title: z.string(),
  // "pyramid" — ranked/hierarchical tiers (unchanged, the original shape).
  // "flowchart" — a top-to-bottom sequence of connected steps, for a
  // process or cycle (the tiers ARE the steps, in order) — never force a
  // process into a pyramid just because pyramid was the only shape
  // available; a pyramid visually claims a ranking that a sequence doesn't
  // have. "comparison" — two boxes side by side (uses the first two tiers).
  diagramType: z.enum(["pyramid", "flowchart", "comparison"]).default("pyramid"),
  topLabel: z.string().optional(),
  tiers: z.array(PyramidTierSchema).min(1),
  bottomBanner: z.string().optional(),
  leftCharacterAssetId: z.string().optional(),
  rightCharacterAssetId: z.string().optional(),
  // Populated by resolveImages (not author-supplied) once
  // leftCharacterAssetId/rightCharacterAssetId are looked up in the
  // registry — the renderer reads these, never the raw asset ids.
  leftCharacterUrl: z.string().optional(),
  rightCharacterUrl: z.string().optional(),
});
export type SketchDiagramSpec = z.infer<typeof SketchDiagramSpec>;

// Revision-3 Workstream 2 — the doodle decoration vocabulary: owned SVG
// components (arrows, emphasis marks, containers, environmental dressing),
// never AI-generated images, placeable on any action or composition slot.
// One flexible shape covers every kind rather than one schema per
// decoration type, since most fields (x/y/color/size) are shared and only
// a few are kind-specific (toX/toY for arrows, width/height for
// containers) — see src/render/decorations/Decoration.tsx for the
// dispatch from this spec to its concrete component.
export const DecorationKind = z.enum([
  "arrowCurved",
  "arrowStraight",
  "arrowJagged",
  "arrowDashed",
  "xMark",
  "checkmark",
  "radiatingStrokes",
  "circledScribble",
  "underlineSwash",
  "sparkle",
  "motionDashes",
  "bannerRibbon",
  "scroll",
  "thoughtBubble",
  "speechBubble",
  "wobbleFrame",
  "tornPaperEdge",
  "groundTufts",
  "bushes",
  "shadowEllipse",
]);
export type DecorationKind = z.infer<typeof DecorationKind>;

export const DecorationSpec = z.object({
  kind: DecorationKind,
  x: z.number().optional(),
  y: z.number().optional(),
  // Arrow-only: the point it points to.
  toX: z.number().optional(),
  toY: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  size: z.number().optional(),
  color: z.string().optional(),
  fill: z.string().optional(),
  // Scroll-only.
  hasSeal: z.boolean().optional(),
  // Offset in seconds from the scene's own start — same per-slot timing
  // model as CompositionSlot.revealAtSeconds below.
  revealAtSeconds: z.number().nonnegative().optional(),
});
export type DecorationSpec = z.infer<typeof DecorationSpec>;

// Revision-2 Layer 3 — a template is data: a fixed set of named slots, each
// pre-designed (position/scale/z-order) by a human inside the template
// component itself. The planner only ever selects a templateId and fills
// declared slots — never invents freeform layout, which is what keeps its
// output always renderable (revision-2 doc, Layer 3).
export const CompositionSlotSchema = z.object({
  assetId: z.string().optional(),
  // 300 was set before the planner prompt was rewritten to demand real,
  // specific creative briefs (subject/setting/action/mood, explicit
  // period-accurate attire) — that change is working (verified on a real
  // render) but routinely produces well-written descriptions past 300
  // chars, which then fails the one-retry schema-validation loop outright
  // and crashes the whole render. Raised to give real detail room instead
  // of fighting a fix already proven to matter.
  imageConcept: z.string().max(600).optional(),
  // Populated by resolveImages, never author-supplied — same discipline as
  // the top-level action fields above.
  imageUrl: z.string().optional(),
  label: z.string().optional(),
  // Offset in seconds from the scene's own start, not absolute video time —
  // lets one slot (e.g. an arrow, or panel 2) reveal after another within
  // the same scene, extending DrawOn's existing per-action timing model
  // down to the per-slot level.
  revealAtSeconds: z.number().nonnegative().optional(),
  // Workstream 2 — decorations placed relative to this slot's own template
  // position (each template component decides how to interpret a slot's
  // local coordinate space).
  decorations: z.array(DecorationSpec).optional(),
  // Workstream 4 — a small nudge applied on top of the template's own
  // fixed position/scale, the only thing the layout QA loop is allowed to
  // change (never a slot's content or a template's structure). Author-
  // settable too, but its real purpose is being the loop's one bounded
  // correction per scene — see src/pipeline/layoutQA.ts.
  layoutAdjustment: z
    .object({
      offsetX: z.number().optional(),
      offsetY: z.number().optional(),
      scaleMultiplier: z.number().positive().optional(),
    })
    .optional(),
  // Workstream 3 item 3 — author-settable: the name of another slot in the
  // same composition whose asset has a detected "attachment" anchor (e.g.
  // a building's front steps). When set, a template that supports it
  // positions this slot AT that anchor instead of its own fixed position —
  // "a character standing on the steps" instead of "a character floating
  // in a neighboring box." A template with no attachment support, or a
  // referenced slot with no attachment anchor, just ignores it.
  attachTo: z.string().optional(),
  // Populated by resolveImages from the referenced assetId's registry
  // entry, never author-supplied — same discipline as imageUrl.
  attachmentAnchor: z.object({ xFraction: z.number(), yFraction: z.number() }).optional(),
  // Populated by resolveImages alongside imageUrl — the asset's natural
  // pixel size, needed to convert attachmentAnchor's 0-1 fractions into an
  // absolute position once this slot's image is scaled to fit its box
  // (see applyAttachment in CompositionTemplates.tsx).
  imageWidthPx: z.number().optional(),
  imageHeightPx: z.number().optional(),
});
export type CompositionSlot = z.infer<typeof CompositionSlotSchema>;

export const CompositionTemplateId = z.enum([
  "hero-backdrop",
  "pyramid-flanked",
  "storyboard-4panel",
  "comparison-2box",
  // Revision-3 Workstream 5 — reverse-engineered from the reference
  // corpus (Golpo frames + the product owner's illustrated-history set).
  "narrative-3-zone",
  "central-focal",
  "confrontation-mirror",
  "group-lineup",
]);
export type CompositionTemplateId = z.infer<typeof CompositionTemplateId>;

export const CompositionSpec = z.object({
  templateId: CompositionTemplateId,
  // A generic heading, used the same way by every template — so a
  // template doesn't need its own bespoke title field.
  title: z.string().optional(),
  slots: z.record(z.string(), CompositionSlotSchema),
  // Revision-3 WS5 comparison-2box upgrade: comparison-2box only. "vs"
  // (default) keeps the circular VS badge; "torn" replaces it with a
  // jagged torn-paper seam — the reference corpus's "Collapse |
  // Transformation" treatment, for a comparison that reads as a rupture
  // rather than a neutral face-off.
  dividerStyle: z.enum(["vs", "torn"]).optional(),
});
export type CompositionSpec = z.infer<typeof CompositionSpec>;

export const SceneAction = z
  .object({
    id: z.string(),
    type: SceneActionType,
    atSeconds: z.number().nonnegative(),
    durationSeconds: z.number().positive(),
    // A verbatim substring of the narration script — the exact words this
    // action is illustrating, copied character-for-character, never
    // rendered on screen. atSeconds/durationSeconds above are only the
    // planner's own pre-TTS estimate; realignSceneTiming (render/timing.ts)
    // locates this exact text inside ElevenLabs' real per-word timestamps
    // after TTS and snaps the action onto it. A rate-based estimate (the
    // prior approach) assumed the planner spaced scenes at a flat words/sec
    // rate, which real render evidence disproved — durations are authored
    // by feel, not word count, so the drift compounded unevenly across a
    // video and dumped itself onto the final scene as a long freeze.
    // Matching the actual words removes the guess entirely. Optional so a
    // pre-authored (non-planner) SceneDocument still validates without it —
    // realignment just falls back to the rate estimate for such an action.
    coversText: z.string().optional(),
    text: z.string().optional(),
    icon: z.string().optional(),
    items: z.array(z.string()).optional(),
    timelineEntries: z.array(TimelineEntry).optional(),
    comparisonCards: z.array(ComparisonCard).optional(),
    imageUrl: z.string().optional(),
    // Short, concrete description of what should be drawn — resolved into a
    // real imageUrl by the Phase 4 image-generation pipeline step before
    // render. Never invented by the renderer itself; either a human author
    // or the LLM planner sets this, never a fabricated URL.
    // 300 was set before the planner prompt was rewritten to demand real,
  // specific creative briefs (subject/setting/action/mood, explicit
  // period-accurate attire) — that change is working (verified on a real
  // render) but routinely produces well-written descriptions past 300
  // chars, which then fails the one-retry schema-validation loop outright
  // and crashes the whole render. Raised to give real detail room instead
  // of fighting a fix already proven to matter.
  imageConcept: z.string().max(600).optional(),
    // Revision-2 Layer 1: selects a named asset from the trained-style
    // library registry instead of describing a fresh image — the default
    // path for any recurring character/prop. imageConcept stays supported
    // as the documented fallback for a genuinely one-off illustration.
    assetId: z.string().optional(),
    sketchDiagram: SketchDiagramSpec.optional(),
    composition: CompositionSpec.optional(),
    attribution: z.string().optional(),
    // Workstream 2 — decorations overlaid on top of this action's own
    // rendered content, full-bleed over the action's frame. Optional and
    // additive to every action type; never required.
    decorations: z.array(DecorationSpec).optional(),
  })
  .superRefine((action, ctx) => {
    // Cheap, targeted checks that a given action type carries the fields it
    // actually needs — catches a malformed SceneDocument at validation time
    // instead of deep inside the renderer.
    const requireField = (field: keyof typeof action, label: string) => {
      if (action[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SceneAction of type "${action.type}" requires "${label}"`,
          path: [field],
        });
      }
    };

    switch (action.type) {
      case "titleCard":
      case "quote":
        requireField("text", "text");
        break;
      case "bulletList":
        requireField("items", "items");
        break;
      case "iconCallout":
        requireField("icon", "icon");
        requireField("text", "text");
        break;
      case "documentReveal":
      case "fullBleedGraphic":
        // A real document scan/artifact must be supplied directly
        // (imageUrl) — no generator should invent a fake document and pass
        // it off as one. Illustrative art may instead select a library
        // asset (assetId, the default) or describe a one-off (imageConcept),
        // resolved to a real image before render.
        if (action.imageUrl === undefined && action.imageConcept === undefined && action.assetId === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `SceneAction of type "${action.type}" requires "imageUrl", "imageConcept", or "assetId"`,
            path: ["imageUrl"],
          });
        }
        break;
      case "timeline":
        requireField("timelineEntries", "timelineEntries");
        break;
      case "comparisonCards":
        requireField("comparisonCards", "comparisonCards");
        break;
      case "sketchDiagram":
        requireField("sketchDiagram", "sketchDiagram");
        break;
      case "composition":
        requireField("composition", "composition");
        break;
    }
  });

export type SceneAction = z.infer<typeof SceneAction>;

export const SceneDocument = z.object({
  schemaVersion: z.literal(1),
  narrationScript: z.string().min(1),
  voice: z.string().min(1),
  styleVariant: z.string().min(1),
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
  backgroundTrack: z.string().optional(),
  actions: z.array(SceneAction).min(1),
});

export type SceneDocument = z.infer<typeof SceneDocument>;

/**
 * Parses and validates a SceneDocument, throwing a single readable error
 * (not a raw Zod stack) if it's malformed. Callers that need the raw
 * ZodError. Throws SceneValidationError, which carries the issues in the
 * {loc, msg} shape the Phase 2 API needs for its 422 response body.
 */
export class SceneValidationError extends Error {
  issues: Array<{ loc: (string | number)[]; msg: string }>;

  constructor(issues: Array<{ loc: (string | number)[]; msg: string }>) {
    super(`Invalid SceneDocument: ${issues.map((i) => `${i.loc.join(".")}: ${i.msg}`).join("; ")}`);
    this.name = "SceneValidationError";
    this.issues = issues;
  }
}

export function parseSceneDocument(input: unknown): SceneDocument {
  const result = SceneDocument.safeParse(input);
  if (!result.success) {
    throw new SceneValidationError(result.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })));
  }
  return result.data;
}
