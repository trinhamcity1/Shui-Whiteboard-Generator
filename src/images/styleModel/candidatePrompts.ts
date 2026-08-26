/**
 * Candidate subjects for style-model training.
 *
 * Revision 3 (the design-system pass, Phase 4 Revision 3): rewritten to
 * the product owner's art-direction spec. The prior "warm painterly
 * storybook" style (soft gouache, ochre/terracotta/sage) is retired — the
 * target is now Golpo's look: off-white paper, confident near-black ink,
 * flat streaky marker fill, selective bright color. See Part I of the
 * revision-3 doc for the full spec this file implements.
 *
 * Two registers, one hand (Part I §4): "clean" (diagrams, icons, props,
 * simple character beats — the default, most of every video) and "rich"
 * (dense full-canvas narrative tableaus — one or two hero frames per
 * video). They share every ink/anatomy/palette clause verbatim; only
 * density and color-temperature language differs. A handful of subjects
 * are deliberately generated in BOTH registers (paired via `pairId`) so
 * curation can run the doc's own acceptance test: the same character/scene
 * across registers must read as one artist's work, or the pair fails.
 */

// Subject FIRST, style short and concentrated after — a real prompt-
// following failure was hit and root-caused building this file: an
// earlier version put ~120 words of style clauses before the subject
// ever appeared, and Flux Schnell's CLIP conditioning (a short token
// window, weighted toward the start of the prompt) apparently never
// reached the subject at all — every candidate came back as a generic
// multi-face group-portrait collage in plain B&W lineart, completely
// ignoring both the requested subject and the color palette. Keeping the
// whole prompt short (subject + a compact style tag list, no long
// prose clauses) and subject-first fixed it. Validated with a fresh
// small batch before spending on the full candidate run — same
// discipline as the original vignette-defect fix.
// Revision 4 (the "too yellowish" fix): the shareholder's read on revision
// 3's actual generated output was that it looked warm/vintage/parchment,
// not like a modern educator product — traced to two literal phrases in
// this file ("off-white paper background" and the rich register's
// "earth-tone... parchment... walnut brown" clause) that were baking a
// warm cast into every single generation. Same short, subject-first prompt
// discipline as before (see the comment above) — only the color words
// change, cool instead of warm; the structure that fixed the CLIP-
// conditioning failure stays untouched.
export const SHARED_STYLE =
  "whiteboard marker drawing, cool white paper background, no vignette, no gradient shading, no soft " +
  "rendering, confident thick near-black ink outline, hand-drawn wobble not geometric, mostly UNCOLORED " +
  "black-and-white line art with only ONE or TWO small flat color accents (not full color, not painted, " +
  "not shaded, no gradients on the color itself — solid flat marker color only), simple cartoon face, no " +
  "text, no lettering, no watermark";

const CLEAN_REGISTER_STYLE =
  "mostly black ink linework on plain paper, but ALWAYS include one clearly visible flat marker color area " +
  "(blue, teal, or green — pick one) on a meaningful part of the subject, like clothing or a highlighted " +
  "detail — not fully colored, not shaded, just confident ink plus that one flat color region";

const RICH_REGISTER_STYLE =
  "full-canvas scene, still mostly ink linework, flat cool-tone color accents only (navy, teal, slate blue, deep plum, cool gray), no shading gradients, restrained single-direction hatch lines instead of shading for depth";

type Register = "clean" | "rich";

export interface CandidatePromptSpec {
  subject: string;
  prompt: string;
  register: Register;
  /** Set on both halves of a same-subject cross-register pair (Part I §4's acceptance test). */
  pairId?: string;
}

function buildPrompt(register: Register, description: string): string {
  const registerClause = register === "clean" ? CLEAN_REGISTER_STYLE : RICH_REGISTER_STYLE;
  return `${description}. Style: ${SHARED_STYLE}, ${registerClause}.`;
}

function spec(label: string, description: string, register: Register, pairId?: string): CandidatePromptSpec {
  return { subject: label, prompt: buildPrompt(register, description), register, pairId };
}

// ---------------------------------------------------------------------
// Clean-register subject pools
// ---------------------------------------------------------------------

