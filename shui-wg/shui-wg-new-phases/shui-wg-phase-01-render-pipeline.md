# Phase 1 — The real render pipeline

Read `prompts/shui-wg/shui-wg-README.md` first. Phase 0 must be done: a real MP4 rendered
locally and inside Docker, TTS provider chosen and working, both GCP/Firebase projects
provisioned.

## Goal

Turn Phase 0's one hardcoded scene into a real pipeline: a versioned scene schema, a
proper component library, real timing sync, full audio/music compositing, and — the
part that matters most for this project's whole premise — real, itemized cost
telemetry recorded per job. Still no API and no deployment; this phase is entirely
about the pipeline's own correctness and cost, run locally against a small batch of
real scripts.

## 1. The scene schema

A versioned JSON schema (Zod), the same shape of idea as Shui's own deleted
`LessonScript`/`SceneAction`/`NarrationBeat` — this project is a direct continuation of
that design, just server-side and general-purpose instead of Shui-specific.

```ts
const SceneActionType = z.enum([
  "titleCard", "bulletList", "iconCallout", "documentReveal",
  "timeline", "comparisonCards", "quote", "fullBleedGraphic",
]);

const SceneAction = z.object({
  id: z.string(),
  type: SceneActionType,
  atSeconds: z.number(),
  durationSeconds: z.number(),
  text: z.string().optional(),
  icon: z.string().optional(),       // name from the icon library, see Phase 3
  items: z.array(z.string()).optional(),
  year: z.number().optional(),       // for timeline actions
});

const SceneDocument = z.object({
  schemaVersion: z.literal(1),
  narrationScript: z.string(),
  voice: z.string(),
  styleVariant: z.string(),          // Phase 3 — one variant ships in this phase
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
  backgroundTrack: z.string().optional(),
  actions: z.array(SceneAction),
});
```

Deliberately general, not Shui-specific — no `questionId`, no `category`. A `region map`
component (the old app's US-map-with-pins) is explicitly **not** in this list. It was a
civics-specific visual that doesn't generalize to book summaries or skills content;
treat it as a possible future plugin component, not a core primitive.

## 2. Two ways to produce a `SceneDocument`

Mirror Golpo's own `prompt` vs `custom_script` split, since this is exactly the same
distinction Shui needs:

- **Pre-authored** — the caller supplies the full `SceneDocument` (all `actions`
  already planned, with timing). Deterministic, free of any extra LLM cost, and the
  path Shui's Phase 7 uses once it has AI-drafted and *human-approved* a script and its
  visual breakdown.
- **Script-only** — the caller supplies just `narrationScript`, and Shui WG plans the
  `actions` itself via a small LLM call against the fixed component vocabulary above.
  Convenient for quick iteration; costs a few cents extra per job. This is Phase 3's
  concern to build — stub the function now (`planScenesFromScript(script): SceneAction[]`
  throwing "not implemented") so the schema and pipeline already accommodate it.

## 3. The component library

Build each `SceneActionType` as a real Remotion component: `TitleCard`, `BulletList`,
`IconCallout`, `DocumentReveal`, `Timeline`, `ComparisonCards`, `Quote`,
`FullBleedGraphic`. Port the visual language and the "draws itself on" reveal animation
from the old SwiftUI set (`SceneElementViews.swift`, if you still have that history
available) — same idea (a stroke/element animating in over ~0.3-0.6s, staggered for
lists), reimplemented as Remotion/React instead of SwiftUI. One shared `<DrawOn>` wrapper
component, matching the old `DrawOnStroke` modifier's role.

Compose the full timeline in one root Remotion composition that reads a `SceneDocument`
and renders whichever `actions` are active at the current frame — the same
"filter actions by time range, render whichever apply" logic
`SceneCanvasView`/`LessonPlaybackViewModel` used, translated to Remotion's
frame-based timing model (`useCurrentFrame()`, `fps`).

## 4. Real timing sync

Use the TTS provider's word-level timing (Phase 0) to place scene actions accurately
rather than trusting hand-guessed `atSeconds`/`durationSeconds` values blindly. At
minimum: validate that no action's time range exceeds the actual narration duration,
and log a warning (not a hard failure) if a scene's total duration and the audio
duration disagree by more than ~10% — that's a sign the caller's `SceneDocument` and
the real narration have drifted apart.

## 5. Compositing and output

FFmpeg step: mux the rendered video track with narration audio, add a background music
bed if `backgroundTrack` is set (a small bundled library of royalty-free tracks is
enough — Pixabay Music or the YouTube Audio Library both have usable, clearly-licensed
options; check and note the license for whichever tracks you actually include). Output
1080×1920 (vertical) or 1920×1080 (horizontal) H.264/AAC MP4 — matching what Shui's own
ingestion pipeline already expects, since these files need to flow into Shui unchanged.

## 6. Cost telemetry — build this for real, not as an afterthought

Every render produces a `JobCost` record:

```ts
interface JobCost {
  ttsCharacters: number;
  ttsCostUsd: number;
  scenePlanningLLMTokens?: number;   // only if the script-only path was used
  scenePlanningCostUsd?: number;
  renderWallClockSeconds: number;
  renderComputeCostUsd: number;      // estimated from Cloud Run's published per-vCPU-second / per-GB-second rates
  totalCostUsd: number;
}
```

Log this to stdout for now (Phase 2 persists it to Firestore alongside the job record).
This number is the entire point of the project — treat getting it right as seriously as
getting the video itself right.

## 7. Upload to R2

Once a render succeeds, upload the final MP4 to `shui-wg-renders` (the bucket
provisioned in Phase 0) and return its URL. Reuse the presigned-upload pattern Shui's
own `functions/` already uses for R2 (SigV4, `@aws-sdk/client-s3`) — same mechanism,
different bucket and credentials.

## 8. Verify

1. A batch of 5 real, varied scripts (different lengths, different content) all render
   successfully to watchable MP4s with reasonably synced narration.
2. Every job's `JobCost` is printed and looks like the range this project is betting on
   — flag clearly if it doesn't.
3. Output files land in `shui-wg-renders` and are reachable at their returned URLs.
4. A scene document with a deliberately mistimed action logs the drift warning instead
   of silently rendering wrong or crashing.
5. Unit tests for the cost calculation functions and the scene-schema validation (a
   malformed `SceneDocument` is rejected with a clear error, not a runtime crash deep
   in the render).

## Out of scope

No API, no deployment, no job queue, no multiple styles (one style variant is enough
here — Phase 3 adds more), no script-only LLM planning path (stubbed only).

---

## Amendment (added when Phase 4 was written)

`DocumentReveal` and `FullBleedGraphic` were built here exactly as specified — real,
working Remotion components — but nothing in this phase or Phase 3 ever produced a real
`imageUrl` for them to render, so in practice they went unused and the pipeline's actual
output was typographic-only (title cards, bullet lists, timelines). That gap is closed
in `shui-wg-phase-04-illustration-engine.md`, which adds real image generation
(two swappable providers) and a pipeline step that resolves an `imageConcept` into a
real `imageUrl` before these two components ever render. Nothing in this phase needs to
change — the components and schema fields were already correctly shaped for this from
the start.
