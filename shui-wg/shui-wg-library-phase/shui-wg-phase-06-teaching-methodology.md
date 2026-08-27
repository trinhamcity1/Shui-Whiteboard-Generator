# Phase 6 — The Teaching & Retention Methodology

Read `shui-wg-phase-04-revision-3-design-system.md` first — that document is the
locked reference for **how a video looks**; this document is the locked reference for
**why a video actually teaches something**. Both work the same way: every future
prompt-writing or planner-prompt change pulls from here instead of re-deriving
"what makes people remember this" from scratch each time, the same discipline the
design-system doc established for palette and layout.

Prepared by: product owner, from the retention/teaching-technique research session ·
for: Shui WG engineering · status: locked reference — Part I is the contract,
Part II is what's already built vs. what still needs building. As of the
`src/schema/methodology.ts` build (Part II below), rules 1, 3, 4, 5, 6, and 8 are
implemented as real prompt text in `planning.ts`; 1, 7, and 8 in `scriptWriting.ts`.

## Why this document exists

The design-system work fixed how the videos look. It did nothing for whether they
work — a beautifully-illustrated video that doesn't stick with the viewer isn't a
better product, it's a better-looking version of the same problem. This document is
where that gets fixed: a single, locked description of the actual techniques that
make short-form instructional video memorable for **adult learners** (20s–50s), not
children — the two audiences respond to different things, and this pipeline exists to
serve the adult one.

The standing rule this document sets: **`planning.ts`'s system prompt is the
implementation of this document, not a separate creative brief.** When this document
changes, the planner prompt changes with it. When someone wants to add a new
retention technique or template, it gets written down here first, then implemented —
never the reverse.

---

## Part I — The Techniques

Nine techniques, each with what it is, why it works, and what it concretely means for
a ~45–90 second vertical whiteboard video. These aren't independent — most Shui WG
videos should use four or five of them at once, layered, not picked one-at-a-time.

### 1. Retrieval practice (the testing effect)

Actively recalling a fact strengthens memory far more than re-reading or re-hearing
it — repeated exposure feels like learning but barely moves retention; being asked to
produce the answer yourself does. This is the single best-evidenced technique in the
whole list.

**In this product**: the post-video quiz *is* retrieval practice — it isn't a
bolt-on feature, it's the single most important retention mechanism WG has. Every
video's narration should be written with its own eventual quiz question already in
mind: state the fact clearly enough, once, that a viewer who paid attention could
answer a question about it 30 seconds later without rereading anything.

### 2. Spaced repetition

Revisiting material at increasing intervals (a few minutes, a day, a week) beats
cramming it once. A single video is a single exposure — the retention win comes from
the *system* around it re-surfacing the same fact later, not from anything the video
itself can do alone.

**In this product**: this is Shui's job (SM-2 spaced repetition on quiz results),
not WG's. WG's contribution is making sure the fact stated in the video and the fact
tested in the quiz are the *same* fact, worded consistently enough that a later
spaced-repetition prompt still connects to the original video in the viewer's memory.

### 3. Dual coding (the multimedia principle)

Narration plus a *relevant, non-redundant* image encodes better than narration alone
or on-screen text alone — the brain builds two linked memory traces instead of one.
The word "relevant" is load-bearing: a decorative image that doesn't match what's
being said competes for attention instead of reinforcing it.

**In this product**: this is the entire reason WG illustrates instead of producing
plain narrated slides. The design-system's own rule ("DEFAULT TO AN IMAGE") already
implements this — the connection to state explicitly is that the image must depict
*the specific claim being narrated at that moment*, not a generic mood-setting visual.
An image whose subject a viewer couldn't name after the video failed this technique
regardless of how good it looks.

### 4. Segmenting and chunking

Working memory holds roughly 3–5 new items at once, not more. A concept broken into
small, clearly-bounded units, each fully finished before the next starts, is
retained far better than the same content delivered as one continuous stream. This
is why a 25-question civics chunk beats a 128-question wall, and why a single scene
should carry one idea, not three.

