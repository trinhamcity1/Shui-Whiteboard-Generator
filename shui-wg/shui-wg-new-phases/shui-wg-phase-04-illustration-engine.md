# Phase 4 — Illustration engine: real drawings, not just text

Read `shui-wg-README.md` first. Phases 0–3 must be merged and building.

## Why this phase exists

Phases 0–3 shipped exactly what they were specified to ship: a script-only pipeline
that plans scenes as `titleCard`, `bulletList`, `iconCallout`, `timeline`,
`comparisonCards`, and `quote` — typographic components only. `planning.ts` says so
explicitly, in its own system prompt: *"never use `documentReveal` or
`fullBleedGraphic` — no images are available."* That was the right call at the time;
there was no image source to back those components with. The output is a video of
well-composed text and bullet points, which is what got reviewed and correctly judged
as not good enough. A "whiteboard video" implies drawings, figures, and diagrams —
the visual substance is the product, not a backdrop for narration.

The good news: `DocumentReveal` and `FullBleedGraphic` already exist as finished,
working Remotion components (`src/render/components/`), and the scene schema
(`src/schema/scene.ts`) already has `imageUrl` and `attribution` fields with
`superRefine` validation requiring them for those two types. The gap is narrow and
specific: **nothing produces `imageUrl`.** This phase closes that gap.

## 1. Decision already made: build both providers, compare for real

Two real illustration approaches, for different reasons:

- **Recraft** — vector/SVG generation. Produces clean line-art and iconographic
  illustrations that suit a whiteboard aesthetic natively, and can be progressively
  stroke-revealed the same way `DrawOn` already reveals `DocumentReveal` content,
  because vector paths have a natural draw order. Roughly $0.08/image at API list
  pricing.
- **Flux Schnell** — fast raster diffusion, via an aggregator (fal.ai or Replicate).
  Cheaper per image (roughly $0.015–0.02 via fal.ai), photorealistic or painterly
  output rather than line art, revealed as a fade/wipe rather than a true stroke draw
  since there are no vector paths to animate.

Do not pick one now. Build both behind one interface, run the same script through
both, and produce a real side-by-side comparison — actual rendered videos, actual
metered cost, actual visual quality — before deciding which one (or whether both,
selected per use case) ships as the default. This mirrors exactly how Phase 3 already
handles style variants: `scripts/render-style-comparison.ts` renders one script
through every theme so you can look at the actual output rather than guess. Phase 4
adds the same discipline for image providers.

## 2. Scene schema change

In `src/schema/scene.ts`, add one new field to the `SceneAction` shape:

```ts
imageConcept: z.string().max(300).optional(),
```

Semantics: `imageConcept` is a short, concrete visual description — what should be
drawn — supplied either by a human author (pre-authored path) or by the planning LLM
(script-only path). `imageUrl` remains the field the renderer actually reads. The new
pipeline step in §4 resolves `imageConcept → imageUrl` before rendering ever starts,
so the Remotion components themselves need **no changes** — they already just take a
URL.

Update `superRefine`: `documentReveal` and `fullBleedGraphic` now require **either**
`imageUrl` **or** `imageConcept` (previously only `imageUrl`). A request that supplies
neither is still rejected — a human author who wants a real document scan still
supplies `imageUrl` directly, since no generator should invent a fake historical
document and pass it off as one. `imageConcept` is for illustrative art, not
documents-of-record; keep `attribution` meaningful in both cases.

## 3. `src/images/` — the provider interface

```ts
export interface GeneratedImage {
  imageUrl: string;       // R2 URL after upload, or presigned source URL if not yet cached
  provider: "recraft" | "flux";
  costUsd: number;        // 0 on a cache hit
  cacheHit: boolean;
  widthPx: number;
  heightPx: number;
}

export interface ImageProvider {
  readonly name: "recraft" | "flux";
  generate(concept: string, opts: {
    styleVariant: string;      // reuse the existing StyleTheme names for prompt-shaping
    orientation: "vertical" | "horizontal";
  }): Promise<GeneratedImage>;
}
```

