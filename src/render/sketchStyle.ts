import { staticFile } from "remotion";

/**
 * Central style reference for the rough.js/sketch-diagram system, the
 * decoration library, and every composition template — every visual
 * choice pulls its colors, line quality, and font from here instead of
 * hardcoding its own values. The point: one place to tune "does this look
 * like Golpo" instead of re-tuning a dozen components that have quietly
 * drifted apart.
 *
 * Revision 3 (the design-system pass): these are the *working* target
 * values from the product owner's art-direction spec (Phase 4 Revision 3,
 * Part I) — off-white paper, near-black confident ink, one unified
 * two-temperature-group marker palette. They get sampled and locked from
 * the actual shareholder-approved curated candidate set at the
 * Workstream 1 sign-off gate; until then these are the best-known target,
 * not yet the final locked palette.
 */

export const SKETCH_COLORS = {
  ink: "#1d1d1b",
  paper: "#faf8f3",
  panelFill: "#ffffff",
  // "Bright" group — the explanation register (diagrams, icons, clean
  // scenes). Selective, not a wash: most of the canvas stays ink-on-paper.
  bright: {
    blue: "#54b8e5",
    pink: "#f07ea8",
    orange: "#f49b4a",
  },
  // "Earth" group — the rich/narrative register (hero tableaus).
  earth: {
    terracotta: "#c96f4a",
    olive: "#8a8b4e",
    parchment: "#e8d9b0",
    walnut: "#7a5230",
    stoneGray: "#b9b4a8",
  },
  // Shared across both registers.
  signalRed: "#e03c31", // X marks, urgency arrows, seals, dropcaps — never a large fill
  leafGreen: "#7cb65c", // ground tufts, bushes
  // Named so a pyramid/tier diagram always reads the same three colors in
  // the same order, the way "Federal blue / State pink / Local orange"
  // does in the Golpo reference. Drawn from the bright group.
  tierPalette: ["#54b8e5", "#f07ea8", "#f49b4a"],
  // Kept for any caller still on the pre-revision-3 name — same red family
  // as signalRed, used for connective arrows specifically.
  accentArrow: "#e03c31",
} as const;

/**
 * Line weight is hierarchical, not uniform — thick for silhouettes and
 * title lettering, medium for interior detail, thin for texture (hatching,
 * fabric folds). This is what makes a frame read instantly at phone size
 * (Part I §2). `roughness`/`bowing` stay shared across weights so every
 * stroke still looks like the same hand, just a different pen width.
 */
export const SKETCH_LINE = {
  roughness: 1.6,
  bowing: 1.2,
  strokeWidth: 3, // medium — interior detail, the previous single-weight default
  strokeWidthThick: 5, // silhouettes, title lettering, primary shape outlines
  strokeWidthThin: 1.5, // texture/hatching, secondary detail
  strokeWidthHairline: 1, // small filled shapes (arrowheads, xMark/checkmark ticks) — a visible stroke width would read as a border, not an outline
  fillStyle: "solid" as const,
  // A tighter roughness than the shared default for the same small filled
  // shapes above — at their size, the standard roughness reads as a
  // shapeless blob rather than a crisp mark.
  roughnessTight: 1.3,
  // Rich-register-only restrained single-direction hatching (Part I §3) —
  // never dense crosshatch, which turns muddy at phone/reel size.
  hatchAngle: 45,
  hatchGap: 10,
};

export const SKETCH_LAYOUT = {
  ribbonNotchRatio: 0.14, // notch depth as a fraction of ribbon width
  /** A standing character's height as a fraction of the diagram it's placed beside (e.g. the pyramid's tier stack). */
  characterToPyramidHeightRatio: 0.85,
  /** A standing character's height as a fraction of a backdrop building's height — a building reads as multiple stories, a character as one. */
  characterToBuildingHeightRatio: 0.4,
};

/**
 * The hand-lettered marker font every label/title should use. Self-hosted
 * from public/fonts/ rather than pulled from the Google Fonts CDN at
 * render time — @remotion/google-fonts' network loader fails inside this
 * environment's headless-Chromium sandbox (its cert trust store doesn't
 * include the outbound proxy's CA), and a self-hosted font removes that
 * network dependency from every future render anyway, not just this one.
 */
export const SKETCH_FONT_FAMILY = "Permanent Marker";
const SKETCH_FONT_URL = staticFile("fonts/PermanentMarker-Regular.woff2");

export const sketchFontFaceCss = `
@font-face {
  font-family: '${SKETCH_FONT_FAMILY}';
  src: url('${SKETCH_FONT_URL}') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`;

let fontLoadPromise: Promise<void> | null = null;

/** Resolves once the font is actually registered and usable — call before the first rough.js draw so text metrics (used for layout) are correct on frame one. */
export function waitForSketchFont(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      const face = new FontFace(SKETCH_FONT_FAMILY, `url(${SKETCH_FONT_URL})`);
      const loaded = await face.load();
      // TS's lib.dom FontFaceSet type doesn't expose `.add` in this
      // project's lib config even though it's a real browser API.
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(loaded);
    })();
  }
  return fontLoadPromise;
}
