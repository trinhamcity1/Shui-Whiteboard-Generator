/**
 * Phase 6 — the code implementation of shui-wg-phase-06-teaching-methodology.md.
 * That document is the contract (what the nine techniques are, why they work,
 * which ones apply to WG); this file is where the still-unbuilt rows of its
 * Part II table become actual prompt text, the same relationship
 * sketchStyle.ts has to the design-system doc and diagram.ts has to the
 * phase-07 doc. When the methodology doc changes, this file changes with it
 * — never the reverse.
 *
 * Two exports, one per prompt this methodology governs:
 * - PLANNING_METHODOLOGY_RULES: spliced into planning.ts's system prompt.
 *   Covers the techniques that are about STRUCTURE and VISUAL CHOICE —
 *   retrieval practice, dual coding (tightened), chunking, signaling,
 *   contrast, the narrative hook.
 * - SCRIPTWRITING_METHODOLOGY_RULES: spliced into scriptWriting.ts's system
 *   prompt. Covers the techniques that are about WORDING — concrete framing,
 *   and the narrative hook again (it governs the opening sentence of the
 *   narration itself, before the planner ever sees it).
 *
 * Techniques 2 (spaced repetition) and 9 (interleaving) are out of scope per
 * the doc and have no rules here — see the doc's Part I for why.
 */

export const PLANNING_METHODOLOGY_RULES = `Teaching & retention rules (shui-wg-phase-06-teaching-methodology.md — read that
document for why each of these works; this is the enforceable version):
- RETRIEVAL PRACTICE (#1): before finalizing the plan, identify the single most
  important, most quiz-able fact in the script. Make sure at least one scene states
  it plainly enough — in its coversText AND its on-screen content — that a person
  who only saw that scene could answer a fair quiz question about it afterward.
  Don't bury the core fact inside a compound bullet or a crowded comparisonCards
  list where it's one of six equally-weighted items with no visual priority.
- DUAL CODING, TIGHTENED (#3): "default to an image" (below) gets you an
  illustration on screen; that alone isn't dual coding. The image must depict the
  EXACT claim in that scene's coversText, not a generic mood-setting visual for the
  general topic. Test: if a viewer saw only the image, muted, could they guess the
  specific claim being made? An attractive but generic illustration (a courtroom
  when the claim is specifically about a judge's sentencing power) fails this even
  though "an image exists."
- CHUNKING (#4): one scene, one fact. If a span of coversText joins two distinct
  claims with "and" ("Congress writes the law and the President enforces it"),
  that is two scenes, not one — give each claim its own action rather than
  cramming both into a single bulletList item or a single sketchDiagram node
  label. A node/bullet whose label is really two facts stitched together is a
  chunking failure, not a compact one.
- SIGNALING / CUEING, WITH A PURPOSE (#5): a decoration or a sketchDiagram node's
  "emphasis" earns its place only by cueing the ONE fact this scene wants
  remembered — never "for energy" or visual variety. Concretely: reserve
  "emphasis":"positive"/"negative" for the exact claim the narration states is
  right/wrong at that moment, not for whichever node looks like it needs color;
  reserve an "xMark"/"checkmark" decoration for that same correctness moment, not
  as generic scene decoration. If you can't state which specific fact a
  decoration or emphasis value is cueing, leave it off.
- CONTRAST (#6): when the script's topic has a natural, well-known misconception
  ("people think X, but actually Y"), reach for it proactively — don't wait to be
  told. The "comparison" sketchDiagram kind (2 nodes, one emphasis:"negative" for
  the misconception and one emphasis:"positive" for the correction) or a
  misconception -> correction narration beat both implement this. A "venn"
  diagram is the wrong tool for a misconception contrast — venn is for genuine
  set overlap, not a right/wrong pair; use "comparison" for that.
- THE NARRATIVE HOOK (#8): the opening scene should give the viewer a stake or a
  "why does this matter" framing before it states the topic's dry definition —
  a titleCard that reads like a dictionary entry ("Federalism: a system of
  government...") is a weaker opener than one that opens on the tension or
  consequence the rest of the video resolves. Check the actual opening beat
  against this before finalizing the plan, not just as a general aspiration.`;

export const SCRIPTWRITING_METHODOLOGY_RULES = `Teaching & retention rules (shui-wg-phase-06-teaching-methodology.md):
- CONCRETE, SPECIFIC FRAMING (#7): prefer concrete, imageable phrasing over
  abstraction. "The government has three branches" is abstract; "Congress writes
  the law, the President enforces it, the Courts decide if it's fair" is
  concrete — same fact, but the second gives a listener something specific to
  picture and remember. If a sentence you've written could describe five
  different topics without changing a word, it's too abstract — make it name
  the actual people, actions, or objects involved.
- RETRIEVAL-READY PHRASING (#1): state the script's central fact plainly, in one
  self-contained sentence, somewhere in the script — worded so a listener who
  heard only that sentence could answer a direct question about it. Don't require
  a listener to piece the core fact together across several fragments.
- THE NARRATIVE HOOK (#8): open on a stake, a scenario, or a "why should I care"
  framing — not a flat definition of the topic. A script that opens "X is a
  concept in Y that means Z" is weaker than one that opens on the situation or
  consequence the topic actually resolves.`;
