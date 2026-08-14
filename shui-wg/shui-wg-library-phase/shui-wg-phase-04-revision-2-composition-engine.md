# Phase 4 Revision 2 — The Composition Engine

Read `shui-wg-phase-04-amendment-asset-library.md` first — this document does
not replace it, it extends it. Everything in the amendment about Tier
1/Tier 2 assets, the trained-style-model approach (§3), the asset registry
(§4), and `sketchDiagram`/`rough.js` (§5) stays true and stays the plan.
This revision adds three things the amendment didn't cover: how the
library grows itself after v1 ships, and how a scene actually gets composed
from a topic instead of hand-authored.

Prepared by: shareholder direction, this session · for: Shui WG engineering
· status: draft, awaiting shareholder read before build starts

## Why this revision exists

Building the v1 asset library (~20 assets, amendment §1–2) answers "how do
we get consistent illustrations." It doesn't answer three follow-on
questions that came up once real Golpo reference frames were compared
side by side against `sketchDiagram` prototypes built this session:

1. What happens the first time a video needs something that isn't one of
   the ~20 v1 assets — does the pipeline block, degrade to a plain
   description, or something better?
2. How does a labeled diagram (a pyramid, a building with "JUSTICE" carved
   into it) actually get color-matched and positioned without a human
   manually placing every label by hand?
3. How does the system decide *what a scene should look like* at all —
   which characters, which diagram, how many boxes, where the arrow
   points — from nothing but a topic sentence?

This revision answers all three, and was validated with working prototypes
before being written down: a `rough.js` pyramid with real text labels and
two style-model candidates standing in as characters; a building backdrop
with a character composited at a proportional scale; and that same
backdrop with a real text label ("JUSTICE") correctly positioned on its
frieze. All three render for $0 marginal cost — no AI call at render
time, only Remotion compositing.

## The four layers, in build order

Each layer depends on the one before it. None of this replaces the
amendment — Layer 0 *is* the amendment, unchanged.

| Layer | What it delivers | Depends on |
|---|---|---|
| 0 — Trained style model | The LoRA + v1 asset library (amendment §1–3) | Shareholder sign-off on curated candidates |
| 1 — Diagram system | `sketchDiagram` wired into the real schema/pipeline | Layer 0 |
| 2 — Self-expanding library | New assets generated on demand, promoted automatically | Layers 0–1 |
| 3 — Composition engine | Topic → fully composed multi-scene video, no hand-authoring | Layers 0–2, real usage data |

## Layer 0 — unchanged, still first

No changes from the amendment. Plan A (generate ~100–150 candidates,
curate ~20, train a LoRA on fal.ai) is still the required first step.
Nothing below is safe to build on top of an untrained model, because
Layers 2 and 3 both assume new elements generated later will match the
library by construction — that guarantee only exists once training is
done.

## Layer 1 — the diagram system, for real

The amendment's §5 already specified `sketchDiagram` + `rough.js`. This
session validated the approach with working prototypes and found real
issues the amendment didn't anticipate — this section is the corrected
spec.

**A central style file, not per-component constants.** Every visual
choice — ink color, paper color, the tier color palette, `rough.js`
roughness/bowing/stroke width, the hand-lettered font, proportion ratios —
lives in one file (`src/render/sketchStyle.ts`). Components read from it;
they never hardcode their own values. This is what keeps a
flowchart built next month looking like it belongs with the pyramid built
today.

**A real hand-lettered font, self-hosted.** Bold system sans-serif does
not match a hand-sketched shape — this was visible immediately in the
first prototype render. `Permanent Marker` (or equivalent), shipped as a
local `public/fonts/` file and loaded via `@font-face`, not pulled from a
CDN at render time — a network font loader is one more thing that can fail
mid-render for no visual-quality reason.

**Proportional scaling, not fixed-width.** A generated character image
carries a lot of empty headroom baked into the composition. Scaling by a
fixed pixel width (what the first prototype did) makes the character read
as too small next to a diagram. The fix: auto-crop every generated asset
to its actual content bounding box (`sharp().trim()` after background
removal), then scale by real height against a defined ratio
(`characterToPyramidHeightRatio`, `characterToBuildingHeightRatio` — both
in the central style file).

