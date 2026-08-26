# Phase 4 Revision 3 — The Design System

Read `shui-wg-phase-04-amendment-asset-library.md` and
`shui-wg-phase-04-revision-2-composition-engine.md` first — this document does not
replace either. The four-layer Composition Engine architecture (trained style model,
diagram system, self-expanding library, composition engine) stays exactly as built and
validated in the August 2026 engineering status report. This revision exists because
that report proved the architecture works and simultaneously proved the *output doesn't
look like the product we're building toward*. This is the design-system pass: it
defines the target look precisely, then closes the gap in five workstreams.

Prepared by: product owner, from shareholder art direction · for: Shui WG engineering
· status: direction approved — build in the sequence given, gate at the checkpoints given

## Why this revision exists

The status report's own words: the visual system is "functionally correct but not yet a
full design pass." Side-by-side comparison of current output against real Golpo
reference frames (the "Judicial Review" and "Hierarchy of Law" frames, kept with this
doc's reference set) shows the gap concretely:

- **Palette**: the current LoRA was trained toward a "warm painterly storybook" mood —
  soft, yellow-warm, atmospheric. Golpo's look is the opposite: white paper, confident
  black ink, and *selective* bright marker color. Ours reads cozy; the target reads
  energetic, clear, educational. This was an art-direction miss in the earlier
  planning, not an engineering failure — engineering built exactly what was curated.
- **Connective tissue**: Golpo frames are full of hand-drawn arrows, X marks, banner
  ribbons, thought bubbles, torn paper, emphasis strokes. Our output has none of these
  — rough.js gives basic geometric shapes only. These decorations are what carry the
  "energy" of the genre.
- **Scene density and composition**: Golpo composes whole-canvas tableaus — characters
  *interacting with* diagram content (holding documents, standing on steps), icons
  embedded *inside* diagram shapes, a clear left-to-right reading flow guided by
  arrows. Our four templates place assets in slots next to each other.
- **Gaps and balance**: our renders have dead zones and unbalanced weight; Golpo
  frames use 60–70% of the canvas with deliberate breathing room at the edges.

The two standing product constraints govern every decision below:

1. **Everything must scale to a public webapp.** No design-system choice may introduce
   per-customer or per-video marginal cost beyond the already-measured ~$0.05–0.10.
2. **In-house first.** If a capability can be built as owned code or owned trained
   assets, it is — external dependencies stay limited to what's already in use
   (fal.ai for training/generation, ElevenLabs for TTS, Claude API for
   planning/vision), all usage-metered, none per-seat or per-video licensed.

---

## Part I — The Art Direction Specification

This section is the contract. Every workstream below implements some part of it, and
the §Verify checks at the end test against it. It was dissected from real Golpo
output frames, not imagined. Where exact values are given they are **starting points
to be locked during Workstream 1's curation gate** — the shareholder-approved curated
set becomes the canonical reference, and `src/render/sketchStyle.ts` gets updated to
the locked values as part of that sign-off.

### 1. Paper and canvas

- Background is **off-white paper**, not pure white: target ≈ `#FAF8F3`, with a very
  subtle paper-grain texture. It should read as a lit whiteboard/paper surface, not a
  flat digital fill.
- The whole video plays inside a **board frame device**: a thin dark border with
  corner clip marks (Golpo renders every video inside this frame — it's part of the
  brand language of the genre). Built once as a static overlay layer in the style
  file; costs nothing per render.
- A barely-visible edge vignette is acceptable; the earlier LoRA's baked-in glow
  vignette is not (that defect was already root-caused and must not return via the
  retrain prompt).

### 2. Ink

- **Every element is outlined in confident near-black ink**: target ≈ `#1D1D1B`,
  visibly hand-drawn in character — slight taper and wobble, not geometric-perfect,
  not sketchy-scribbled either. One committed stroke, the way a practiced whiteboard
  artist draws.
- Line weight is *hierarchical*: thick for silhouettes and title lettering, medium
  for interior detail, thin for texture (hatching on the pyramid's side face, fabric
  folds). This hierarchy is what makes the frames read instantly at phone size.

### 3. Color palette — one palette, two temperature groups

The single most important rule survives from the Golpo analysis: **most of the canvas
stays ink-on-paper; color is deployed for meaning.** Color marks what matters — tier
fills in a diagram, one highlighted character, an emphasis arrow, the focal subject of
a scene. If everything is colored, nothing is.

The palette is now unified across both reference sources (see §4 — the Golpo
marker frames and the supplied illustrated-history frames) as **one palette with two
temperature groups**, so every asset in the library shares one color world regardless
of register. Working values — lock finals at the curation gate by sampling the
approved candidate set:

| Group | Role | Target | Where it appears in the reference frames |
|---|---|---|---|
| Bright (explanation) | Marker blue | ≈ `#54B8E5` | Pyramid "FEDERAL" tier, courthouse highlight |
| Bright (explanation) | Marker pink/magenta | ≈ `#F07EA8` | Pyramid "STATE" tier |
| Bright (explanation) | Marker orange | ≈ `#F49B4A` | Pyramid "LOCAL" tier, highlight wash |
| Earth (scene) | Terracotta | ≈ `#C96F4A` | Roman capes/shields, rooftops, fire warmth |
| Earth (scene) | Olive | ≈ `#8A8B4E` | Landscape, uniforms, vegetation |
| Earth (scene) | Parchment | ≈ `#E8D9B0` | Togas, scrolls, stone, sky washes |
| Earth (scene) | Walnut brown | ≈ `#7A5230` | Wood, leather, hair, the eagle standard |
| Earth (scene) | Stone gray | ≈ `#B9B4A8` | Architecture, armor, statues |
| Shared | Signal red | ≈ `#E03C31` | X marks, urgency arrows, seals, dropcaps, crests — **never large fills** |
| Shared | Leaf green | ≈ `#7CB65C` | Ground tufts, bushes |
| Shared | Skin tones | varied, flat | Characters — diverse, always flat fill |

Fill character: **flat fill with visible stroke direction** — slightly streaky, edges
not perfectly flush with the ink outline (a hair of paper showing in places, like a
real marker/wash pass). Never gradients, never airbrush softness, never full painterly
texture. In the rich register only (§4), **restrained single-direction hatching** is
permitted for shading and depth — never dense crosshatch engraving, which turns muddy
at phone/reel size. This is still categorically different from the current LoRA's
soft gouache look, which is why a retrain — not a prompt tweak — is required.

### 4. Two registers, one hand

The two reference sources are treated as **two registers of a single house style, not
two styles.** They share one visual DNA and differ only in density — the same artist
on a different canvas, not different artists:

- **Clean register** (the Golpo-frame DNA) — diagrams, icons, props, decorations,
  simple character beats. Bold confident ink, flat bright-group fills, generous
  paper. This is the *default register*: most scenes of most videos.
- **Rich register** (the illustrated-history DNA) — **hero frames**: one or two
  dense, full-canvas narrative tableaus per video, placed at the lesson's
  emotional or dramatic peak (the burning city, the crowd of emperors, the
  crumbling "PUBLIC TRUST" monument). Earth-group palette dominant, more interior
  detail, restrained hatching allowed, near-full canvas coverage permitted.

What binds them into one style — and what the curation gate must explicitly test:
**identical ink language** (same line confidence, same hierarchical weights, same
wobble character), **one shared palette** (the table above — a rich frame may lean
earth-group but draws from the same list), and **same character anatomy and face
style across registers**. The acceptance test is concrete: the same character
generated once in each register must read as the same artist's work. If a rich-register
candidate looks like it came from a different illustrator, it fails curation no matter
how good it looks in isolation.

Why this structure: it is how the reference history video actually works — clean
explanatory frames carry most of the runtime, and a dense tableau lands when the
narration hits its dramatic beat. That is exactly the shareholder requirement stated
for this revision: *a meaningful frame that aids the audio lesson.* It also keeps the
product honest at reel size — density is a deliberate, occasional emphasis tool, not
the default texture of every frame.

### 5. Typography

- All display text is **hand-lettered-style capitals** — the existing `Permanent
  Marker` self-hosted font decision stands, applied everywhere: titles, banner text,
  diagram labels, freestanding words ("COURTS").
- Text is always **real rendered text** (Remotion/`sketchDiagram`'s existing rule),
  never AI-generated lettering. Non-negotiable; it's the reason our diagrams already
  beat every pure-text-to-image competitor on legibility.
- Scale hierarchy: video-title lettering is huge (a third of canvas width for a
  two-word title), section labels medium, tier/step labels small. Titles get a slight
  baseline rotation (±2–3°) so they sit hand-placed, not typeset.

### 6. The decorative vocabulary

The connective, energetic layer — every one of these appears in the reference frames
and every one is currently missing. Built in Workstream 2 as owned, recolorable
vector components, not images:

**Connectors:** thick tapered curved arrow (the workhorse — fat tail, drawn curve,
solid triangular head), straight annotation arrow, jagged red trend arrow, thin
dashed motion arrow, return-loop arrow (already exists in flowchart — restyle to
match).

**Emphasis marks:** red X (two confident crossed strokes), checkmark, radiating
emphasis strokes (short lines fanning from a focal point), circled-scribble
highlight, underline swash, small stars/sparkles, motion dashes.

**Containers & devices:** banner ribbon with forked ends (the title device),
scroll with curled top and bottom (documents, constitutions — including a red-seal
variant), thought bubble (cloud with trailing dots), speech bubble, wobble-edged
rectangular frame, torn-paper edge treatment (for "broken law" style beats).

**Environmental dressing:** ground-line tufts, bushes, small shadow ellipses under
characters and props — the details that make elements sit *on* the board instead of
floating.

### 7. Character style

- Ink outline + flat marker fill, consistent with everything else on the canvas.
- **Real faces with real expressions** — eyes, brows, hair, expression. The reference
  characters are expressive and individual (a smiling judge mid-gavel-swing, a
  detective mid-thought), not minimal glyph-people. This corrects the earlier
  "dot eyes, minimal features" direction, which undershot the reference.
- Proportions: slightly stylized, large-ish heads, but grounded — not chibi, not
  realistic. Diverse cast by default.
- **Characters interact with content**: holding a document, gesturing at a diagram,
  standing on a building's steps, reacting with a thought bubble. Poses in the asset
  library must be commissioned/generated with interaction in mind (holding-something
  poses, pointing poses, reacting poses) — not just standing variants.

### 8. Composition principles

Encoded into templates (Workstream 5) and enforced by the QA loop (Workstream 4):

- **Hero-frame placement**: at most one or two rich-register tableaus per video,
  timed to the narration's dramatic or conceptual peak. Never open on one (establish
  with a clean frame first), never run two back-to-back.

- **One reading path per scene**, usually left → right or center-out, made explicit
  by arrows. A viewer should know where to look first, second, third.
- **60–70% canvas coverage** with deliberate margins; no dead quadrants, no crowding
  against edges.
- **Focal hierarchy**: one dominant element (the pyramid, the courthouse scene), with
  secondary elements clearly subordinate in scale.
- **Diagram shapes carry embedded content**: a pyramid tier holds its label *and* a
  small inset illustration; a building carries its name on the frieze. Shapes are
  containers, not just outlines.
- **Symmetry as a tool**: flanking characters left/right of a central diagram for
  formal topics; asymmetric narrative flow (scene → consequence → decision) for
  story-shaped topics.

---

## Part II — The Five Workstreams

Build in this order. Workstreams 1 and 2 are the first cycle; a mandatory checkpoint
sits after them before 3–5 proceed.

### Workstream 1 — Retrain Layer 0 to the real palette

The existing candidate → curate → train → validate pipeline is reused unchanged —
that pipeline is proven (two training runs, ~$1.94 total, including one
defect-driven retrain). Only the inputs change:

1. Rewrite the candidate-generation prompt(s) to Part I's spec: off-white paper,
   near-black hand-drawn ink outlines with hierarchical line weight, flat streaky
   fill in the unified two-group palette, selective color coverage, expressive
   character faces, no gradients, no painterly texture, no background vignette
   (explicitly excluded — the previously root-caused defect clause must stay out).
   Two prompt variants, one per register (§4): the clean-register variant leans
   bright-group palette and generous paper; the rich-register variant leans
   earth-group palette, permits single-direction hatching, and targets full-scene
   density. Both variants share every ink/anatomy/palette clause verbatim — only
   density and temperature language differs.
2. Generate ~150 candidates split roughly **60% clean register / 40% rich
   register**, spanning: characters (varied roles, expressions, interaction poses),
   props, small icon-scale objects (these matter for tier-inset illustrations in
   Workstream 3), and full-scene tableaus (the rich register's whole purpose).
   Deliberately include **same-subject pairs** — the same character or scene
   described once per register — because those pairs are what makes the §4
   one-hand acceptance test actually checkable.
3. Curate to ~20–25, spanning both registers. **Curation criteria come from
   Part I**, checked per candidate: paper color, ink character, fill flatness,
   palette compliance, face expressiveness — plus the §4 cross-register test on the
   same-subject pairs: if the pair doesn't read as one artist, both fail.
4. **Shareholder sign-off gate** on the curated set — same gate as before. At
   sign-off, the final palette hex values get locked into `sketchStyle.ts` from the
   approved images (sample them from the actual curated set, don't keep the
   working targets on faith).
5. Train, validate with test generations, then regenerate the v1 asset library
   (21 assets, ~$0.63 at measured rates) plus the new interaction poses and
   icon-scale assets Part I §6–7 call for — budget ~35–40 assets, ~$1.20.
6. Re-run every existing asset through the established quarantine gate.

The existing "warm storybook" LoRA and its assets are retired, not deleted —
archive the model version and mark its assets `styleModelVersion`-superseded in the
registry (the registry's version field, added in the amendment, exists for exactly
this).

### Workstream 2 — The doodle decoration library

Every item in Part I §5, built as **SVG path components** in a new
`src/render/decorations/` module — owned code, drawn once, zero AI involvement,
zero marginal cost, infinitely recolorable, and stroke-animatable.

- Each decoration is a parameterized component: color (from the `sketchStyle`
  palette only), scale, rotation, stroke weight, and where meaningful a shape
  parameter (arrow curvature, banner width, bubble tail direction).
- All read their visual constants from `sketchStyle.ts` — same central-style rule
  the diagram system already follows. No per-component hardcoded values.
- **Draw-on animation comes free**: SVG paths animate via stroke-dashoffset, so
  every decoration can reveal as if being drawn in real time, synced to the
  narration timestamps the pipeline already has. This upgrade should also be applied
  to the rough.js diagram shapes (rough.js outputs SVG paths too) — this is the
  single biggest step toward the genre's signature "being drawn before your eyes"
  feel, and it costs no new architecture.
- Schema: a new `decoration` element type placeable in any scene/template slot, plus
  decoration parameters on existing types where natural (a `banner` option on
  titles, an `xMark` overlay on any element).
- The planner's prompt gains the decoration vocabulary with usage rules mirroring
  Part I: arrows guide reading order; red X only for negation; ribbons for titles;
  bubbles for thought/speech; 3–6 decorations per scene, not twenty.

Authoring path: hand-author the SVG paths (an engineer with a drawing tablet, or
tracing over AI-generated *references* that are then discarded — the shipped asset is
the owned vector path, so no licensing surface at all). Estimated one-time effort:
the largest hand-work item in this revision, ~25–30 components.

### Workstream 3 — Scene grammar upgrades

Extends the existing anchor/compositing machinery — no new architecture:

1. **Multi-slot anchors**: `labelAnchor` (singular) generalizes to `anchors[]` —
   each with `{ xFraction, yFraction, kind: "label" | "inset" | "attachment" }`. A
   pyramid tier can then hold a label *and* an inset icon; a courthouse can hold a
   frieze label *and* characters positioned on its steps.
2. **Inset illustrations in diagram shapes**: `sketchDiagram` tiers/steps/boxes gain
   an optional `insetAssetId`, rendered small inside the shape at the inset anchor.
   Uses the icon-scale assets generated in Workstream 1.
3. **Attachment poses**: composition templates can place a character *at an
   attachment anchor of another asset* (on the steps, behind the desk), with the
   proportional-scaling rules the composition engine already has.
4. **Banner/ribbon integration**: `sketchDiagram` and templates use Workstream 2's
   ribbon/scroll components for their titles and footer banners (the "UNITED STATES"
   banner pattern), replacing plain text placement.

### Workstream 4 — The layout QA loop

The in-house answer to "balanced like Golpo," reusing the vision-LLM pattern the
quarantine gate already proved:

1. After a scene resolves but before final video render, render **one still frame**
   per composed scene (cheap — a single-frame Remotion render).
2. Send it to a vision model (Claude Haiku, already a dependency) with a rubric
   derived from Part I §7: overlap/collision, edge-crowding, dead zones, canvas
   coverage in range, focal hierarchy present, reading path discernible, decoration
   count in range.
3. Response is structured: pass, or a bounded set of adjustments (shift slot,
   scale element, drop a decoration). Apply once, re-render the still, accept the
   second result either way — **one correction cycle, never a loop**, so cost and
   latency stay bounded.
4. Log every critique + adjustment to the job record. Over time this is a free
   dataset showing which templates/planner habits fail most — feeding Workstream 5
   and future planner-prompt tuning.

Measured-cost expectation: one Haiku vision call + one still render per scene ≈
$0.01–0.02 per video. Inside budget; no new vendors.

### Workstream 5 — Template expansion from real reference frames

Replace "templates we anticipated" with "templates the reference corpus proves":

1. The reference corpus is **already assembled**: the 3 Golpo frames on file
   (Judicial Review, Hierarchy of Law ×2) plus the 9 illustrated-history frames the
   product owner supplied. More Golpo frames remain welcome for variety but are no
   longer blocking. Standing rule, restated: these frames inform *layout and
   composition only* — layouts aren't copyrightable; the artwork is, and none of it
   is ever training data.
2. Reverse-engineer each into a named layout. The corpus already yields at least:
   `narrative-3-zone` (Judicial Review: scene → consequence → decision),
   `pyramid-flanked` upgrades (tier insets + ribbon title + footer banner),
   `comparison-2box` upgrades ("Collapse | Transformation", "Glorious legions |
   Now…" — including the torn-divider treatment), `central-focal` (the crumbling
   "PUBLIC TRUST" monument with reacting figures around it), `confrontation-mirror`
   (two groups facing off, symmetric), `group-lineup` (the 25-emperors crowd with a
   banner title), and `hero-tableau` (the full-canvas rich-register scene — the
   Visigoths frame, the disaster frame — with a caption banner).
3. Build the recurring ones — expect 4–6 genuinely new templates plus upgrades to
   the existing four. Every template pulls exclusively from: library assets
   (Workstream 1), decorations (2), grammar features (3), and gets QA'd by (4).
4. Extend the planner's template catalog + usage rules accordingly, then run the
   report's own recommended pressure test: 8–10 varied real topics through the full
   pipeline, reviewing template and asset selection quality.

---

## Sequencing and the midpoint checkpoint

```
WS1 (retrain + regenerate library)  ──┐
                                      ├──►  CHECKPOINT  ──►  WS3 ──► WS4 ──► WS5
WS2 (decoration library)            ──┘
```

**Checkpoint (mandatory):** re-render the water-cycle test video — the established
before/after benchmark — with the retrained model and the decoration layer active,
alongside one civics topic (hierarchy-of-law), and **at least one rich-register hero
frame** (a history-flavored topic is the natural test). Review side-by-side against
both reference sets. Expectation set honestly: palette + decorations should close *more
than half* the perceived gap on their own, because color and connective doodles are
what the eye reads first. If they don't, stop and diagnose before investing in
composition sophistication — WS3–5 assume the foundation looks right.

## Cost summary

| Item | Cost | Type |
|---|---|---|
| WS1 retrain (candidates + LoRA, at measured rates) | ~$2–3 | one-time |
| WS1 library regeneration (~35–40 assets incl. new poses/icons) | ~$1.20 | one-time |
| WS2 decoration library | engineering time only | one-time, $0 marginal forever |
| WS3 scene grammar | engineering time only | one-time |
| WS4 QA loop | ~$0.01–0.02/video | marginal |
| WS5 templates + 8–10-topic pressure test | ~$0.50–0.80 total test spend | one-time |
| **Total new AI/API spend for the whole revision** | **≈ $5** | |
| Per-video marginal cost after this revision | ~$0.06–0.12 | unchanged band |

The entire design-system pass costs less in API spend than three minutes of Golpo
output. Per-video economics are untouched: everything expensive is one-time and
owned, which is exactly what the webapp-scaling constraint requires — a paying
stranger's video draws on the same retrained model, same decorations, same
templates at the same ~$0 illustration marginal cost.

## What's needed from the product owner / shareholder

1. **Sign-off at the WS1 curation gate** — the curated ~20 become the permanent
   canonical style reference; the palette gets locked from them. This is the single
   most consequential art decision in the revision.
2. ~~Reference frames for WS5~~ — **supplied** (9 illustrated-history frames + 3
   Golpo frames on file). Additional Golpo frames across varied topics still
   welcome, not blocking.
3. **Checkpoint review** — the side-by-side at the midpoint is a product-owner
   decision, not an engineering self-assessment.
4. Confirmation that the ~$5 total spend needs no further approval (it shouldn't,
   but it's stated for the record).

## Verify

1. A generated character asset, viewed at phone size next to the reference frames,
   is not immediately identifiable as "the other style" — paper, ink, flat fill,
   expressive face all present. (Curation-gate criterion, re-checked on final
   library.)
1b. **Cross-register consistency**: the same character generated in clean and rich
   register reads as one artist's work — same ink language, same anatomy, same face
   style, shared palette. Checked on the curated same-subject pairs at the gate and
   re-checked on the final library.
1c. A rich-register hero frame, scaled to phone/reel size, stays readable — the
   focal subject and any caption text survive shrinking; no full-crosshatch mud.
2. No generated asset carries a background vignette, wash, or watermark artifact —
   the quarantine gate stays green across the regenerated library.
3. Every decoration renders in every palette color via parameter, and stroke-reveals
   in sync with narration timing.
4. The water-cycle benchmark, re-rendered at the checkpoint, is visibly closer to
   the Golpo reference than the August status-report version — judged side-by-side
   by the product owner, not by engineering.
5. A pyramid diagram renders with tier insets, ribbon title, and footer banner —
   matching the Hierarchy-of-Law reference's structural density, with all text
   correctly spelled (real text, as always).
6. The QA loop demonstrably catches and corrects at least: one overlap case, one
   dead-zone case, one over-decoration case (constructed test scenes are fine).
7. The 8–10-topic pressure test completes with the planner choosing sensible
   templates unaided, and per-video `JobCost` staying inside the $0.06–0.12 band
   including the QA-loop cost.
8. `git grep` shows every visual constant lives in `sketchStyle.ts` — no
   per-component hardcoded colors, weights, or ratios anywhere in
   `src/render/decorations/` or the templates.

## Out of scope

Character animation beyond draw-on reveal (rigged/skeletal motion is a different
product tier); the drawn-hand-holding-a-pen device (classic whiteboard trope, but a
significant compositing effort — revisit only if the checkpoint review says the reveal
feel is still lacking without it); any public-facing surface (still Phase 5); music
beds beyond the existing `backgroundTrack` support; retraining the style model again
after WS1 absent a checkpoint-identified defect.

---

## Revision 4 — hard rules from real-render defects (the permanent style book)

This section exists because the shareholder explicitly asked that defects found on
real generated video be written down as standing rules applied to every future render
and every future model retrain, not just patched on the one video that showed them.
Everything below was found on an actual rendered video, root-caused in the actual
code, and fixed there — this section is the durable record of the rule, kept
separate from the fix's own code comment so it survives refactors. Add to this list;
never quietly let a fixed defect's lesson disappear.

### Palette

- **The palette is cool, not warm.** Revision 3's palette read as "warm painterly
  storybook" — soft, yellow-warm, cozy — the opposite of an educator-grade product.
  Locked values: `ink #1b1e24`, `paper #f6f7fa`, the rich-register "deep" group is
  navy/teal/slate-blue/plum/cool-gray (never terracotta/olive/parchment/walnut/stone).
  The "bright" clean-register group (blue/pink/orange) is unaffected and stays as-is.
- **A palette fix is not one file.** The literal warm/off-white wording lived in at
  least four independent places: `candidatePrompts.ts` (LoRA training + candidate
  generation), `libraryPrompt.ts` (the asset-library generator — has its OWN
  background-color suffix, appended after `SHARED_STYLE`, that can silently override
  a fix made only in `SHARED_STYLE`), `trainedStyle.ts` (the live one-off/fallback
  generator for anything not already in the library — a genuinely separate code path
  from the library generator, easy to forget entirely), and `quarantine.ts` (the
  AI quality gate's own system prompt, which can be actively instructing the reviewer
  to APPROVE the very defect you just fixed elsewhere). Any future palette change
  must `grep` across all four, not edit one and assume the rest follow.

### Diagram shape consistency

- **Every shape in one diagram must share the same shape family.** A pyramid whose
  top label is a hexagon-notched ribbon and whose tiers are rectangles reads as
  inconsistent, not layered — real shareholder feedback on a real render. If the
  content is a stack of rectangular tiers, its header/label is a rectangle too.
- **No fixed-width text/inset positioning against a tapering shape.** The pyramid's
  original trapezoid tapered per tier while labels and inset icons were positioned
  using the bottom tier's width — every tier but the bottom overflowed. A ranked
  hierarchy can be conveyed by stacking order and connecting arrows alone; it does
  not require a shape whose width itself claims the ranking.

### Fill the frame — no dead zones, ever

- **Any diagram/composition whose vertical footprint is computed from fixed
  per-element constants (box height, gap, stack height) MUST instead scale those
  constants to the actual rendered canvas height**, the same pattern already applied
  to the flowchart shape and now the pyramid stack: compute available height from
  `useVideoConfig()`, divide by element count, then clamp the result between a
  sensible minimum and maximum. A 2-3 tier diagram sized by fixed constants alone
  will use under half of a 1920px-tall vertical frame, no matter how many times this
  gets "fixed" on one video — it has to be fixed at the sizing formula, not the tier
  count.
- **A flanking character's size must be derived from — but capped independent of —
  its diagram's height.** Scaling a diagram to fill the frame must not proportionally
  inflate a character standing beside it to an absurd size; cap the character's own
  height basis separately, and center it against the (possibly much taller) diagram's
  midpoint rather than anchoring it to one edge.
- **Give every element real breathing room from its neighbors**, especially a title
  and the first content box directly below it — measure the title's own font-size
  footprint and leave clearance, don't reuse a fixed offset that happened to clear an
  earlier, differently-shaped title device.

### Arrows and connectors must be grounded in what's actually on screen

- **A connector arrow may never reveal before both of the things it connects are
  themselves visible.** Any arrow tied to a composition slot's reveal timing (e.g.
  `revealAtSeconds`) must gate its own appearance to that same timing — never render
  it `instant`/frame-0 just because it was easy to. This was found twice
  independently (Storyboard4PanelTemplate's grid arrows, already fixed; then
  Narrative3ZoneTemplate's zone-to-zone arrows, found and fixed in this revision) —
  treat every future connector-bearing template as guilty until its reveal timing is
  checked against its endpoints' own reveal timing.
- **A decoration's coordinates are a guess the author (the planning LLM) cannot
  verify** — it knows a scene's rough intent, never its exact rendered geometry. A
  real render showed a planner-authored decorative arrow (`y:700` to `y:1100`) landing
  in empty canvas below a pyramid that only used its top few hundred pixels — an arrow
  pointing at nothing. Two standing rules: (1) `sketchDiagram` actions may never carry
  a connector-kind decoration — the diagram already draws its own connecting arrows
  between tiers/steps using coordinates the decoration system has no way to predict;
  this is enforced in code (`stripUngroundedSketchDiagramConnectors` in
  `planning.ts`), not just prompted against, because the prompt alone did not hold.
  (2) On any other action, a connector decoration must only ever point between two
  elements the author is highly confident both land in known, fixed screen regions —
  when in doubt, the correct move is to omit the decoration, not guess its endpoints.

### Applying this section

Before closing out any future visual-defect report: (1) fix the specific render, (2)
find and fix the general code path that produced it (not just the symptom), (3) add
the general rule to this section so a retrain or a new template inherits it
automatically instead of relying on someone remembering this specific incident.
