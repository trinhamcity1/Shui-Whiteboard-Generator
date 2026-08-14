import { staticFile } from "remotion";

/**
 * Central style reference for the rough.js/sketch-diagram system — every
 * sketch-based component (SketchDiagram now, others later) should pull its
 * colors, line quality, and font from here instead of hardcoding its own
 * values. The point: one place to tune "does this look like Golpo" instead
 * of re-tuning five components that have quietly drifted apart.
 */

export const SKETCH_COLORS = {
  ink: "#1a1a1a",
  paper: "#faf6ec",
  panelFill: "#ffffff",
  accentArrow: "#c0392b",
  // Named so a pyramid/tier diagram always reads the same three colors in
  // the same order, the way "Federal blue / State pink / Local orange"
  // does in the Golpo reference.
  tierPalette: ["#5b8dd6", "#e07bab", "#eda45a"],
} as const;

/** All rough.js shapes share one line quality so nothing looks like it came from a different hand. */
export const SKETCH_LINE = {
  roughness: 2.0,
  bowing: 1.6,
  strokeWidth: 3,
  fillStyle: "solid" as const,
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
