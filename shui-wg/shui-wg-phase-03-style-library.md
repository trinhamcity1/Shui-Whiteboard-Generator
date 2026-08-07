# Phase 3 — Visual variety and the script-only planning path

Read `prompts/shui-wg/shui-wg-README.md` first. Phase 2 must be done: a deployed, authenticated,
working API producing real videos with real cost telemetry.

## Goal

Two things standing between Phase 2's working-but-narrow pipeline and something Shui
would actually want to build a real content library on: every video looking the same,
and every caller being required to hand-author a full scene timeline by hand. This
phase fixes both.

## 1. An icon and illustration library

Pick and integrate a real icon set — check its license for commercial use and
redistribution before committing, the same diligence already applied to Golpo's own
terms earlier in this project. Reasonable options: **Heroicons** (MIT) or **Phosphor
Icons** (MIT) for broad, free, permissively-licensed coverage; a paid pack (e.g.
Streamline) if you need denser topical coverage than either free set provides. Store
the chosen set's assets in this repo (or a versioned package), and expose them to scene
authors as a fixed `icon` vocabulary (a name like `"scale-of-justice"` or `"book-open"`,
not a raw file path) — this is what `SceneAction.icon` from Phase 1 refers to.

## 2. Multiple style variants

Build 3-4 real, visually distinct presets — the same idea as Golpo's
`canvas_style_variant`, scoped down to what's actually achievable well in this phase:

- `classic-whiteboard` — the style Phase 1 already shipped (light background, dark
  ink strokes).
- `chalkboard-dark` — dark background, light/chalk-colored strokes.
- `modern-minimal` — flatter, less "hand-drawn," cleaner geometric shapes and simpler
  transitions — better fit for some content (finance, tech) than an illustrated
  whiteboard look.

Each style is a theme object (colors, stroke width, font, transition timing) consumed
by the same component library from Phase 1 — the components render structurally
identically, only the theme changes. Do **not** fork the component library per style;
that's how it silently drifts and doubles maintenance.

## 3. The script-only planning path, for real this time

Implement `planScenesFromScript` (stubbed in Phase 1): a single LLM call that takes a
`narrationScript` and returns a `SceneAction[]` using only the fixed component
vocabulary and icon names from §1 — never inventing a new action type or a
free-floating icon name outside the known set. Validate the model's output against the
Zod schema from Phase 1 before accepting it; reject and retry once on a schema
violation rather than passing malformed data into the renderer.

Log this call's token cost into the job's `JobCost.scenePlanningCostUsd` — it's a real,
measurable extra cost on top of TTS and render compute, and needs to show up honestly in
the total.

This is the convenience path — someone (or something) that only wants to hand over
words and get a video, no visual authoring required. It should feel roughly as good as
a decent first draft, not as good as a carefully hand-authored `SceneDocument`. That
gap is fine and expected; Shui's own Phase 7 uses the pre-authored path once a human has
reviewed and refined a script's visual plan.

## 4. Verify

1. The same narration script, rendered with 2-3 different `styleVariant` values,
   produces visibly, meaningfully different output — not just a palette swap that's
   hard to tell apart at a glance.
2. A script-only request (`narrationScript` with no `scenes`) produces a coherent,
   watchable video with a sensible visual plan — check on 5+ varied scripts, not just
   the one used in Phase 1's testing, since this is the first time content this
   project hasn't seen before gets thrown at it.
3. A `planScenesFromScript` output that fails schema validation on the first attempt is
   retried once and either succeeds or fails the job cleanly with a clear
   `statusMessage` — never silently renders garbage.
4. Total `JobCost` for a script-only job is still comfortably inside the project's
   target range even with the added planning-call cost.
5. Icon license terms are documented in this repo's README, plainly, the way Golpo's
   commercial-use terms were checked before this project started building on top of
   them.

## Out of scope

No public API, no billing, no more than a handful of style variants (breadth here is a
Phase-4-and-beyond, demand-driven decision, not something to over-build speculatively
now).
