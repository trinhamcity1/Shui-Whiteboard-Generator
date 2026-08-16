import rough from "roughjs";
import type { Drawable, PathInfo } from "roughjs/bin/core";

/**
 * A DOM-free rough.js generator — `rough.generator()` produces the same
 * wobbly hand-drawn Drawable shapes as `rough.svg(svgEl)` does elsewhere
 * in this codebase (SketchDiagram), but without needing a live <svg> ref
 * first. `generator.toPaths(drawable)` then turns that into plain SVG
 * path `d` strings we render ourselves as real <path> elements — which is
 * what makes per-stroke draw-on reveal (stroke-dashoffset) possible; a
 * `rough.svg()`-rendered shape is a black box of internally-managed
 * elements you can't easily attach your own animation to.
 */
const generator = rough.generator();

export { generator as roughGenerator };

/** Every path rough.js produced for one Drawable, flattened — a Drawable
 * can be 2+ paths (e.g. a fill hatch pass plus a stroke pass). */
export function drawableToPaths(drawable: Drawable): PathInfo[] {
  return generator.toPaths(drawable);
}