**In this product**: already structurally enforced by the scene/action model (one
action per beat) — the discipline to hold onto is **content** chunking, not just
visual chunking: a narration sentence that tries to land two distinct facts in one
breath defeats this even if it gets two separate illustrated scenes.

### 5. Signaling / cueing

Explicitly marking what matters — an arrow, a highlight color, a "this is the key
point" visual cue — measurably improves what learners take away, compared to the
identical content with no cue. Attention is finite; signaling spends it on purpose
instead of leaving it to chance.

**In this product**: this is what the decoration system (arrows, X marks,
checkmarks, circled scribbles) already does mechanically — Part II below is where
that gets connected to an actual rule about cueing the ONE fact each scene is teaching,
not decorating for energy alone.

### 6. Contrast and comparison

A fact stated in isolation is weaker than the same fact stated against its opposite
or its common misconception — "the sky is blue" is inert, "people think X, but
actually Y" is sticky. Contrast gives the brain something to distinguish, which is
what a memory trace actually needs to be retrievable later.

**In this product**: the comparison sketchDiagram/composition types, the checkmark/
X-mark pairing, and the "common misconception → correction" narration pattern all
implement this — Part II adds the explicit planner rule to reach for a misconception
contrast whenever the source material has one, rather than defaulting to a flat
statement of fact.

### 7. Concrete, specific framing over abstraction

"The government has three branches" is abstract; "Congress writes the law, the
President enforces it, the Courts decide if it's fair" is concrete — the same fact,
but the second version gives the brain specific, imageable content to hook a memory
to. Abstract phrasing is invisible to memory; concrete phrasing is not.

**In this product**: this is a narration-writing rule, not a visual one — it governs
`scripting.ts`'s output as much as the planner's. A script sentence that could
describe five different topics without modification is too abstract to be memorable
regardless of how it's illustrated.

### 8. The narrative/emotional hook

A short scenario, a stake, or a "why should I care" framing at the very top of a
video measurably increases both attention and downstream recall compared to opening
on a flat definition — this is why the existing titleCard convention (open with a
hook, not a dictionary entry) matters for more than pacing.

**In this product**: already a stated goal for the opening beat; Part II makes it an
explicit, checkable planner rule instead of an implicit stylistic preference.

### 9. Interleaving (when a topic is part of a series)

Mixing related-but-distinct concepts, rather than blocking many near-identical ones
back to back, improves the ability to later tell them apart — the actual failure mode
this fixes is a learner who "learned" 25 near-identical civics facts in a block and
can't reliably tell them apart a week later, because they were never asked to
discriminate between them during learning.

**In this product**: this is a *content-sequencing* decision (which topics get
grouped into which lesson, and in what order), not something one video does alone —
relevant when Shui/WG builds multi-video series or a "lesson path," out of scope for
a single on-demand video today. Recorded here so it isn't lost when that feature
gets designed.

---

## Part II — What's already built vs. what still needs building

Mapping each technique honestly against the current pipeline — some are already
structurally present (inherited from earlier decisions made for other reasons), some
need a real planner-prompt change, and one is out of scope until a later feature
exists.

