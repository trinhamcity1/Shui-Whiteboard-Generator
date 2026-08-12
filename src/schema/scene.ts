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

export const SceneAction = z
  .object({
    id: z.string(),
    type: SceneActionType,
    atSeconds: z.number().nonnegative(),
    durationSeconds: z.number().positive(),
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
    imageConcept: z.string().max(300).optional(),
    attribution: z.string().optional(),
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
        // it off as one. Illustrative art may instead describe what to
        // draw (imageConcept), resolved to a real image before render.
        if (action.imageUrl === undefined && action.imageConcept === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `SceneAction of type "${action.type}" requires either "imageUrl" or "imageConcept"`,
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
