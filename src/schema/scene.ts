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
        requireField("imageUrl", "imageUrl");
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
 * ZodError (e.g. the API layer in Phase 2, to build a `{loc, msg}` body)
 * should call SceneDocument.safeParse directly instead.
 */
export function parseSceneDocument(input: unknown): SceneDocument {
  const result = SceneDocument.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid SceneDocument: ${issues}`);
  }
  return result.data;
}
