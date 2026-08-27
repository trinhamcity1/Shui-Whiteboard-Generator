import { z } from "zod";

/**
 * The full diagram library (Phase: Diagram Library rebuild). Replaces the
 * old pyramid/flowchart/comparison-only SketchDiagramSpec — three shapes
 * force-fit onto every kind of content because they were all that existed,
 * which is exactly the "just use the pyramid over and over" complaint that
 * triggered this rebuild.
 *
 * Ink-first by design (Revision 4 methodology decision): a DiagramNode's
 * `emphasis` is the ONLY way to add color, and it is semantic, never
 * decorative — "positive"/"negative" map to the shared signalRed/leafGreen
 * pair (correct/incorrect, right/wrong), "accent1/2/3" map to the locked
 * tierPalette for a genuine category legend stated once and reused (e.g.
 * "blue = federal, violet = state") — never assigned by index just to look
 * lively. Omit `emphasis` entirely for the default ink-on-paper look; most
 * nodes in most diagrams should have no emphasis at all.
 *
 * See shui-wg/shui-wg-library-phase/shui-wg-phase-07-diagram-library.md for
 * the full taxonomy, tiering rationale, and per-kind layout notes this
 * schema implements.
 */

export const DiagramEmphasis = z.enum(["positive", "negative", "accent1", "accent2", "accent3"]);
export type DiagramEmphasis = z.infer<typeof DiagramEmphasis>;

export const DiagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  insetAssetId: z.string().optional(),
  insetImageUrl: z.string().optional(),
  emphasis: DiagramEmphasis.optional(),
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  label: z.string().optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

const CharacterFields = {
  leftCharacterAssetId: z.string().optional(),
  rightCharacterAssetId: z.string().optional(),
  // Populated by resolveImages, never author-supplied — same pattern as
  // every other assetId->Url field in this schema.
  leftCharacterUrl: z.string().optional(),
  rightCharacterUrl: z.string().optional(),
};

// --- Node-sequence family -------------------------------------------------
// One shared rendering engine (NodeSequenceDiagram), five layouts:
// "stack" (pyramid/funnel/flowchart), "ring" (cycle), "hub" (radial),
// "row" (comparison). Kept as distinct `kind` values because the PLANNER
// needs to pick based on semantic intent (ranking vs. sequence vs. cyclical
// process vs. central-concept-with-facets vs. side-by-side) even where two
// kinds render via the same underlying layout.

const NodeSequenceBase = z.object({
  title: z.string(),
  topLabel: z.string().optional(),
  bottomBanner: z.string().optional(),
  nodes: z.array(DiagramNodeSchema).min(1),
  ...CharacterFields,
});

export const PyramidDiagramSchema = NodeSequenceBase.extend({
  kind: z.literal("pyramid"),
  // Ranked/hierarchical tiers, equal-width stacked cards, top = highest
  // rank. Use for a genuine hierarchy (legal authority, org structure by
  // rank) — never for a plain sequence, which has no ranking to claim.
});

export const FunnelDiagramSchema = NodeSequenceBase.extend({
  kind: z.literal("funnel"),
  // Same stack layout, but tapering width top-to-bottom — the taper is
  // semantically meaningful here (a shrinking quantity/pool at each
  // stage: applicants -> interviews -> hires), unlike the old pyramid's
  // now-removed taper, which claimed a ranking width doesn't actually
  // convey.
});

export const FlowchartDiagramSchema = NodeSequenceBase.extend({
  kind: z.literal("flowchart"),
  // A one-shot or repeating SEQUENCE of steps, nodes in order. isCyclical
  // draws a loop-back arrow from the last step to the first — only set it
  // true for a process that actually repeats (the water cycle), never
  // assumed just because this shape was picked.
  isCyclical: z.boolean().optional(),
});

export const CycleDiagramSchema = NodeSequenceBase.extend({
  kind: z.literal("cycle"),
  // A genuinely circular process, nodes arranged in a ring with curved
  // arrows between neighbors, last connecting back to first. Prefer this
  // over flowchart+isCyclical when the process has no natural "start" —
  // a ring has no implied first step, a loop-back arrow on a line does.
});

export const RadialDiagramSchema = NodeSequenceBase.extend({
  kind: z.literal("radial"),
  centerLabel: z.string(),
  // One central concept with independent facets/categories branching out
  // — NOT a ranking, NOT a sequence. Use when the script lists several
  // parallel things that all relate to one hub idea but have no order
  // relative to each other (e.g. "the four freedoms," "types of law").
});

