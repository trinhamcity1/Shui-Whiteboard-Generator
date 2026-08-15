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
