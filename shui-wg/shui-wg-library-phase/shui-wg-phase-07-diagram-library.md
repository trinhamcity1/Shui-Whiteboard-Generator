# Phase 7 — The Diagram Library

Read `shui-wg-phase-04-revision-3-design-system.md` first — that document governs the
visual rules every diagram in this library follows (ink-first color, no dead zones,
shape consistency, arrow grounding). This document is the taxonomy: what diagram
shapes exist, what each is for, and how the schema/rendering are organized.

Prepared by: product owner + engineering, from a real shareholder correction · for:
Shui WG engineering · status: built — 14 kinds shipped, see Part III for what's next

## Why this document exists

The pipeline shipped with exactly three diagram shapes — pyramid, flowchart,
comparison — because those were the only ones anyone had built, not because they
covered the content WG actually needs to illustrate. The result, called out directly:
"not just use the pyramid diagram over and over and over again." WG's mission is to
produce the best explainer video for ANY topic, not just civics content shaped like a
hierarchy — a video explaining a software system, a business process, a scientific
cycle, or a legal comparison all need genuinely different diagram shapes, and forcing
all of them through three shapes was the actual root cause, not a training or prompt
problem.

**Ink-first, semantic color only.** Every diagram in this library follows the same
color rule set in the design-system doc's Revision 4 section: a node has NO fill color
by default. Color is opt-in via a node's `emphasis` field, and only for two reasons —
`"positive"`/`"negative"` (the shared correct/incorrect signal) or `"accent1/2/3"` (a
genuine category legend stated once in the narration and reused, e.g. "blue is
federal, violet is state"). Never assigned by index just to look lively — that was the
literal pattern ("why pink? does it match the palette?") that led to this rule.

---

## Part I — The Taxonomy

Fourteen kinds across six families. Six of them (the "node-sequence" family) share one
rendering engine because they're fundamentally the same operation — arrange N labeled
nodes via a layout, optionally connect them — differing only in layout shape and
semantic intent; the other eight are genuinely different shapes with their own schema
and rendering.

### Node-sequence family (`src/render/diagrams/NodeSequenceDiagram.tsx`)

Shared shape: `{"nodes": [{"id","label","insetAssetId"?,"emphasis"?}], "title",
"topLabel"?, "bottomBanner"?, "leftCharacterAssetId"?, "rightCharacterAssetId"?}`.

| kind | layout | use for |
|------|--------|---------|
| `pyramid` | stack (equal width) | A real hierarchy/ranking — each node genuinely subordinate to the one above. |
| `funnel` | stack (tapering) | A shrinking QUANTITY through stages — the taper means something here, unlike pyramid's old (removed) taper. |
| `flowchart` | stack + arrows | A one-shot or repeating sequence — steps in order. `isCyclical` draws one loop-back arrow for a genuine repeat. |
| `cycle` | ring | A genuinely circular process with no natural starting point — a ring implies no "first step," unlike a loop-back arrow on a line. |
| `radial` | hub + spokes | One central concept (`centerLabel`) with independent, unranked facets. |
| `comparison` | row | 2+ items side by side — exactly 2 gets a VS divider. |

### The other eight kinds (one file each, `src/render/diagrams/`)

| kind | file | schema shape | use for |
|------|------|--------------|---------|
| `tree` | TreeDiagram.tsx | `nodes` with optional `parentId` | A branching hierarchy with a VARYING number of children per level (org chart, taxonomy) — pyramid is a fixed linear stack. |
| `matrix` | MatrixDiagram.tsx | `xAxisLabel`, `yAxisLabel`, `quadrants` (exactly 4) | A genuine two-axis classification (urgency x importance) — needs two real independent dimensions. |
| `venn` | VennDiagram.tsx | `sets` (2-3), `overlapLabels`? | Genuine set overlap only — never a substitute for a plain comparison. |
| `fishbone` | FishboneDiagram.tsx | `effect`, `categories` (with `causes`) | "Why did X happen" — one effect, several categories of contributing causes. |
| `network` | NetworkDiagram.tsx | `nodes`, `edges` (arbitrary) | Arbitrary connections, no hierarchy/sequence implied — a system's components, entities and relationships. |
| `swimlane` | SwimlaneDiagram.tsx | `lanes`, `nodes` (with `laneId`), `edges` | A process split across actors/departments — WHO does each step matters as much as the step. |
| `sequenceDiagram` | SequenceDiagram.tsx | `actors`, `messages` (top-to-bottom = time order) | TECHNICAL CONTENT ONLY — actor-to-actor handoffs over time. A genuinely different rendering paradigm (time flows along vertical lifelines), not a spatial layout. |
| `classDiagram` | ClassDiagram.tsx | `classes` (with `attributes`), `relationships` | TECHNICAL CONTENT ONLY — a data model / system's entities and structural relationships. |

Full Zod schema: `src/schema/diagram.ts`. Dispatcher: `src/render/diagrams/DiagramRenderer.tsx`.

---

## Part II — Engineering notes for whoever touches this next

- **Shared primitives, not per-file reinvention** (`src/render/diagrams/primitives.tsx`):
  `RoughRect`, `RoughEllipse`, `SpokeLine`, `NodeLabel`, `DiagramTitle`,
  `emphasisFill`, `fontSizeForLabel`. Every new diagram kind should build from these,
  the same reasoning `sketchStyle.ts` already applies to color/line/font tokens.
- **A hard-learned rendering rule, now enforced at the primitive level, not by
  convention**: `RoughRect`/`RoughEllipse`/`SpokeLine` each wrap their own output in a
  self-contained `<svg>`. This was NOT true in the first pass — 8 of the 9 new
  component files placed these directly as children of `AbsoluteFill` (a plain HTML
  div), which silently renders nothing at all; only the node-sequence stack layout
  happened to wrap them correctly. A real gallery render (every box/circle invisible,
  only arrows and lines visible, since those went through the already-self-contained
  `Arrow` decoration) caught this. Fixed once, at the primitive, instead of patching 8
  call sites — any future primitive that emits raw SVG elements must follow the same
  self-contained pattern.
- **Reuse eligibility for library assetIds/insetAssetId is generic across kinds** via
  `collectDiagramNodes()`/`isNodeSequenceSpec()` in `src/schema/diagram.ts` — the
  pipeline code (`resolveImages.ts`, `resolveSceneDocument.ts`, `localDevInlining.ts`,
  `planning.ts`) never needs its own per-kind switch statement to find pending
  assetIds; it calls these two helpers. Add a new kind's node-bearing fields to
  `collectDiagramNodes` when it's added, not a new branch in four separate files.
- **QA tool**: `scripts/render-diagram-library-gallery.ts` renders one still per kind
  through the real pipeline (resolveImages + the real SceneRenderer composition) and
  is the fastest way to visually sanity-check a change to any kind without spending a
  full LLM-planned render — run it after touching any diagram file.
- **Validation coverage**: `tests/diagramSchema.test.ts` covers schema acceptance/
  rejection for all 14 kinds plus the two shared helpers. A new kind needs a matching
  pair of tests (one valid, one that violates its actual required-field constraint).

---

## Part III — What's deliberately not built yet

Two things named directly in the discussion that produced this phase, both real, both
intentionally deferred rather than half-built:

- **Mind map** (multi-level radial — branches that themselves have children) — the
  hub layout only supports one ring today. Worth adding as a `radial` extension
  (a second, smaller ring per spoke) rather than a new kind, once a real topic needs
  it.
- **Per-node reveal timing.** Every diagram in this library renders as one static
  composed image (`instant` throughout) — same behavior the original pyramid/
  flowchart/comparison had. None of the 14 kinds stagger their nodes in on their own
  narration-synced timeline the way composition-template slots do via
  `revealAtSeconds`. Adding that is a real, separate piece of work (the schema has no
  per-node timing field yet) — noted here so it isn't lost, not attempted as part of
  this build.

Also worth naming: this library was scoped and built in one pass covering all 14
identified kinds rather than the incrementally-gated tiering originally proposed
(build broad-reuse kinds first, defer narrow ones until a real topic needs them) —
a deliberate choice to have the full taxonomy available immediately rather than
partially. Future additions to this taxonomy should still default back to
build-on-demand: a 15th kind is worth adding when a real script needs it, not
speculatively.
