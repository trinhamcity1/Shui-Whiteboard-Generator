import React from "react";
import { roughGenerator, drawableToPaths } from "./roughPath";
import { RevealPath } from "./RevealPath";
import { SKETCH_LINE } from "../sketchStyle";

export type ArrowVariant = "curved" | "straight" | "jagged" | "dashed";

export interface ArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  variant?: ArrowVariant;
  /** How far the curve bows off the straight line, as a fraction of the arrow's length — ignored for "straight"/"dashed". */
  curvature?: number;
  strokeWidth?: number;
  startFrame?: number;
  instant?: boolean;
  seed?: number;
}

const HEAD_LENGTH = 22;
const HEAD_SPREAD = 0.5;

function midpointWithBow(from: ArrowProps["from"], to: ArrowProps["to"], curvature: number) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset, so the bow reads as a real hand-drawn curve rather than a straight line.
  const nx = -dy / len;
  const ny = dx / len;
  return { x: mx + nx * len * curvature, y: my + ny * len * curvature };
}

/**
 * The workhorse connective decoration (Part I §6): a thick tapered curved
 * arrow with a solid triangular head, drawn with rough.js's wobble and
 * revealed stroke-first via RevealPath. Variants cover the rest of the
 * connector vocabulary: "straight" (a plain annotation line), "jagged" (a
 * multi-segment trend-line arrow, drawn red by convention in the reference
 * frames), "dashed" (a thin motion-implying arrow).
 */
export function Arrow({
  from,
  to,
  color,
  variant = "curved",
  curvature = 0.18,
  strokeWidth,
  startFrame = 0,
  instant,
  seed = 1,
}: ArrowProps) {
  const weight = strokeWidth ?? SKETCH_LINE.strokeWidthThick;
  const roughOpts = {
    stroke: color,
    strokeWidth: weight,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  };

  let shaftDrawable;
  let headAngleSource: { x: number; y: number };

  if (variant === "straight") {
    shaftDrawable = roughGenerator.line(from.x, from.y, to.x, to.y, roughOpts);
    headAngleSource = from;
  } else if (variant === "dashed") {
    // A hand-rolled dash pattern along the straight line — rough.js has no
    // native dash support, so we approximate with short rough segments.
    const segments = 6;
    const points: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push([from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t]);
    }
    const dashPaths: React.ReactNode[] = [];
    for (let i = 0; i < segments; i += 2) {
      const [x1, y1] = points[i]!;
      const [x2, y2] = points[i + 1] ?? points[i]!;
      const seg = roughGenerator.line(x1, y1, x2, y2, { ...roughOpts, strokeWidth: weight * 0.7, seed: seed + i });
      for (const p of drawableToPaths(seg)) {
        dashPaths.push(
          <RevealPath key={`dash-${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={10} instant={instant} />,
        );
      }
    }
    headAngleSource = from;
    return (
      <g>
        {dashPaths}
        <ArrowHead tip={to} from={headAngleSource} color={color} startFrame={startFrame + 12} instant={instant} seed={seed + 50} />
      </g>
    );
  } else if (variant === "jagged") {
    // A red trend-arrow zigzag — two or three angular segments instead of one smooth curve.
    const mid1 = { x: from.x + (to.x - from.x) * 0.35, y: from.y + (to.y - from.y) * 0.35 - 14 };
    const mid2 = { x: from.x + (to.x - from.x) * 0.7, y: from.y + (to.y - from.y) * 0.7 + 10 };
    shaftDrawable = roughGenerator.linearPath(
      [
        [from.x, from.y],
        [mid1.x, mid1.y],
        [mid2.x, mid2.y],
        [to.x, to.y],
      ],
      roughOpts,
    );
    headAngleSource = mid2;
  } else {
    const bow = midpointWithBow(from, to, curvature);
    shaftDrawable = roughGenerator.curve([[from.x, from.y], [bow.x, bow.y], [to.x, to.y]], roughOpts);
    headAngleSource = bow;
  }

  const shaftPaths = drawableToPaths(shaftDrawable);

  return (
    <g>
      {shaftPaths.map((p, i) => (
        <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={16} instant={instant} />
      ))}
      <ArrowHead tip={to} from={headAngleSource} color={color} startFrame={startFrame + 14} instant={instant} seed={seed + 50} />
    </g>
  );
}

function ArrowHead({
  tip,
  from,
  color,
  startFrame,
  instant,
  seed,
}: {
  tip: { x: number; y: number };
  from: { x: number; y: number };
  color: string;
  startFrame: number;
  instant?: boolean;
  seed: number;
}) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const points: [number, number][] = [
    [tip.x, tip.y],
    [tip.x - HEAD_LENGTH * Math.cos(angle - HEAD_SPREAD), tip.y - HEAD_LENGTH * Math.sin(angle - HEAD_SPREAD)],
    [tip.x - HEAD_LENGTH * Math.cos(angle + HEAD_SPREAD), tip.y - HEAD_LENGTH * Math.sin(angle + HEAD_SPREAD)],
  ];
  const drawable = roughGenerator.polygon(points, {
    fill: color,
    fillStyle: SKETCH_LINE.fillStyle,
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthHairline,
    roughness: SKETCH_LINE.roughnessTight,
    seed,
  });
  // The head is a small filled shape — a stroke-length reveal doesn't read
  // as anything but a flicker at this size, so it just appears (the shaft
  // already carried the "drawing" motion up to this point).
  return (
    <g style={instant ? undefined : { opacity: 1 }}>
      {drawableToPaths(drawable).map((p, i) => (
        <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={color} />
      ))}
    </g>
  );
}
