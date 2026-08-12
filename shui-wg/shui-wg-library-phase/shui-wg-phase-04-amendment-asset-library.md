# Phase 4 Amendment — From live generation to a reusable asset library

Read `shui-wg-phase-04-illustration-engine.md` first — this document does not replace
it, it supersedes one part of it. Everything in the original Phase 4 doc about the
`ImageProvider` interface, Recraft, Flux, content-addressable caching, and cost
telemetry stays true and stays built. What changes is **when** image generation runs
and **what** gets generated.

Prepared by: product · for: Shui WG engineering · status: direction locked, ready to build

## Why this amendment exists

Phase 4 shipped and was tested end to end — real videos, real generated illustrations,
real cost telemetry, landing inside the $0.10–$0.27/video target. Engineering's own
product-review findings (see the "Illustration Engine Proposal" artifact) then compared
that output directly against a real Golpo reference frame and found the actual gap:
Golpo isn't calling a text-to-image model live for every scene. The recurring judge and
officer characters, and the correctly-spelled multi-tier "Federal / State / Local"
diagram, are the signature of a **pre-built character/asset library**, composited
programmatically — not a fresh AI image generated per video.

That finding matters for a reason no amount of prompt rewriting fixes: text-to-image
models are unreliable at rendering multiple correct, legible words inside a structured
diagram. Garbled letters and misplaced labels are a known model limitation, not a
prompt-wording problem. Live generation, however well-prompted, cannot reliably produce
what Golpo produces.

The fix is also, conveniently, cheaper. Live generation costs $0.10–$0.27 in image spend
*every single render*. A built-once library costs a one-time $1.00–$1.60 and then drops
the marginal illustration cost on every future video to effectively zero — the video
just reuses assets that already exist.

## The model, plainly

Every illustrated video draws from two pools of pre-generated, reusable assets:

**Tier 1 — the shared library.** Works in every video regardless of subject. Built
once, used forever, on every topic Shui ever ships.

**Tier 2 — topic-specific subsets.** Built only for a topic that genuinely needs its
own visual identity a generic character can't provide. Built on demand, when a category
has real content — not speculatively for all categories up front.

Nothing about a video's *narration, quiz, or structure* changes. This amendment touches
only how the illustration layer is sourced.

## 1. Tier 1 — the shared library

A neutral narrator character, a handful of poses, plus a small set of generic props
rendered in the same illustration style. This is the set every video can draw from
regardless of category.

| Asset | Poses / variants | Provider | Why |
|---|---|---|---|
| Narrator (neutral, professional-casual) | Explaining, pointing, thinking, celebrating/checkmark | Recraft, `style_id` | Recurs across every video — needs pose-to-pose consistency, which is what `style_id` is for. |
| Checkmark, arrow, lightbulb, book, clock, bar chart, magnifying glass, gear | 1 each | Flux | One-off props, no pose consistency needed — use the cheaper provider. |

Roughly 4 narrator poses + 7 props = **11 assets**. At $0.08/image (Recraft) for the 4
narrator poses and $0.02–0.04/image (Flux) for the 7 props: **~$0.32 + ~$0.21–0.28 ≈
$0.55–0.60** for the entire shared library.

## 2. Tier 2 — civics subset (the first, and only required, topic library for v1)

Civics is the flagship content per the existing roadmap — this is the only Tier 2 set
that needs to exist before Phase 4's amendment can be considered done.

