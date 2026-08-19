# Phase 4 Amendment — From live generation to a reusable asset library

Read `shui-wg-phase-04-illustration-engine.md` first — this document does not replace
it, it supersedes one part of it. Everything in the original Phase 4 doc about the
`ImageProvider` interface, Recraft, Flux, content-addressable caching, and cost
telemetry stays true and stays built. What changes is **when** image generation runs,
**what** gets generated, and — as of this revision — **how style consistency is
actually achieved**.

Prepared by: product · for: Shui WG engineering · status: direction locked, ready to build
**Revised** after the "Style Model Proposal" product-review artifact — see §3, which
replaces the original per-asset prompt-template approach with a trained style-consistency
model. Everything else in this document is unchanged.

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
*every single render*. A built-once library costs a small one-time setup cost (§7) and
then drops the marginal illustration cost on every future video to effectively zero —
the video just reuses assets that already exist.

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

| Asset | Poses / variants |
|---|---|
| Narrator (neutral, professional-casual) | Explaining, pointing, thinking, celebrating/checkmark |
| Checkmark, arrow, lightbulb, book, clock, bar chart, magnifying glass, gear | 1 each |

Roughly 4 narrator poses + 7 props = **11 assets**, generated through the trained style
model once §3 clears its sign-off gate (see cost summary in §7 — provider/cost is no
longer split per asset the way it was in the original draft of this amendment, because
the trained model replaces the need to lean on Recraft's paid consistency feature for
some assets and Flux for others).

## 2. Tier 2 — civics subset (the first, and only required, topic library for v1)

Civics is the flagship content per the existing roadmap — this is the only Tier 2 set
that needs to exist before Phase 4's amendment can be considered done.