Two implementations, `src/images/recraft.ts` and `src/images/flux.ts`, each a thin
wrapper: build a style-appropriate prompt from `concept` + `styleVariant` (e.g. for
`classicWhiteboard`, prepend something like "simple black-and-white whiteboard-style
line illustration of:"; for `chalkboardDark`, "chalk-drawn illustration on a dark
background of:"), call the provider's API, and return the raw image bytes plus
`costUsd` computed from the documented per-image price — do not estimate, hardcode
the real published rate the same way `src/cost/index.ts` hardcodes Cloud Run rates.

A third file, `src/images/index.ts`, exports `getImageProvider(name): ImageProvider`
so callers never import a concrete provider directly — same pattern as
`getTheme(styleVariant)` in `themes.ts`.

## 4. Content-addressable cache

Image generation is the expensive, slow step. Most whiteboard videos on related
topics reuse similar concepts ("a simple gear icon", "a stack of coins") — caching
is not an optimization to add later, it is what keeps this pipeline anywhere near the
target cost.

- Cache key: `sha256(provider + ":" + styleVariant + ":" + concept.trim().toLowerCase())`.
- Store the generated image in R2 under `images/{cacheKey}.png` (or `.svg` for
  Recraft), and a Firestore doc `imageCache/{cacheKey}` with
  `{ provider, styleVariant, concept, r2Key, imageUrl, widthPx, heightPx, costUsd,
  createdAt, hitCount }`.
- Resolution flow: compute the key, check Firestore. Hit → increment `hitCount`,
  return `costUsd: 0`. Miss → call the provider, upload the result to R2, write the
  cache doc, return the real cost.
- This is a new small Firestore read/write per image, which is cheap and worth it —
  do not skip the cache to save one round trip.

## 5. Pipeline hook point

In `src/pipeline/resolveSceneDocument.ts`, `resolveSceneDocument()` currently returns
`{ sceneDocument, scenePlanning }` straight from `parseSceneDocument()`. Add a new
step immediately after parsing, before the function returns:

```ts
const imageResolution = await resolveImages(sceneDocument, {
  provider: getImageProvider(opts.imageProvider), // "recraft" | "flux", from request or env default
  styleVariant: sceneDocument.styleVariant,
  orientation: sceneDocument.orientation,
});
```

`resolveImages()` walks every scene action, finds ones with `imageConcept` set and
`imageUrl` unset, resolves each (cache-first) in parallel with a concurrency cap
(e.g. 3), and mutates the scene document with the resolved `imageUrl`s. It returns
`{ imagesGenerated: number, cacheHits: number, costUsd: number }`.

This mirrors exactly how `renderJob.ts` already calls TTS right after
`resolveSceneDocument()` — image resolution is a peer step, same shape, same place in
the pipeline, running before the expensive Remotion bundle/render step so a failed
image generation fails fast and cheap.

## 6. Planner changes

In `src/schema/planning.ts`:

- Move `"documentReveal"` and `"fullBleedGraphic"` back into
  `PLANNABLE_ACTION_TYPES`.
- Rewrite the system prompt section that currently forbids them. New instruction,
  approximately: *"Use `fullBleedGraphic` for a strong establishing or closing visual
  when the script describes something concrete and drawable — an object, a place, a
  process, a diagram. Use `documentReveal` when the script references an actual
  document, artifact, or figure worth showing prominently. For both, set
  `imageConcept` to a short, concrete description of exactly what should be drawn —
  specific enough that an illustrator with no other context could draw it correctly.
  Do not set `imageUrl` yourself. Use these sparingly: 1–3 per video, not every
  scene — most of the video should still carry its point through
  `bulletList`/`iconCallout`/`timeline`, with illustration reserved for the moments
  that most benefit from a real picture."*
- The "sparingly" instruction is a deliberate cost and pacing control, not just a
  style preference — keep it in the prompt, and check it in the eval-style spot check
  in §9.

## 7. Cost telemetry

Extend `JobCost` in `src/cost/index.ts`:

```ts
export interface JobCost {
  ttsCharacters: number;
  ttsCostUsd: number;
  scenePlanningLLMTokens?: number;
  scenePlanningCostUsd?: number;
  imagesGenerated?: number;
  imageCacheHits?: number;
  imageGenerationCostUsd?: number;
  imageProvider?: "recraft" | "flux";
  renderWallClockSeconds: number;
  renderComputeCostUsd: number;
  totalCostUsd: number;
}
```

`buildJobCost()` folds in `imageResolution.costUsd`. `printJobCost()` prints the
image line item and the cache-hit count separately, since cache-hit rate is the
number that determines whether this stays cheap at scale.

## 8. `scripts/render-illustration-comparison.ts`

New script, same shape as the existing `render-style-comparison.ts`. Fixed narration
script with 2–3 scenes that deliberately include `imageConcept` entries (something
concrete — e.g. "a simple line drawing of a wooden ballot box with a folded paper
being inserted"), rendered twice: once with `imageProvider: "recraft"`, once with
`imageProvider: "flux"`, same style variant, same everything else. Output to
`output/illustration-comparison/{provider}.mp4`. Print a real comparison table at the
end: per-provider `imagesGenerated`, `imageGenerationCostUsd`, total `JobCost`, and
render wall-clock. This is the artifact that resolves the provider decision — watch
both outputs and decide with real evidence, not a guess.

## 9. `.env.example` additions

```
# Image generation — at least one required, both recommended for comparison
RECRAFT_API_KEY=
FLUX_API_KEY=              # fal.ai or your chosen aggregator's key
IMAGE_PROVIDER=recraft     # default provider when a request doesn't specify one
```

## 10. Licensing — check before this becomes public

Both providers' output-usage terms need a plain read before Phase 5's public launch,
not assumed:

- Recraft: confirm current commercial-use terms for API-generated images at the time
  you read this — provider terms change.
- Flux Schnell via your chosen aggregator: confirm the aggregator's output-license
  terms (not just the model weights' license) for commercial use.

Note the confirmed terms and the date checked in `ICONS.md` or a new
`IMAGE_LICENSING.md`, the same way `ICONS.md` already documents the Heroicons
license. This is a documentation task, not a build blocker, but do not skip it before
Phase 5.

## 11. Verify

1. A script-only request with a script that describes something concrete (e.g. "the
   Great Wall of China... built to protect Chinese states from invasions") produces a
   scene document containing at least one `fullBleedGraphic` or `documentReveal`
   action with a populated `imageConcept`.
2. `resolveImages()` turns that `imageConcept` into a real `imageUrl`, and the
   rendered video actually shows the generated illustration full-frame — visually
   confirm by extracting a frame, not just checking the field is non-empty.
3. Rendering the same script twice hits the cache the second time:
   `imageCacheHits > 0`, `imageGenerationCostUsd` drops to near zero on the repeat run.
4. `render-illustration-comparison.ts` produces two real videos and a printed cost
   table with non-zero, provider-specific costs.
5. `printJobCost` output for a normal render shows the image line item alongside TTS
   and render compute, and `totalCostUsd` includes it.
6. A script with nothing concretely drawable (e.g. an abstract argument) still
   produces a reasonable video using only the typographic components — the planner
   isn't forced to hallucinate an illustration where none fits.
7. Spot-check 5 script-only renders: illustration count per video stays in the
   1–3 range the prompt asks for, not on every scene.
8. `git grep` finds no image-provider API key anywhere outside `.env`/secrets
   handling.

## Out of scope

Human-in-the-loop image approval/regeneration UI (Shui App's Phase 7 batch console
can add this later if illustration quality on a specific video needs a redo — this
phase only needs the pipeline to produce a good default), style-transfer or
brand-consistent character recurrence across videos, animated (as opposed to
stroke/fade-revealed) illustrations, a third image provider. Picking the final
default provider is explicitly deferred to after this phase ships and both outputs
have been reviewed.
