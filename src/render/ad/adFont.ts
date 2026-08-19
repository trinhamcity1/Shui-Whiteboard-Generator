import { staticFile } from "remotion";

/**
 * The kinetic-hero title's display face. Same self-hosting discipline as
 * sketchStyle.ts's SKETCH_FONT_FAMILY — @remotion/google-fonts' live CDN
 * loader fails in this sandbox's headless-Chromium (cert trust gap), so
 * the woff2 is fetched once via curl (which does trust this environment's
 * proxy CA) and served locally instead. Anton: an ultra-bold, condensed
 * poster face — the generic bold-Helvetica title was one of the flatter,
 * more "corporate slide" tells next to the reference's actual kinetic
 * typography.
 */
export const AD_TITLE_FONT_FAMILY = "Anton";
const AD_TITLE_FONT_URL = staticFile("fonts/Anton-Regular.woff2");

export const adTitleFontFaceCss = `
@font-face {
  font-family: '${AD_TITLE_FONT_FAMILY}';
  src: url('${AD_TITLE_FONT_URL}') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`;