export const ComparisonDiagramSchema = NodeSequenceBase.extend({
  kind: z.literal("comparison"),
  // 2+ items side by side. Exactly 2 nodes gets a VS divider between
  // them; 3+ just lay out in a row. Use for "X vs Y" content — prefer
  // this over two separate fullBleedGraphic scenes when the point IS the
  // side-by-side contrast, not each item alone.
});

// --- Tree ------------------------------------------------------------------

export const TreeDiagramSchema = z.object({
  kind: z.literal("tree"),
  title: z.string(),
  // parentId omitted (or absent from the array) marks a root. Multiple
  // roots are allowed (a forest), but most content has exactly one.
  nodes: z.array(DiagramNodeSchema.extend({ parentId: z.string().optional() })).min(1),
  // Use for a genuine branching hierarchy with a VARYING number of
  // children per level (an org chart, a taxonomy) — pyramid is for a
  // fixed linear stack of ranked tiers, tree is for actual branching.
});

// --- Matrix (2x2 quadrant) --------------------------------------------------

export const MatrixDiagramSchema = z.object({
  kind: z.literal("matrix"),
  title: z.string(),
  xAxisLabel: z.string(),
  yAxisLabel: z.string(),
  // Reading order: top-left, top-right, bottom-left, bottom-right.
  quadrants: z.array(z.object({ label: z.string(), description: z.string().optional() })).length(4),
  // Use for genuine two-axis classification (urgency x importance,
  // federal x state jurisdiction) — needs exactly two independent
  // dimensions, not just four unrelated categories (that's radial).
});

// --- Venn --------------------------------------------------------------------

export const VennDiagramSchema = z.object({
  kind: z.literal("venn"),
  title: z.string(),
  sets: z.array(z.object({ id: z.string(), label: z.string() })).min(2).max(3),
  // Keyed by set ids joined with "+", sorted (e.g. "a+b", "a+b+c") — the
  // label shown in that overlap region. Omit a key to leave that overlap
  // unlabeled (still shaded, just no text).
  overlapLabels: z.record(z.string(), z.string()).optional(),
  // Use ONLY for genuine set overlap (things that share some but not all
  // properties) — never force a plain comparison into a Venn just for
  // visual variety; a Venn with an empty or near-empty overlap is a
  // planner mistake, not a valid rendering of "these are different."
});

// --- Fishbone (Ishikawa / cause-effect) ----------------------------------

export const FishboneDiagramSchema = z.object({
  kind: z.literal("fishbone"),
  title: z.string(),
  effect: z.string(),
  categories: z.array(z.object({ label: z.string(), causes: z.array(z.string()).min(1) })).min(1).max(6),
  // Use for "why did X happen" / multi-cause content — one effect, several
  // categories of contributing causes. Not for a simple sequence (that's
  // flowchart) or a single cause->effect pair (that's a plain arrow
  // decoration on a fullBleedGraphic, not a whole diagram).
});

// --- Network / graph ---------------------------------------------------------

export const NetworkDiagramSchema = z.object({
  kind: z.literal("network"),
  title: z.string(),
  nodes: z.array(DiagramNodeSchema).min(1),
  edges: z.array(DiagramEdgeSchema),
  // Arbitrary nodes and connections with no hierarchy or sequence implied
  // — a system's components and how they connect, a set of entities and
  // their relationships. Use when the content is genuinely a web of
  // connections, not a ranking (tree/pyramid) or an ordered process
  // (flowchart/cycle).
});

// --- Swimlane -----------------------------------------------------------------

export const SwimlaneDiagramSchema = z.object({
  kind: z.literal("swimlane"),
  title: z.string(),
  lanes: z.array(z.object({ id: z.string(), label: z.string() })).min(2).max(4),
  nodes: z.array(DiagramNodeSchema.extend({ laneId: z.string() })).min(1),
  edges: z.array(DiagramEdgeSchema),
  // A process split across multiple actors/departments — each lane is one
  // actor's responsibility. Use when WHO does each step matters as much
  // as the step itself (e.g. "how a bill becomes law": Congress's lane,
  // the President's lane, the Courts' lane).
});

// --- UML sequence diagram ------------------------------------------------