| Asset | Poses / variants |
|---|---|
| Judge | Explaining, gavel-down |
| Officer | Explaining, saluting |
| Voter | Casting ballot |
| Ballot box, government building, gavel (prop, distinct from judge's held gavel), Constitution scroll | 1 each |

Roughly 4 character poses + 5 props = **9 assets**.

**Total v1 library: ~20 assets**, all generated through the same trained style model —
see §7 for real cost.

Do not build a Tier 2 set for any other category yet. Add one only when that category
has real, scheduled content — the same "don't build for a demand signal you don't have"
discipline already governing when Phase 5 (productization) is allowed to start.

## 3. Style consistency: train a model, don't just repeat a prompt

**This section replaces the original approach in this amendment**, which proposed a
hand-written prompt template repeated per asset. That's not enough to guarantee real
consistency — running the same prompt through Recraft or Flux multiple times produces
images that are close in mood but not pixel-consistent in style, which is exactly the
"every illustration looks slightly different" problem a reused library needs to avoid.
The actual fix: train a small style-consistency model — a LoRA fine-tune on Flux —
once, so every future generation through it is consistent by construction, not by
hoping a prompt holds.

### Plan A — AI-generate-and-curate (try this first)

1. Generate ~100–150 candidate illustrations toward the target mood — warm, painterly,
   "storybook," gouache-textured, atmospheric — described qualitatively, never by
   referencing specific artists or images (see the copyright note below).
2. A human reviews and selects the ~20 strongest, most consistent-feeling results.
3. Train a LoRA style model on that curated set, using fal.ai's hosted trainer.
4. Generate a handful of new test assets through the trained model to confirm it
   actually holds the style.

**Sign-off gate.** A human reviews the curated set and the trained model's test
outputs before anything else proceeds. If it holds the style: done — proceed straight
to building the full v1 library (§1–2) through this trained model. If it doesn't: move
to Plan B. No work starts on Plan B before this explicit sign-off that Plan A didn't
land.

### Plan B — commissioned anchor set (fallback only, gated)

If AI-generated candidates can't hit the target look on their own:

1. Commission 5–10 pieces from a freelance illustrator, briefed on the mood/genre —
   not asked to copy any specific reference piece.
2. Secure full commercial usage **and AI-training rights**, explicitly, in the
   agreement before any commissioned work starts.
3. Train the same LoRA process on that artist-owned set.
4. Use the trained model to expand toward the full ~20-piece (and later, broader —
   see the Phase 5 roadmap's library-scope tiers) library faster and cheaper than
   commissioning every asset by hand.

### The reference board itself is not training data

The mood-board images used to describe the target look are other artists' copyrighted
portfolio work. Training a style model directly on downloaded copies of those specific
images, without a license, is a real legal and ethical risk, not a technicality —
style itself isn't copyrightable, but the actual artworks are. Both plans stay on the
right side of this: Plan A prompts toward the *described* mood rather than referencing
specific artists or images; Plan B pays for original commissioned work with explicit,
upfront training-rights consent. Nothing gets trained on anyone's uncompensated,
non-consenting work, under either plan. This is the same diligence already applied to
Golpo's own terms, Heroicons' license, and the image-provider licensing check in
`IMAGE_LICENSING.md` — extend that file to cover the trained style model's provenance
once Plan A or B completes.

## 4. Asset registry

Same pattern already built for icons (`ICON_REGISTRY` in `src/render/icons/registry.ts`)
— a fixed vocabulary the scene planner references by name, not a live lookup or a
freeform description.

```ts
interface LibraryAsset {
  id: string;                 // e.g. "narrator-explaining", "civics-judge-gavel-down"
  tier: "shared" | "civics";  // extend the union as new Tier 2 sets are added
  role: "character" | "prop";
  styleModelVersion: string;  // which trained LoRA version generated this asset
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
fees — a fraction of a cent per month, permanently. Recording `styleModelVersion` on
every asset matters: if the style model is ever retrained (a new LoRA version), old and
new assets need to be told apart, since mixing generations from two different trained
models inside one video would reintroduce the exact inconsistency problem this
amendment exists to fix.

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

## 6. Scripts

Two scripts now, not one:

`scripts/train-style-model.ts` — Plan A path: generates the ~100–150 candidates,
opens a review queue for curating the ~20 best, kicks off the fal.ai LoRA training run
on the curated set, and generates the sign-off-gate test assets. A `--plan-b` flag
switches the input to a directory of commissioned files instead of AI-generated
candidates, for when Plan B triggers.

`scripts/generate-asset-library.ts`: reads the manifest (the two tables in §1–2,
formalized as a JSON/TS array of `{ id, tier, role, pose }`), generates each asset
through the **trained style model** from the script above, uploads results to R2, and
writes the `assetLibrary/{id}` Firestore doc with the current `styleModelVersion`. Run
once to bootstrap the v1 library; run again whenever a new Tier 2 set is approved or
the style model is retrained.

## 7. Cost summary

| Item | Cost |
|---|---|
| Plan A: candidate generation + curation (~100–150 candidates, human-curated to ~20) | ~$2–3 |
| Plan A: LoRA style-model training (fal.ai hosted trainer) | ~$10–25 |
| **Plan A total one-time setup** | **~$12–28** |
| Plan B (only if triggered): commissioned anchor set, 5–10 pieces | ~$200–800 |
| Plan B: LoRA training on commissioned set | ~$10–25 |
| **Plan B total one-time setup (if triggered)** | **~$210–825** |
| Generating the ~20-asset v1 library through the trained model | ~$0.40–0.60 |
| **Total v1 library, Plan A path** | **~$12.40–28.60** |
| **Total v1 library, Plan B path (if triggered)** | **~$210.40–825.60** |
| Marginal cost per new library asset going forward, either plan | ~$0.02–0.03 |
| Hosting (permanent, monthly) | Effectively $0 (well under $0.01/month on R2) |
| Marginal illustration cost per video, going forward | ~$0.02–0.03/min (asset reuse, not regeneration) |
| Marginal illustration cost per video, Phase 4 as originally shipped | $0.10–0.27 |

Both plans converge to the same ongoing cost — they only differ in how the initial
training set gets made. Either way, once the library exists, illustration is reuse, not
regeneration, so it stays roughly **65–100× cheaper than Golpo's $2.00/minute**,
comfortably beating even the original $0.05–$0.27 illustrated-video estimate. Plan B's
higher one-time cost (up to ~$825) is still trivial next to a single month of Golpo
credits — it's a real cost, not a rounding error, but not a blocker either.

## 8. Action items for engineering

1. **Product decision needed first:** approve starting with Plan A, name a reviewer for
   the sign-off gate (§3), and set a budget ceiling for Plan B in case it triggers —
   none of this should be assumed by engineering.
2. Build `scripts/train-style-model.ts` (§6): candidate generation, curation queue,
   fal.ai LoRA training, sign-off-gate test-asset generation.
3. Run Plan A. At the sign-off gate, the named reviewer decides: proceed, or trigger
   Plan B within the approved budget ceiling.
4. Build `scripts/generate-asset-library.ts` (§6) and the `assetLibrary` Firestore/R2
   pattern with `styleModelVersion` tracking (§4).
5. Add `assetId` to the scene schema; update the planner to select from the registry
   for character/prop placement instead of writing a live `imageConcept` by default.
6. Add the `sketchDiagram` action type and the `rough.js`-based `SketchDiagram`
   component (§5) for structured diagrams.
7. Run the full ~20-asset v1 batch (§1–2) through the validated trained model.
8. Extend `IMAGE_LICENSING.md` to document the trained style model's provenance (which
   plan was used, commissioned-artist agreement terms if Plan B triggered).
9. Re-run `render-illustration-comparison.ts` (or an equivalent) against the new
   asset-library path and confirm the output looks closer to the Golpo reference than
   the original live-generation output did.

## 9. Verify

1. Plan A's curated ~20 candidates and LoRA test outputs pass the named reviewer's
   sign-off before any v1 library generation starts.
2. A video referencing a Tier 1 asset (e.g. the narrator) and a video referencing a
   Tier 2 civics asset (e.g. the judge) both render correctly, pulling from the
   registry with zero live AI calls at render time.
3. Every asset in the registry shares the same `styleModelVersion` and is visually
   consistent with every other asset from that version — spot-check side by side, not
   just individually.
4. A `sketchDiagram` pyramid renders with correctly spelled labels, no AI-generated
   text anywhere in the frame.
5. Per-video `JobCost` for an illustrated video shows ~$0 image-generation cost
   (registry lookup, not live generation) once the library exists.
6. The rendered output, reviewed side by side with the Golpo reference frame, is
   visibly closer in style than Phase 4's original `classic-whiteboard` live-generation
   output.
7. If Plan B triggered: the commissioned artist's agreement explicitly grants
   AI-training rights, on file, before any commissioned image was used for training.
8. Adding a new Tier 2 set later (e.g. a future finance subset) requires no schema or
   pipeline change — only new manifest entries and a script re-run through the existing
   trained model.

## Out of scope

Building Tier 2 sets for categories without real, scheduled content yet; animating
character assets (poses stay static images, motion comes from Remotion's existing
enter/exit and `DrawOn` reveal treatment); a self-serve internal tool for non-engineers
to add new assets (the manifest + script is enough for now); retraining the style model
speculatively before there's a real reason to (a new visual direction, a quality
problem with the current version) — one trained model version should serve the v1
library and its near-term growth.
