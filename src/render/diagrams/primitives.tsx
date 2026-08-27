import React from "react";
import { roughGenerator, drawableToPaths } from "../decorations/roughPath";
import { RevealPath } from "../decorations/RevealPath";
import { SKETCH_COLORS, SKETCH_LINE, SKETCH_FONT_FAMILY } from "../sketchStyle";
import type { DiagramEmphasis } from "../../schema/diagram";

/**
 * Shared drawing primitives for the diagram library (14 kinds across 6
 * families — see shui-wg-phase-07-diagram-library.md). Every diagram
 * component in this directory is built from these instead of re-deriving
 * "how do I draw a hand-drawn rectangle" nine separate times — the same
 * reasoning sketchStyle.ts already applies to color/line/font.
 *
 * Uses the declarative rough.js pattern (roughGenerator + drawableToPaths +
 * RevealPath) already established in src/render/decorations/, not the
 * older imperative rough.svg(ref)+useEffect pattern the pre-rebuild
 * SketchDiagram.tsx used — no delayRender/continueRender dance needed,
 * and per-stroke reveal comes for free.
 */

export const CANVAS_WIDTH = 1000;

/** Ink-first color rule (Revision 4 methodology decision): a box's fill is
 * ONLY ever `panelFill` (a neutral card background, not a color) unless a
 * node carries an explicit, semantic `emphasis`. There is no per-index
 * color cycling anywhere in this library — a box's color must mean
 * something stated once (a legend) or be one of the two correctness
 * signals, never decoration. */
export function emphasisFill(emphasis?: DiagramEmphasis): string {
  switch (emphasis) {
    case "positive":
      return SKETCH_COLORS.leafGreen;
    case "negative":
      return SKETCH_COLORS.signalRed;
    case "accent1":
      return SKETCH_COLORS.tierPalette[0]!;
    case "accent2":
      return SKETCH_COLORS.tierPalette[1]!;
    case "accent3":
      return SKETCH_COLORS.tierPalette[2]!;
    default:
      return SKETCH_COLORS.panelFill;
  }
}

/** Long labels (a real problem seen repeatedly — a full clause overflows a
 * fixed-size box) shrink to stay legible. Shared across every diagram kind
 * so a "this text is too long" fix only ever needs to happen once. */
export function fontSizeForLabel(label: string, base: number): number {
  if (label.length > 60) return Math.round(base * 0.55);
  if (label.length > 40) return Math.round(base * 0.7);
  if (label.length > 25) return Math.round(base * 0.85);
  return base;
}

export function boxPoints(cx: number, cy: number, w: number, h: number): [number, number][] {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];
}

/** A hand-drawn rectangle: filled body (instant, no stroke-reveal — a flat
 * fill reads as a glitch if partially drawn) plus a reveal-animated ink
 * border on top. The one shape every node-based diagram kind reaches for. */
export function RoughRect({
  x,
  y,
  width,
  height,
  fill = SKETCH_COLORS.panelFill,
  seed = 1,
  startFrame = 0,
  instant,
  strokeWidth = SKETCH_LINE.strokeWidthThick,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  seed?: number;
  startFrame?: number;
  instant?: boolean;
  strokeWidth?: number;
}) {
  const points = boxPoints(x + width / 2, y + height / 2, width, height);
  const drawable = roughGenerator.polygon(points, {
    stroke: SKETCH_COLORS.ink,
    strokeWidth,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  const fillDrawable = roughGenerator.polygon(points, { fill, fillStyle: SKETCH_LINE.fillStyle, stroke: "none", seed: seed + 500 });
  return (
    // Self-contained <svg> wrapper — a bare <g>/<path> placed directly as a
    // child of a plain HTML div (AbsoluteFill) renders nothing at all; a
    // real render of 8 of the 9 new diagram kinds showed exactly that
    // (arrows/lines visible, every box/circle invisible) because every
    // call site except the pyramid's own stack layout placed these outside
    // an <svg>. Wrapping it HERE means no future call site can get this
    // wrong.
    <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
      <g>
        {drawableToPaths(fillDrawable)
          .filter((p) => p.fill)
          .map((p, i) => (
            <path key={`fill-${i}`} d={p.d} fill={p.fill} stroke="none" />
          ))}
        {drawableToPaths(drawable).map((p, i) => (
          <RevealPath key={`stroke-${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={16} instant={instant} />
        ))}
      </g>
    </svg>
  );
}

/** A hand-drawn ellipse — used by cycle nodes, radial hub, Venn sets. */
export function RoughEllipse({
  cx,
  cy,
  width,
  height,
  fill = SKETCH_COLORS.panelFill,
  seed = 1,
  startFrame = 0,
  instant,
  strokeWidth = SKETCH_LINE.strokeWidthThick,
  fillOpacity,
}: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  fill?: string;
  seed?: number;
  startFrame?: number;
  instant?: boolean;
  strokeWidth?: number;
  fillOpacity?: number;
}) {
  const drawable = roughGenerator.ellipse(cx, cy, width, height, {
    stroke: SKETCH_COLORS.ink,
    strokeWidth,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  const fillDrawable = roughGenerator.ellipse(cx, cy, width, height, { fill, fillStyle: SKETCH_LINE.fillStyle, stroke: "none", seed: seed + 500 });
  return (
    // Same self-contained <svg> wrapper as RoughRect — see its comment.
    <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
      <g opacity={fillOpacity !== undefined ? undefined : 1}>
        {drawableToPaths(fillDrawable)
          .filter((p) => p.fill)
          .map((p, i) => (
            <path key={`fill-${i}`} d={p.d} fill={p.fill} stroke="none" opacity={fillOpacity} />
          ))}
        {drawableToPaths(drawable).map((p, i) => (
          <RevealPath key={`stroke-${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={16} instant={instant} />
        ))}
      </g>
    </svg>
  );
}

/** A plain hand-drawn connecting line with NO arrowhead — for an
 * associative link (a radial hub to its spokes, a network edge) where
 * nothing is "caused by" or "flows to" the other end. Use the shared
 * `Arrow` decoration instead whenever direction/causality/sequence
 * actually matters. */
export function SpokeLine({ x1, y1, x2, y2, seed = 1 }: { x1: number; y1: number; x2: number; y2: number; seed?: number }) {
  const drawable = roughGenerator.line(x1, y1, x2, y2, {
    stroke: SKETCH_COLORS.ink,
    strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
      {drawableToPaths(drawable).map((p, i) => (
        <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={0} instant />
      ))}
    </svg>
  );
}

export function DiagramTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 25,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: SKETCH_FONT_FAMILY,
        fontSize: 46,
        letterSpacing: 1,
        color: SKETCH_COLORS.ink,
      }}
    >
      {title}
    </div>
  );
}

/** Plain centered label text over a RoughRect/RoughEllipse — every diagram
 * kind's node label uses this so text sizing/positioning stays consistent. */
export function NodeLabel({
  x,
  y,
  width,
  height,
  label,
  baseFontSize = 28,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  baseFontSize?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: SKETCH_FONT_FAMILY,
        fontSize: fontSizeForLabel(label, baseFontSize),
        lineHeight: 1.25,
        color: SKETCH_COLORS.ink,
        padding: "0 10px",
      }}
    >
      {label}
    </div>
  );
}