export const SequenceDiagramSchema = z.object({
  kind: z.literal("sequenceDiagram"),
  title: z.string(),
  actors: z.array(z.object({ id: z.string(), label: z.string() })).min(2).max(5),
  // Rendered top-to-bottom in array order — this array IS the timeline,
  // there is no separate ordering field.
  messages: z.array(z.object({ fromActorId: z.string(), toActorId: z.string(), label: z.string() })).min(1),
  // Technical/systems content ONLY — "how does a request flow through
  // this system," "what happens step by step between these actors over
  // time." Never use for a general process with no real actor-to-actor
  // handoff (that's flowchart or swimlane).
});

// --- UML class / ER diagram ------------------------------------------------

export const ClassDiagramSchema = z.object({
  kind: z.literal("classDiagram"),
  title: z.string(),
  classes: z.array(z.object({ id: z.string(), name: z.string(), attributes: z.array(z.string()).optional() })).min(1),
  relationships: z.array(z.object({ fromClassId: z.string(), toClassId: z.string(), label: z.string().optional() })),
  // Technical content ONLY — a data model, a system's entities and their
  // structural relationships (not a flow of events over time — that's
  // sequenceDiagram).
});

export const DiagramSpec = z.discriminatedUnion("kind", [
  PyramidDiagramSchema,
  FunnelDiagramSchema,
  FlowchartDiagramSchema,
  CycleDiagramSchema,
  RadialDiagramSchema,
  ComparisonDiagramSchema,
  TreeDiagramSchema,
  MatrixDiagramSchema,
  VennDiagramSchema,
  FishboneDiagramSchema,
  NetworkDiagramSchema,
  SwimlaneDiagramSchema,
  SequenceDiagramSchema,
  ClassDiagramSchema,
]);
export type DiagramSpec = z.infer<typeof DiagramSpec>;

export type NodeSequenceKind = "pyramid" | "funnel" | "flowchart" | "cycle" | "radial" | "comparison";
export const NODE_SEQUENCE_KINDS: NodeSequenceKind[] = ["pyramid", "funnel", "flowchart", "cycle", "radial", "comparison"];

export type NodeSequenceDiagramSpec =
  | z.infer<typeof PyramidDiagramSchema>
  | z.infer<typeof FunnelDiagramSchema>
  | z.infer<typeof FlowchartDiagramSchema>
  | z.infer<typeof CycleDiagramSchema>
  | z.infer<typeof RadialDiagramSchema>
  | z.infer<typeof ComparisonDiagramSchema>;

/** Type-safe narrowing for the pipeline code (resolveImages.ts,
 * resolveSceneDocument.ts, localDevInlining.ts) that needs to read/write
 * leftCharacterAssetId/leftCharacterUrl — fields only the six
 * node-sequence kinds have. */
export function isNodeSequenceSpec(spec: DiagramSpec): spec is NodeSequenceDiagramSpec {
  return (NODE_SEQUENCE_KINDS as string[]).includes(spec.kind);
}

/** Every kind whose spec carries a plain `nodes: DiagramNode[]` array —
 * used by resolveImages.ts/resolveSceneDocument.ts/localDevInlining.ts to
 * walk pending assetIds/imageUrls without each duplicating this
 * discriminated-union narrowing themselves. matrix/venn/fishbone/
 * sequenceDiagram/classDiagram don't use the shared node shape at all, so
 * they return an empty array here — those kinds don't support insetAssetId
 * icons today. */
export function collectDiagramNodes(spec: DiagramSpec): DiagramNode[] {
  switch (spec.kind) {
    case "pyramid":
    case "funnel":
    case "flowchart":
    case "cycle":
    case "radial":
    case "comparison":
    case "tree":
    case "network":
      return spec.nodes;
    case "swimlane":
      return spec.nodes;
    case "matrix":
    case "venn":
    case "fishbone":
    case "sequenceDiagram":
    case "classDiagram":
      return [];
  }
}

/** Only the six node-sequence kinds support flanking characters. */
export function collectDiagramCharacterAssetIds(spec: DiagramSpec): { leftCharacterAssetId?: string; rightCharacterAssetId?: string } {
  switch (spec.kind) {
    case "pyramid":
    case "funnel":
    case "flowchart":
    case "cycle":
    case "radial":
    case "comparison":
      return { leftCharacterAssetId: spec.leftCharacterAssetId, rightCharacterAssetId: spec.rightCharacterAssetId };
    default:
      return {};
  }
}