| Asset | Poses / variants | Provider | Why |
|---|---|---|---|
| Judge | Explaining, gavel-down | Recraft, `style_id` | Recurs across civics videos — needs consistency. |
| Officer | Explaining, saluting | Recraft, `style_id` | Same. |
| Voter | Casting ballot | Flux | Single-use pose, no reuse-consistency need. |
| Ballot box, government building, gavel (prop, distinct from judge's held gavel), Constitution scroll | 1 each | Flux | One-off props. |

Roughly 4 character poses (Recraft) + 5 props (Flux) = **9 assets**, **~$0.32 +
~$0.15–0.20 ≈ $0.47–0.52**.

**Total v1 library: ~20 assets, ~$1.00–1.15 in generation cost, one time.** Comfortably
inside the $1.60–5 estimate engineering already floated, because splitting Recraft
(for anything needing pose consistency) from Flux (for anything that doesn't) saves
real money over using Recraft for everything.

Do not build a Tier 2 set for any other category yet. Add one only when that category
has real, scheduled content — the same "don't build for a demand signal you don't have"
discipline already governing when Phase 5 (productization) is allowed to start.

## 3. The style prompt — dissected from the actual Golpo reference, not guessed

The shipped `classic-whiteboard` prompt ("simple black-and-white whiteboard-style line
illustration of: …") does not match Golpo's actual look. A closer read of the reference
frame shows: clean vector line work (uniform black outlines, rounded caps, **not**
sketchy or hand-wobbled), flat cel-shaded color with no gradients or interior shading,
simple friendly character design with minimal facial detail built to be posed and
reused, and a consistent cream/textured "paper on a board" background that recurs frame
to frame (further evidence it's a static template layer, not regenerated).

Use this as the base prompt template for every Tier 1/Tier 2 character and prop
generation, substituting the bracketed fields per asset:

```
Flat vector illustration in a modern "explainer video" style. Clean, uniform black
outlines with rounded line caps — no sketchy or hand-wobbled linework. Flat cel-shaded
color fill only, no gradients or interior shading. Simple, friendly character design
with minimal facial features (dot eyes, simple mouth line, little to no nose), rounded
proportions, [role-appropriate attire]. Standalone reusable asset on a transparent
background, facing [direction], in a [pose] pose. No text, no lettering, no background
scenery.
```

Generate 2–3 test assets against this template first and compare against the Golpo
reference before committing to the full ~20-asset batch.

## 4. Asset registry

Same pattern already built for icons (`ICON_REGISTRY` in `src/render/icons/registry.ts`)
— a fixed vocabulary the scene planner references by name, not a live lookup or a
freeform description.

```ts
interface LibraryAsset {
  id: string;                 // e.g. "narrator-explaining", "civics-judge-gavel-down"
  tier: "shared" | "civics";  // extend the union as new Tier 2 sets are added
  role: "character" | "prop";
  provider: "recraft" | "flux";
  r2Key: string;
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  costUsd: number;
  generatedAt: string;
}
```

Stored in Firestore (`assetLibrary/{id}`) mirroring how `imageCache` already works, with
the actual image files in R2 under `assets/{tier}/{id}.png`, same bucket already used
for renders. Hosting cost is not a real line item: ~20 transparent PNGs at generous
resolution total well under 50MB, and R2 storage is $0.015/GB-month with zero egress
fees — a fraction of a cent per month, permanently.

## 5. Pipeline and schema changes

**Scene schema.** For character/prop placement, `SceneAction` gains an `assetId`
field alongside the existing `imageUrl`/`imageConcept` fields — the planner selects a
named asset instead of describing a fresh image. `imageConcept` (live generation) stays
supported as a documented fallback for a genuinely one-off illustration that doesn't
belong in the reusable library, but is no longer the default path.

**New action type: `sketchDiagram`.** Structured diagrams (the pyramid hierarchy, a
flowchart, a comparison) are drawn at render time using **rough.js** (MIT-licensed,
free, zero AI cost) — real hand-sketched-looking shapes with real Remotion text laid on
top, so labels are always correctly spelled. This solves the diagram-text problem
completely, since no AI model is ever asked to render words inside an image.

```ts
sketchDiagram: {
  diagramType: "pyramid" | "flowchart" | "comparison";
  tiers: Array<{ label: string; colorRamp: string }>; // for pyramid
  // flowchart/comparison shapes follow the same "structured data in, rough.js draws it" idea
}
```

**`resolveImages.ts` gets simpler, not more complex.** Its job changes from "call an
external AI API live" to "look up `assetId` in the registry and return its already-known
R2 URL" for the common case — a registry read, not a network call to a paid API. This is
a *simplification* of what's already shipped, not additional risk.

**New Remotion component: `SketchDiagram`**, using `rough.js` to draw the shape
primitives, with `TitleCard`-style real text rendered on top for every label. Character
and prop assets continue to render through the existing `DocumentReveal` /
`FullBleedGraphic` components — no change needed there, they already just take a URL.

## 6. One-time generation script

`scripts/generate-asset-library.ts`: reads a manifest (the two tables in §1 and §2,
formalized as a JSON/TS array of `{ id, tier, role, provider, prompt, pose }`), calls
the appropriate provider for each entry using the template in §3, uploads the result to
R2, and writes the `assetLibrary/{id}` Firestore doc. Run once to bootstrap the v1
library; run again, by hand, whenever a new Tier 2 set is approved.

## 7. Cost summary

| Item | Cost |
|---|---|
| Tier 1 shared library (one-time) | ~$0.55–0.60 |
| Tier 2 civics subset (one-time) | ~$0.47–0.52 |
| **Total v1 library generation (one-time)** | **~$1.00–1.15** |
| Hosting (permanent, monthly) | Effectively $0 (well under $0.01/month on R2) |
| Marginal illustration cost per video, going forward | ~$0 (asset reuse, not regeneration) |
| Marginal illustration cost per video, Phase 4 as originally shipped | $0.10–0.27 |

## 8. Action items for engineering

1. Generate 2–3 test assets against the §3 prompt template; compare against the Golpo
   reference frame before running the full batch.
2. Build `scripts/generate-asset-library.ts` and the `assetLibrary` Firestore/R2
   pattern (§4).
3. Add `assetId` to the scene schema; update the planner to select from the registry
   for character/prop placement instead of writing a live `imageConcept` by default.
4. Add the `sketchDiagram` action type and the `rough.js`-based `SketchDiagram`
   component (§5) for structured diagrams.
5. Run the full ~20-asset v1 batch (§1–2) once the test assets in step 1 are approved.
6. Re-run `render-illustration-comparison.ts` (or an equivalent) against the new
   asset-library path and confirm the output looks closer to the Golpo reference than
   the original live-generation output did.

## 9. Verify

1. A video referencing a Tier 1 asset (e.g. the narrator) and a video referencing a
   Tier 2 civics asset (e.g. the judge) both render correctly, pulling from the
   registry with zero live AI calls at render time.
2. A `sketchDiagram` pyramid renders with correctly spelled labels, no AI-generated
   text anywhere in the frame.
3. Per-video `JobCost` for an illustrated video shows ~$0 image-generation cost
   (registry lookup, not live generation) once the library exists.
4. The rendered output, reviewed side by side with the Golpo reference frame, is
   visibly closer in style than Phase 4's original `classic-whiteboard` live-generation
   output.
5. Adding a new Tier 2 set later (e.g. a future finance subset) requires no schema or
   pipeline change — only new manifest entries and a script re-run.

## Out of scope

Building Tier 2 sets for categories without real, scheduled content yet; animating
character assets (poses stay static images, motion comes from Remotion's existing
enter/exit and `DrawOn` reveal treatment); a self-serve internal tool for non-engineers
to add new assets (the manifest + script is enough for now).