| # | Technique | Status |
|---|-----------|--------|
| 1 | Retrieval practice | **Built** — `PLANNING_METHODOLOGY_RULES` requires the planner to identify the script's single most quiz-able fact and confirm a scene states it plainly; `SCRIPTWRITING_METHODOLOGY_RULES` requires the narration itself to state that fact in one self-contained, retrieval-ready sentence. |
| 2 | Spaced repetition | **Out of scope for WG** — lives in Shui's SM-2 system. WG's only obligation is narration/quiz wording consistency (see #1). |
| 3 | Dual coding | **Built, tightened** — `PLANNING_METHODOLOGY_RULES` adds the "muted viewer" test: an image only counts as dual coding if it depicts the exact claim in that scene's coversText, not a generic mood visual for the topic. |
| 4 | Segmenting/chunking | **Built** — `PLANNING_METHODOLOGY_RULES` calls out the concrete failure mode directly: a coversText span joined by "and" across two distinct claims must become two scenes, not one compound bullet/node label. |
| 5 | Signaling/cueing | **Built, and made compatible with the Phase 7 diagram library** — the rule reserves a sketchDiagram node's `emphasis` field (positive/negative/accentN, from `src/schema/diagram.ts`) and the `xMark`/`checkmark` decorations for the exact fact being cued, never for visual variety. This is the same ink-first, semantic-only color discipline the diagram library already enforces at the schema level (a node has no color unless emphasis is set) — Phase 6 just gives that mechanism its retention-purpose rule instead of leaving it a purely visual one. |
| 6 | Contrast/comparison | **Built, and mapped onto specific Phase 7 diagram kinds** — the rule tells the planner to reach proactively for a misconception → correction beat using the `comparison` node-sequence kind (one node emphasis:"positive", one "negative"), and explicitly rules out `venn` for this — venn is reserved for genuine set overlap, not a right/wrong pair, a distinction that only exists now that both kinds are real, separate options in the library. |
| 7 | Concrete framing | **Built** — `SCRIPTWRITING_METHODOLOGY_RULES` requires narration to name actual people/actions/objects instead of abstractions, in `scriptWriting.ts`'s prompt (narration generation happens before planning, so this rule has to live there, not in `planning.ts`). |
| 8 | Narrative hook | **Built, in both prompts** — `SCRIPTWRITING_METHODOLOGY_RULES` asks the narration itself to open on a stake rather than a definition; `PLANNING_METHODOLOGY_RULES` separately asks the planner to check the actual opening scene against that same standard, since a plan can still open flat even when the narration didn't. |
| 9 | Interleaving | **Out of scope** until a multi-video series/lesson-path feature exists. Recorded for that future design, not actionable today. |

**Implementation**: `src/schema/methodology.ts` — two exported prompt-text
constants, `PLANNING_METHODOLOGY_RULES` (spliced into `planning.ts`'s system
prompt) and `SCRIPTWRITING_METHODOLOGY_RULES` (spliced into `scriptWriting.ts`'s).
Covered by `tests/methodology.test.ts`, which asserts against the real
`buildSystemPrompt()` output of both files, not just the constants in isolation —
so a future edit that forgets to splice the block into the actual prompt fails a
test instead of silently doing nothing.

## What this document is not

Not a template-design document (that's the design-system doc); not a quiz-schema
document (that's `quizGeneration.ts` and the phase-07 Shui-side spec); not a
prescription to use all nine techniques in every video — technique 2 and 9 are
explicitly out of scope today, and even among 1/3/4/5/6/7/8, a given topic won't
always have a natural misconception to contrast (6) or a natural narrative stake (8).
The planner should reach for whichever techniques a given script's actual content
supports, not force all of them onto every topic.

## Verify

1. A real narration script, read cold, states its central fact concretely enough
   that a person could write a fair quiz question from the narration alone (tests
   #1 and #7 together).
2. For a topic with a well-known misconception, the planner reaches for a
   contrast/comparison beat without being told to for that specific topic (tests #6
   as a standing habit, not a one-off).
3. Every scene's narration covers exactly one fact — a scene whose narration
   sentence contains "and" joining two distinct claims is a planner failure (tests
   #4).
4. At least one decoration per video is placed with a stated "this cues the fact
   being tested" reason, not a generic "adds energy" reason (tests #5).
5. The opening beat of a real render is judged, by the product owner, to state a
   stake or a "why does this matter" framing before it states the topic's dry
   definition (tests #8).

## Out of scope

Spaced-repetition scheduling (Shui's job); multi-video series/lesson-path sequencing
(technique #9 — a future feature); any visual/template work (the design-system doc's
domain); A/B testing actual retention outcomes against real users (this document is
built from established learning-science research, not yet validated against this
product's own users — that validation is a legitimate future project, not something
to claim already done).