// Interaction poses (Part I §7) alongside the original standing/gesturing
// set — a character library that can only stand next to things, not touch
// them, undershoots the reference frames (holding documents, gesturing at
// diagrams, standing on steps).
const CHARACTER_SUBJECTS: Array<{ label: string; description: string }> = [
  { label: "narrator, explaining", description: "a friendly narrator character, one hand raised mid-explanation, facing forward" },
  { label: "narrator, pointing", description: "a friendly narrator character pointing off to the side, three-quarter view" },
  { label: "narrator, thinking", description: "a friendly narrator character with a hand on their chin, thoughtful expression" },
  { label: "narrator, celebrating", description: "a friendly narrator character smiling with arms raised in celebration" },
  { label: "narrator, holding a document", description: "a friendly narrator character holding up an open document in both hands, reading from it with an engaged expression" },
  { label: "narrator, gesturing at a diagram", description: "a friendly narrator character standing three-quarter view, one arm extended as if presenting a diagram beside them" },
  { label: "teacher at a desk", description: "a warm, approachable teacher character seated at a small desk" },
  { label: "professional, standing", description: "a professional-casual adult character standing, arms relaxed at their sides" },
  { label: "student, reading", description: "a young student character reading an open book" },
  { label: "official figure, addressing", description: "a formally dressed official character mid-address, one arm gesturing outward, confident expression" },
  { label: "official figure, saluting", description: "a formally dressed official character in a respectful salute pose" },
  { label: "official figure, reacting", description: "a formally dressed official character with a surprised, wide-eyed expression, both hands raised slightly" },
  { label: "judge, mid-gavel-swing", description: "a smiling judge character in a black robe, caught mid-motion swinging a gavel down, dynamic pose" },
  { label: "detective, mid-thought", description: "a detective character with a hand at their chin, one eyebrow raised, thinking expression, mid-stride" },
  { label: "citizen, casting a vote", description: "an everyday adult character placing a folded paper into a slotted box" },
  { label: "elder figure, explaining", description: "a warm elder character gesturing while explaining something, kind expression" },
  { label: "child, curious", description: "a small child character looking up with wide, curious eyes" },
  { label: "character, standing on steps", description: "an adult character standing confidently on a set of stone steps, one foot forward, addressing an unseen crowd" },
  { label: "character, reacting with thought bubble gesture", description: "an adult character with a surprised expression, one hand near their head as if a thought just occurred to them" },
];

// Small, high-contrast objects meant to read clearly at icon scale — for
// Workstream 3's inset illustrations (a pyramid tier holding a small icon
// alongside its label, a building carrying a name on its frieze).
const ICON_SUBJECTS: Array<{ label: string; description: string }> = [
  { label: "icon: small flag", description: "a small simple flag on a short pole, icon-scale, bold silhouette, minimal interior detail" },
  { label: "icon: small scale of justice", description: "a small scales-of-justice icon, symmetric, bold silhouette" },
  { label: "icon: small coin", description: "a small round coin icon with a simple embossed symbol" },
  { label: "icon: small star", description: "a small five-pointed star icon, bold outline, flat fill" },
  { label: "icon: small shield", description: "a small heraldic shield icon, bold silhouette, minimal interior detail" },
  { label: "icon: small book", description: "a small closed book icon, bold silhouette" },
  { label: "icon: small leaf", description: "a small single leaf icon, simple bold shape" },
  { label: "icon: small key", description: "a small old-fashioned key icon, bold silhouette" },
];

const PROP_SUBJECTS: Array<{ label: string; description: string }> = [
  { label: "checkmark", description: "a bold hand-drawn checkmark symbol" },
  { label: "arrow", description: "a curved directional arrow" },
  { label: "lightbulb", description: "a glowing lightbulb, idea symbol" },
  { label: "open book", description: "an open storybook, flat marker fill on the pages" },
  { label: "clock", description: "a simple round clock face" },
  { label: "bar chart", description: "a small bar chart with three bars" },
  { label: "magnifying glass", description: "a magnifying glass" },
  { label: "gear", description: "a single mechanical gear" },
  { label: "ballot box", description: "a wooden ballot box with a coin slot" },
  { label: "government building", description: "a small domed government building with columns, front-facing" },
  { label: "gavel", description: "a wooden judge's gavel resting on its sound block" },
  { label: "scroll", description: "an unrolled parchment scroll" },
  { label: "scroll with red seal", description: "an unrolled parchment scroll with a red wax seal at the bottom" },
  { label: "signpost", description: "a wooden signpost with two blank arrow signs" },
  { label: "briefcase", description: "a simple leather briefcase" },
  { label: "map", description: "a folded paper map" },
];

const DIAGRAM_SUBJECTS: Array<{ label: string; description: string }> = [
  { label: "empty box", description: "a single rounded rectangular box, empty" },
  { label: "two boxes + arrow", description: "two rounded boxes side by side connected by a curved arrow pointing from the left box to the right box" },
  { label: "three-box flowchart", description: "three rounded boxes in a row, each connected to the next by a short arrow" },
  { label: "comparison boxes", description: "two rounded boxes side by side with a small circular \"vs\" divider shape between them" },
  { label: "box with incoming arrow", description: "a rounded box with a bold arrow pointing into it from the left side" },
  { label: "label banner", description: "a small ribbon-shaped banner with forked ends, empty, ready for a label" },
  { label: "box with text: START", description: "a rounded box with the word \"START\" hand-lettered inside it" },
  { label: "box with text: YES", description: "a rounded box with the word \"YES\" hand-lettered inside it" },
];

// ---------------------------------------------------------------------
// Rich-register full-scene tableaus (Part I §4 — hero frames)
// ---------------------------------------------------------------------