**Real text laid over generated images, anchored per-asset.** The same
mechanism that labels a `rough.js` pyramid tier also labels a generated
building ("JUSTICE" on a courthouse frieze) — real Remotion text,
positioned at a stored anchor point, never AI-rendered text. The anchor
point (where on *this* image the label goes) is asset-specific and gets
captured automatically at generation time — see Layer 2, which is where
this actually gets built, since it's the same moment a new asset enters
the registry.

**Schema additions**, layered on top of the amendment's:

```ts
sketchDiagram: {
  diagramType: "pyramid" | "flowchart" | "comparison";
  title: string;
  tiers: Array<{ label: string; color?: string }>; // color defaults from sketchStyle palette
  topLabel?: string;
  bottomBanner?: string;
  leftCharacterAssetId?: string;
  rightCharacterAssetId?: string;
}
```

`LibraryAsset` (amendment §4) gains a `labelAnchor` field:

```ts
labelAnchor?: {
  xFraction: number; // 0-1 across the asset's own cropped width
  yFraction: number; // 0-1 down the asset's own cropped height
};
```

## Layer 2 — the self-expanding library

The amendment already allows a one-off `imageConcept` fallback for
anything that doesn't belong in the reusable library. This layer replaces
"one-off and thrown away" with "one-off, then promoted" — every live
generation makes the library more complete instead of being spent once
and forgotten.

**The flow, on a cache miss:**

1. **Semantic near-match search.** Before generating anything new, check
   whether an existing asset's description is close enough ("grocery
   store," "corner market," "supermarket downtown" should all resolve to
   one asset). Without this step the library fills with near-duplicates
   instead of actually growing reusable coverage.
2. **Generate through the trained model.** Same LoRA the v1 library used —
   this is *why* Layer 0 has to come first. A live generation through the
   trained model matches the library by construction, not by hoping a
   prompt holds.
3. **Auto-detect the label anchor.** A vision-capable LLM call reads the
   newly generated image and returns a `labelAnchor` (see Layer 1) — no
   human ever clicks a coordinate. This is also where the asset's
   dominant color gets sampled (for any label board that needs to match
   the asset's own palette, e.g. a plaque behind a building's name).
4. **Quarantine before promotion.** The new asset serves the video that
   needed it immediately. It only enters the permanent shared registry
   after a lightweight automated check (dimensions, transparency
   succeeded, a quick style-match self-check) — never instantly, because
   one bad generation entering the shared library silently propagates
   into every future video that reuses it.

**Text discipline still applies.** If a newly generated asset needs a
label baked in visually (a store sign that says "MARKET"), that label is
still real text composited on top via the anchor from step 3 — never part
of the AI generation itself, for the same text-legibility reason the
amendment gave for `sketchDiagram` in the first place.

**Schema addition** — `LibraryAsset` gains:

```ts
origin: "v1-manifest" | "auto-expanded";
quarantineStatus: "pending" | "promoted";
```

## Layer 3 — the composition engine

This is the layer that turns "create a 1-minute video about how meditation
helps productivity" into a fully composed, multi-scene video with no
hand-authored `SceneDocument`. It is the same planner LLM already in the
pipeline (Claude, currently deciding scene count/type in Phase 3) — not a
second AI, not a new model to train. It's that LLM given a bigger
vocabulary and a stricter output contract.

**Composition templates — designed once, reused forever.** A template is
data: a fixed set of named slots (`panel1`, `panel2`, `arrows`, ...) each
with a pre-designed position, scale, and z-order. The visual craft — scale
hierarchy, asymmetric spacing, a clear focal point — is built into the
template by a human, one time. The planner's job is template *selection*
and slot *filling*, never freeform layout invention. This split exists
because an LLM inventing a genuinely artistic layout from scratch, every
render, is not reliable — a mechanical grid is the predictable failure
mode of skipping this split.

