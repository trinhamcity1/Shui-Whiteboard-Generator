import React from "react";
import { roughGenerator, drawableToPaths } from "./roughPath";
import { RevealPath } from "./RevealPath";
import { SKETCH_LINE, SKETCH_COLORS } from "../sketchStyle";

interface BaseMarkProps {
  x: number;
  y: number;
  size?: number;
  color?: string;
  startFrame?: number;
  instant?: boolean;
  seed?: number;
}

/** Two confident crossed strokes — negation only, per the planner rules (never decorative). */
export function XMark({ x, y, size = 40, color = SKETCH_COLORS.signalRed, startFrame = 0, instant, seed = 1 }: BaseMarkProps) {
  const r = size / 2;
  const opts = { stroke: color, strokeWidth: SKETCH_LINE.strokeWidthThick, roughness: SKETCH_LINE.roughness, bowing: SKETCH_LINE.bowing };
  const stroke1 = roughGenerator.line(x - r, y - r, x + r, y + r, { ...opts, seed });
  const stroke2 = roughGenerator.line(x + r, y - r, x - r, y + r, { ...opts, seed: seed + 1 });
  return (
    <g>
      {drawableToPaths(stroke1).map((p, i) => (
        <RevealPath key={`a${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={8} instant={instant} />
      ))}
      {drawableToPaths(stroke2).map((p, i) => (
        <RevealPath key={`b${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame + 8} revealFrames={8} instant={instant} />
      ))}
    </g>
  );
}

/** One committed check stroke — short-down, long-up. */
export function Checkmark({ x, y, size = 40, color = SKETCH_COLORS.leafGreen, startFrame = 0, instant, seed = 1 }: BaseMarkProps) {
  const opts = { stroke: color, strokeWidth: SKETCH_LINE.strokeWidthThick, roughness: SKETCH_LINE.roughness, bowing: SKETCH_LINE.bowing, seed };
  const drawable = roughGenerator.linearPath(
    [
      [x - size / 2, y],
      [x - size / 8, y + size / 2.5],
      [x + size / 2, y - size / 2.5],
    ],
    opts,
  );
  return (
    <g>
      {drawableToPaths(drawable).map((p, i) => (
        <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={12} instant={instant} />
      ))}
    </g>
  );
}

/** Short lines fanning out from a focal point — the "this matters" burst. */
export function RadiatingStrokes({ x, y, size = 50, color = SKETCH_COLORS.ink, startFrame = 0, instant, seed = 1 }: BaseMarkProps) {
  const count = 6;
  const inner = size * 0.55;
  const outer = size;
  const paths: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x1 = x + Math.cos(angle) * inner;
    const y1 = y + Math.sin(angle) * inner;
    const x2 = x + Math.cos(angle) * outer;
    const y2 = y + Math.sin(angle) * outer;
    const drawable = roughGenerator.line(x1, y1, x2, y2, {
      stroke: color,
      strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5,
      roughness: SKETCH_LINE.roughness,
      seed: seed + i,
    });
    for (const p of drawableToPaths(drawable)) {
      paths.push(<RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame + i * 2} revealFrames={6} instant={instant} />);
    }
  }
  return <g>{paths}</g>;
}

/** A loose scribbled oval around a focal point — the "look here" highlight. */
export function CircledScribble({ x, y, size = 90, color = SKETCH_COLORS.signalRed, startFrame = 0, instant, seed = 1 }: BaseMarkProps) {
  const rx = size / 2;
  const ry = size / 3;
  const drawable = roughGenerator.ellipse(x, y, rx * 2, ry * 2, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThin * 1.6,
    roughness: SKETCH_LINE.roughness * 1.4,
    bowing: SKETCH_LINE.bowing,
    curveFitting: 0.9,
    seed,
  });
  return (
    <g>
      {drawableToPaths(drawable).map((p, i) => (
        <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={16} instant={instant} />
      ))}
    </g>
  );
}

/** A single confident stroke under a word/phrase — pass the text's own bounding width. */
export function UnderlineSwash({ x, y, width, color = SKETCH_COLORS.signalRed, startFrame = 0, instant, seed = 1 }: BaseMarkProps & { width: number }) {
  const drawable = roughGenerator.line(x, y, x + width, y, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThick,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing * 1.3,
    seed,
  });
  return (
    <g>
      {drawableToPaths(drawable).map((p, i) => (
        <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={10} instant={instant} />
      ))}
    </g>
  );
}

/** A small 4-point star — sparkle/emphasis accent, used in small clusters. */
export function Sparkle({ x, y, size = 18, color = SKETCH_COLORS.bright.orange, startFrame = 0, instant, seed = 1 }: BaseMarkProps) {
  const points: [number, number][] = [
    [x, y - size],
    [x + size * 0.22, y - size * 0.22],
    [x + size, y],
    [x + size * 0.22, y + size * 0.22],
    [x, y + size],
    [x - size * 0.22, y + size * 0.22],
    [x - size, y],
    [x - size * 0.22, y - size * 0.22],
  ];
  const drawable = roughGenerator.polygon(points, {
    fill: color,
    fillStyle: "solid",
    stroke: color,
    strokeWidth: 1,
    roughness: 1.2,
    seed,
  });
  return (
    <g>
      {drawableToPaths(drawable).map((p, i) => (
        <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={color} opacity={instant ? 1 : undefined} />
      ))}
    </g>
  );
}

/** A trio of short parallel dashes trailing a moving element — implies motion, not decoration for its own sake. */
export function MotionDashes({ x, y, size = 40, color = SKETCH_COLORS.ink, startFrame = 0, instant, seed = 1 }: BaseMarkProps) {
  const paths: React.ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const offset = i * (size / 3.2);
    const drawable = roughGenerator.line(x - offset, y, x - offset - size / 5, y, {
      stroke: color,
      strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5,
      roughness: SKETCH_LINE.roughness,
      seed: seed + i,
    });
    for (const p of drawableToPaths(drawable)) {
      paths.push(<RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame + i * 3} revealFrames={5} instant={instant} />);
    }
  }
  return <g>{paths}</g>;
}