const RICH_SCENE_SUBJECTS: Array<{ label: string; description: string }> = [
  { label: "scene: city under siege", description: "a historical city skyline with visible flames and smoke, soldiers in silhouette in the foreground, dramatic wide tableau" },
  { label: "scene: crowd of rulers", description: "a crowd of a dozen robed historical rulers standing shoulder to shoulder, varied expressions and poses, wide group tableau" },
  { label: "scene: marching legion", description: "a column of armored soldiers marching in formation carrying a standard topped with an eagle, side view, dynamic composition" },
  { label: "scene: crumbling monument", description: "a large stone monument cracking apart and toppling, small reacting figures scattered around its base looking up in alarm" },
  { label: "scene: two armies facing off", description: "two opposing groups of armored figures facing each other across an open field, symmetric composition, tense standoff" },
  { label: "scene: council chamber", description: "a wide interior tableau of robed figures seated in a semicircular stone council chamber, one figure standing and gesturing" },
  { label: "scene: harbor at dusk", description: "a historical harbor scene with ships, warm dusk lighting rendered as flat color blocks, figures loading cargo" },
  { label: "scene: fallen banner", description: "a torn and fallen banner draped over broken stone steps, a single mourning figure kneeling beside it, dramatic empty space around" },
];

// ---------------------------------------------------------------------
// Same-subject cross-register pairs — the §4 acceptance test needs these
// to actually be checkable: the same subject, once per register.
// ---------------------------------------------------------------------

const PAIR_SUBJECTS: Array<{ pairId: string; label: string; clean: string; rich: string }> = [
  {
    pairId: "pair-narrator",
    label: "narrator, explaining",
    clean: "a friendly narrator character, one hand raised mid-explanation, facing forward, plain paper background",
    rich: "the same friendly narrator character, one hand raised mid-explanation, now standing at the edge of a fuller historical council-chamber scene with other robed figures seated behind them",
  },
  {
    pairId: "pair-judge",
    label: "judge, gavel",
    clean: "a smiling judge character in a black robe, mid-motion swinging a gavel down, plain paper background",
    rich: "the same judge character in a black robe, mid-motion swinging a gavel down, now standing at a raised stone bench inside a fuller courtroom tableau with onlookers in the background",
  },
  {
    pairId: "pair-building",
    label: "government building",
    clean: "a small domed government building with columns, front-facing, plain paper background",
    rich: "the same domed government building with columns, now part of a fuller city skyline tableau at dusk with small figures on its steps",
  },
  {
    pairId: "pair-officer",
    label: "official figure, addressing",
    clean: "a formally dressed official character mid-address, one arm gesturing outward, plain paper background",
    rich: "the same formally dressed official character mid-address, one arm gesturing outward, now addressing a small crowd of reacting figures in a fuller public-square tableau",
  },
];

// ---------------------------------------------------------------------

/**
 * Builds `count` candidate prompts spanning both registers, roughly a
 * 60% clean / 40% rich split (Workstream 1 step 2). Same-subject pairs are
 * seeded first (both halves always included together) so a fixed-size
 * batch always contains the cross-register acceptance-test material;
 * the remainder cycles through the clean pools (characters, icons, props)
 * and the rich scene pool at the target ratio.
 */
export function buildCandidatePrompts(count: number): CandidatePromptSpec[] {
  const specs: CandidatePromptSpec[] = [];

  for (const pair of PAIR_SUBJECTS) {
    if (specs.length >= count) break;
    specs.push(spec(`${pair.label} (clean)`, pair.clean, "clean", pair.pairId));
    if (specs.length < count) specs.push(spec(`${pair.label} (rich)`, pair.rich, "rich", pair.pairId));
  }

  const cleanPools = [CHARACTER_SUBJECTS, ICON_SUBJECTS, PROP_SUBJECTS];
  let cleanPoolIdx = 0;
  let cleanEntryIdx = 0;
  let richEntryIdx = 0;

  while (specs.length < count) {
    // Target ~60/40 clean/rich by checking the running ratio so far.
    const cleanCount = specs.filter((s) => s.register === "clean").length;
    const richCount = specs.filter((s) => s.register === "rich").length;
    const wantClean = cleanCount === 0 || cleanCount / (cleanCount + richCount) < 0.6;

    if (wantClean) {
      const pool = cleanPools[cleanPoolIdx % cleanPools.length]!;
      const entry = pool[cleanEntryIdx % pool.length]!;
      specs.push(spec(entry.label, entry.description, "clean"));
      cleanEntryIdx++;
      if (cleanEntryIdx % pool.length === 0) cleanPoolIdx++;
    } else {
      const entry = RICH_SCENE_SUBJECTS[richEntryIdx % RICH_SCENE_SUBJECTS.length]!;
      specs.push(spec(entry.label, entry.description, "rich"));
      richEntryIdx++;
    }
  }

  return specs.slice(0, count);
}

/** A batch drawn entirely from the diagram-frame pool (boxes, arrows, labels) — clean register only. */
export function buildDiagramCandidatePrompts(count: number): CandidatePromptSpec[] {
  const specs: CandidatePromptSpec[] = [];
  for (let i = 0; i < count; i++) {
    const entry = DIAGRAM_SUBJECTS[i % DIAGRAM_SUBJECTS.length]!;
    specs.push(spec(entry.label, entry.description, "clean"));
  }
  return specs;
}
