import type { AssetManifestEntry } from "./types";

/** Plain-language description of a manifest entry — used both for the
 * planner's asset catalog and for Layer 2's semantic near-match search. */
export function describeManifestEntry(entry: AssetManifestEntry): string {
  if (entry.role === "character") return `${entry.pose} (${entry.attire})`;
  return entry.description ?? entry.id;
}

// The v1 library manifest — matches the amendment doc's §1/§2 asset tables.
// Three entries are flagged isTest: true (one Tier-1 character, one Tier-1
// prop, one Tier-2 character) — generate and review these against the
// Golpo reference first (amendment §8, step 1) before running the full
// batch. Voter is grouped with "props" in the doc's rough cost math even
// though it's a character role — Flux, single-use, no pose-consistency need.

const NARRATOR_ATTIRE = "wearing simple neutral professional-casual clothing (a collared shirt, no logos)";

export const ASSET_MANIFEST: AssetManifestEntry[] = [
  // ── Tier 1: shared library ────────────────────────────────────────────
  {
    id: "narrator-explaining",
    characterFamily: "narrator",
    tier: "shared",
    role: "character",
    provider: "recraft",
    pose: "explaining, one hand raised, palm open",
    direction: "forward, facing the viewer",
    attire: NARRATOR_ATTIRE,
    isTest: true,
  },
  {
    id: "narrator-pointing",
    characterFamily: "narrator",
    tier: "shared",
    role: "character",
    provider: "recraft",
    pose: "pointing to the side with one hand",
    direction: "three-quarters, slightly turned",
    attire: NARRATOR_ATTIRE,
  },
  {
    id: "narrator-thinking",
    characterFamily: "narrator",
    tier: "shared",
    role: "character",
    provider: "recraft",
    pose: "thinking, one hand near the chin",
    direction: "three-quarters, slightly turned",
    attire: NARRATOR_ATTIRE,
  },
  {
    id: "narrator-celebrating",
    characterFamily: "narrator",
    tier: "shared",
    role: "character",
    provider: "recraft",
    pose: "celebrating, both arms raised with a big smile",
    direction: "forward, facing the viewer",
    attire: NARRATOR_ATTIRE,
  },
  // Phase 5, Universal tier: rounding the existing narrator identity out
  // to 7 poses (was 4) — the doc's own target per identity, before adding
  // more identities in a later pass.
  {
    id: "narrator-gesturing-aside",
    characterFamily: "narrator",
    tier: "shared",
    role: "character",
    provider: "recraft",
    pose: "gesturing toward something beside them with an open hand, inviting the viewer to look",
    direction: "three-quarters, slightly turned",
    attire: NARRATOR_ATTIRE,
  },
  {
    id: "narrator-questioning",
    characterFamily: "narrator",
    tier: "shared",
    role: "character",
    provider: "recraft",
    pose: "shrugging with both palms turned up, a questioning expression",
    direction: "forward, facing the viewer",
    attire: NARRATOR_ATTIRE,
  },
  {
    id: "narrator-confident",
    characterFamily: "narrator",
    tier: "shared",
    role: "character",
    provider: "recraft",
    // Simplified after a real generation came back as two disconnected
    // figures on one canvas (a giant head at the top, a tiny full body at
    // the bottom) — "nodding" combined with "agreeing" plus arms-crossed
    // may have read as two separate beats to compose instead of one pose.
    pose: "standing with arms crossed, a confident, self-assured expression",
    direction: "three-quarters, slightly turned",
    attire: NARRATOR_ATTIRE,
  },
  {
    id: "prop-checkmark",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a bold green checkmark inside a rounded circle",
    isTest: true,
  },
  {
    id: "prop-arrow",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a bold curved arrow pointing right",
  },
  {
    id: "prop-lightbulb",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a glowing yellow lightbulb, idea icon",
  },
  {
    id: "prop-book",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a closed hardcover book, viewed from a slight angle",
  },
  {
    id: "prop-clock",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple round analog clock face",
  },
  {
    id: "prop-bar-chart",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple ascending bar chart with three bars",
  },
  {
    id: "prop-magnifying-glass",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a magnifying glass, angled handle toward the bottom-left",
  },
  {
    id: "prop-gear",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a single mechanical gear, viewed straight-on",
  },
  // Phase 5, Universal tier: broadening generic props from 8 toward the
  // doc's ~60 target — everyday concepts common across essentially any
  // explainer topic, not tied to one vertical.
  {
    id: "prop-calendar",
    tier: "shared",
    role: "prop",
    provider: "flux",
    // "one date circled in red" invited the model to try rendering real
    // numerals/month text, which came back garbled ("Shinter - 18") on a
    // real batch — describing the grid abstractly instead of asking for
    // legible text avoids that failure mode entirely.
    description:
      "a simple desk calendar page showing a grid of small squares representing days, with one square circled in red — no legible numbers or text, the grid is purely graphical",
  },
  {
    id: "prop-envelope",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a closed envelope, viewed at a slight angle",
  },
  {
    id: "prop-handshake",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "two hands shaking, viewed from the side, no visible faces or bodies",
  },
  {
    id: "prop-dollar-sign",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a bold dollar sign inside a rounded circle",
  },
  {
    id: "prop-globe",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple globe showing continents, viewed straight-on",
  },
  {
    id: "prop-smartphone",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple smartphone with a blank screen, viewed straight-on",
  },
  {
    id: "prop-laptop",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "an open laptop computer with a blank screen, viewed at a slight angle",
  },
  {
    id: "prop-shield",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple shield shape, front-facing, representing protection or security",
  },
  {
    id: "prop-target",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a bullseye target with an arrow in the center ring",
  },
  {
    id: "prop-trophy",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple trophy cup on a small base, viewed straight-on",
  },
  {
    id: "prop-question-mark",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a bold question mark inside a rounded circle",
  },
  {
    id: "prop-exclamation-mark",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a bold exclamation mark inside a rounded triangle, warning style",
  },
  {
    id: "prop-thumbs-up",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a single thumbs-up hand gesture, no visible arm or body",
  },
  {
    id: "prop-pie-chart",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple pie chart divided into three colored slices",
  },
  {
    id: "prop-map-pin",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a single map location pin, teardrop shape with a dot in the center",
  },
  {
    id: "prop-house",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple house silhouette with a triangular roof and one door",
  },
  {
    id: "prop-plant-growth",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a small plant sprouting from soil, symbolizing growth",
  },
  {
    id: "prop-scale-balance",
    tier: "shared",
    role: "prop",
    provider: "flux",
    // The vague original description came back as an unrecognizable
    // bowl-on-a-stand shape — spelling out the actual mechanical parts
    // (two pans, chains, a beam, a central post) gives the model
    // something concrete to draw instead of guessing at "a scale."
    description:
      "a classic justice scale: two flat round pans hanging from chains at each end of a horizontal beam balanced evenly on a single central post",
  },
  {
    id: "prop-key",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a single old-fashioned key, viewed from the side",
  },
  {
    id: "prop-lock",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple padlock, closed, viewed straight-on",
  },
  {
    id: "prop-megaphone",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a simple megaphone, viewed from the side, pointed left",
  },
  {
    id: "prop-puzzle-piece",
    tier: "shared",
    role: "prop",
    provider: "flux",
    description: "a single jigsaw puzzle piece, viewed straight-on",
  },

  // ── Tier: business vertical ───────────────────────────────────────────
  // Phase 5's first Vertical-tier entry (of the doc's proposed five) —
  // proves the pattern before expanding to education/health/tech/finance.
  // Reuses the narrator character family rather than inventing a new
  // identity — a business-context POSE on the same recognizable narrator
  // is enough to serve this vertical; a dedicated identity is the kind of
  // thing to add later if usage shows it's actually needed.
  {
    id: "business-narrator-presenting",
    characterFamily: "narrator",
    tier: "business",
    role: "character",
    provider: "recraft",
    pose: "presenting, gesturing toward a chart or screen beside them",
    direction: "three-quarters, slightly turned",
    attire: NARRATOR_ATTIRE,
  },
  {
    id: "business-narrator-at-desk",
    characterFamily: "narrator",
    tier: "business",
    role: "character",
    provider: "recraft",
    pose: "seated at a desk, one hand on a laptop, looking up at the viewer",
    direction: "forward, facing the viewer",
    attire: NARRATOR_ATTIRE,
  },
  {
    id: "business-prop-briefcase",
    tier: "business",
    role: "prop",
    provider: "flux",
    description: "a simple leather briefcase, viewed at a slight angle",
  },
  {
    id: "business-prop-growth-chart",
    tier: "business",
    role: "prop",
    provider: "flux",
    description: "a line chart trending upward with an arrow at the top-right end",
  },
  {
    id: "business-prop-office-building",
    tier: "business",
    role: "prop",
    provider: "flux",
    description: "a simple modern office building with rows of windows",
  },
  {
    id: "business-prop-contract",
    tier: "business",
    role: "prop",
    provider: "flux",
    // "a signature line" invited the model to render actual cursive
    // text, which came back as garbled fake handwriting on a real batch
    // — a squiggle reads as "a signature" without asking for real,
    // legible letters the model can't reliably produce.
    description: "a document with a wavy squiggle line (not real letters) where a signature would go, and a pen resting on it",
  },
  {
    id: "business-prop-coin-stack",
    tier: "business",
    role: "prop",
    provider: "flux",
    description: "a stack of coins, viewed from the side",
  },
  {
    id: "business-prop-meeting-table",
    tier: "business",
    role: "prop",
    provider: "flux",
    description: "a simple oval conference table with empty chairs around it, viewed from above at an angle",
  },
  {
    id: "business-prop-inbox",
    tier: "business",
    role: "prop",
    provider: "flux",
    description: "a simple inbox tray stacked with a few papers",
  },
  {
    id: "business-prop-deadline-calendar",
    tier: "business",
    role: "prop",
    provider: "flux",
    // Same fix as prop-calendar: describe the grid abstractly instead of
    // asking for legible dates, which came back as garbled text before.
    description:
      "a wall calendar showing a grid of small squares representing days, with one square circled in red and a bold exclamation mark beside it — no legible numbers or text",
  },

  // ── Tier 2: civics subset ─────────────────────────────────────────────
  {
    id: "civics-judge-explaining",
    characterFamily: "civics-judge",
    tier: "civics",
    role: "character",
    provider: "recraft",
    pose: "explaining, one hand raised, palm open",
    direction: "forward, facing the viewer",
    attire: "wearing a black judge's robe",
    isTest: true,
  },
  {
    id: "civics-judge-gavel-down",
    characterFamily: "civics-judge",
    tier: "civics",
    role: "character",
    provider: "recraft",
    pose: "mid-motion bringing a gavel down onto a sound block",
    direction: "three-quarters, slightly turned",
    attire: "wearing a black judge's robe",
  },
  {
    id: "civics-officer-explaining",
    characterFamily: "civics-officer",
    tier: "civics",
    role: "character",
    provider: "recraft",
    pose: "explaining, one hand raised, palm open",
    direction: "forward, facing the viewer",
    attire: "wearing a simple police-style uniform with a badge",
  },
  {
    id: "civics-officer-saluting",
    characterFamily: "civics-officer",
    tier: "civics",
    role: "character",
    provider: "recraft",
    pose: "saluting",
    direction: "forward, facing the viewer",
    attire: "wearing a simple police-style uniform with a badge",
  },
  {
    id: "civics-voter-casting-ballot",
    tier: "civics",
    role: "character",
    provider: "flux",
    pose: "placing a folded paper ballot into a ballot box slot",
    direction: "three-quarters, slightly turned",
    attire: "wearing simple neutral everyday clothing",
  },
  {
    id: "civics-prop-ballot-box",
    tier: "civics",
    role: "prop",
    provider: "flux",
    description: "a wooden ballot box with a slot in the lid, viewed at a slight angle",
  },
  {
    id: "civics-prop-government-building",
    tier: "civics",
    role: "prop",
    provider: "flux",
    description: "a simple government building with classical columns and a dome",
  },
  {
    id: "civics-prop-gavel",
    tier: "civics",
    role: "prop",
    provider: "flux",
    description: "a wooden judge's gavel and sound block, standalone, not held by anyone",
  },
  {
    id: "civics-prop-constitution-scroll",
    tier: "civics",
    role: "prop",
    provider: "flux",
    description: "a rolled and partially unfurled parchment scroll with a red wax seal",
  },
];