Starter template set (build these first, expand later, same "don't build
for a demand signal you don't have" discipline as Tier 2 asset sets):
`hero-backdrop` (one backdrop + one character + attention label),
`pyramid-flanked` (already prototyped this session),
`storyboard-4panel` (multiple boxes, connecting arrows),
`comparison-2box`.

**Schema addition** — a new `SceneAction` type:

```ts
composition: {
  templateId: string;
  slots: Record<string, {
    assetId?: string;        // library asset
    imageConcept?: string;   // Layer 2 fallback, promotable
    diagram?: SketchDiagramProps;
    label?: string;
  }>;
}
```

**Planner extension.** The system prompt gains: the template catalog
(each template's slots and a plain-language "use this when" description),
the full asset registry, and composition rules (arrow semantics — an
arrow connects a cause to an effect, not decoration; 1-3 focal elements
per scene, not a wall of assets). Output is validated against the schema
above — the planner can only ever select a template and fill declared
slots, which is what keeps its output always renderable.

**Per-scene reveal timing, not just per-video timing.** The existing
`DrawOn` system already syncs a scene's reveal to ElevenLabs' word-level
timestamps. A multi-slot composition scene (box 1, then the arrow, then
box 2) needs that same staggering *inside* one scene — each slot gets its
own offset within the scene's time window, so box 2 doesn't appear before
the narration has finished describing box 1. This is an extension of
`DrawOn`'s existing timing model, not a new timing system.

**How this gets validated — iteration, not a training run.** Run the
extended planner against a batch of real test topics, review the actual
composed output, find where template selection or slot-filling is wrong,
adjust the system prompt and template "use this when" descriptions,
repeat. Same discipline already used to validate the Phase 3 scene
planner. New templates get added only when a real topic doesn't fit any
existing one well — and template geometry itself is always human-approved,
never generated ungoverned, for the same reason asset promotion is gated
in Layer 2.

## Cost, consolidated

| Item | Cost |
|---|---|
| Layer 0 — Plan A training (one-time) | ~$12–28 |
| Layer 0 — Plan B, if triggered (one-time, shareholder ceiling) | ~$50–100 |
| Layer 2 — new asset via live-gen (per cache miss, rare over time) | ~$0.02 |
| Layer 2 — anchor auto-detection (per new asset) | ~$0.01–0.03 |
| Layer 3 — template selection/slot-filling | Marginal LLM tokens on the existing planner call — no new cost line |
| Marginal cost per finished video, once library + templates exist | ~$0.02–0.03/min |
| Golpo, for comparison | $2.00/min |

Still ~65–100x cheaper than Golpo. Nothing in Layers 1–3 changes that —
diagrams, auto-expansion, and composition selection all ride on
compute/generation costs already accounted for; none of them add a new
paid API call per video once the library and templates exist.

## Action items for engineering, in build order

1. Finish Layer 0 (amendment §8, unchanged): full candidate batch, curation,
   LoRA training, sign-off gate, v1 library generation.
2. Build `src/render/sketchStyle.ts` as the actual shared style source (a
   working version exists from this session's prototypes — promote it,
   don't rebuild from scratch).
3. Add `assetId` and `sketchDiagram` to the real `SceneAction` schema; wire
   `resolveImages.ts` to the registry lookup as the default path.
4. Update the scene-planning LLM to select library assets and diagram
   types instead of only text/bullet actions; re-run a full test video
   against the Golpo reference.
5. Build the Layer 2 pipeline: semantic near-match search, live-gen
   through the trained model, vision-LLM anchor detection, quarantine →
   promotion.
6. Build 3-4 starter composition templates (§ Layer 3) as Remotion
   components taking slot-fill props.
7. Extend the planner with the template catalog + composition rules; add
   the `composition` action type to the schema.
8. Extend `DrawOn` timing to support per-slot reveal offsets within one
   scene.
9. Validate Layer 3 against a batch of real test topics; iterate on the
   planner prompt and template set before calling it done.

## Verify

1. A video referencing a Tier 1/Tier 2 asset renders with zero live AI
   calls at render time (Layer 0/amendment, unchanged).
2. A `sketchDiagram` pyramid renders with correctly spelled labels and a
   character scaled proportionally to it, matching this session's
   prototype quality or better.
3. A scene needing an asset outside the v1 manifest resolves via Layer 2
   without blocking the render, and the new asset appears in quarantine,
   not instantly in the shared registry.
4. A label placed on an auto-generated asset (e.g. a building) lands on
   a sensible anchor with zero manual coordinate entry.
5. Given only a topic sentence, the extended planner produces a
   multi-scene `SceneDocument` using `composition` actions, and the
   chosen templates/assets render into something a reviewer would call
   "composed," not "grid-snapped."
6. Per-scene reveals inside a multi-slot composition stay in sync with
   ElevenLabs' word timestamps, the same standard already applied to
   every other action type.

## Out of scope, this revision

Auto-generating new template *geometry* without human approval;
retraining the style model speculatively (only on a real quality problem
or new visual direction); a self-serve UI for non-engineers to add
templates or assets; more than the four starter templates until real
usage shows a topic that doesn't fit any of them.
